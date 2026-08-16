// app/api/ip/revenue-tokenization/route.js
import { NextResponse } from "next/server";
import algosdk from "algosdk";
import {
  getAlgodClient,
  getTransactionParams,
  waitForConfirmation,
  getUsdcAssetId,
  getSigner,
} from "@/lib/algorand";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { uploadJsonToPinata, createARC3Metadata } from "@/lib/pinata";
import { safeJson } from "@/lib/utils";
import crypto from "crypto";

// ─── Revenue Pool V7 config (mirror scripts/test_lifecycle.js) ───
const APP_ID = parseInt(process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID || "0", 10);
const USDC_ID = getUsdcAssetId("testnet");

/** Pack stakeholders → 32-byte pubkey + 2-byte BPS big-endian (34 bytes each) */
function packStakeholders(entries) {
  const buf = Buffer.alloc(entries.length * 34);
  let off = 0;
  for (const { address, bps } of entries) {
    const pk = algosdk.decodeAddress(address).publicKey;
    pk.forEach((b, i) => {
      buf[off + i] = b;
    });
    buf[off + 32] = (bps >> 8) & 0xff;
    buf[off + 33] = bps & 0xff;
    off += 34;
  }
  return buf;
}

function poolBoxName(ipId) {
  return new Uint8Array(Buffer.from("p_" + ipId));
}

function poolMbr(ipId, shCount) {
  return 2500 + 400 * (75 + Buffer.byteLength(ipId) + shCount * 35);
}

function roundMbr(ipId, shCount) {
  return 2500 + 400 * (12 + Buffer.byteLength(ipId) + 18 + shCount * 41);
}

function parseUsdToCents(value, fieldName) {
  const normalized = String(value ?? "").trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`${fieldName} must be a USD amount with at most two decimals`);
  }

  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error(`${fieldName} must be a non-negative USD amount`);
  }

  return cents;
}

// =========================================================
// POST: PREPARE TOKENIZATION MINT (NFT ONLY, STEP 1)
// =========================================================
export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.substring(7);
    if (!token) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (e) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const body = await request.json();

        const {
      name,
      assetType,
      description,
      category,
      image: imageCid,
      walletAddress: connectedWallet,
      stakeholders: incomingStakeholders,
      licenseFeeUsd,
      licensable,
      isPublic,
    } = body;

    const { ObjectId } = await import("mongodb");

    let userQuery;
    try {
      userQuery = {
        $or: [{ id: decoded.userId }, { _id: new ObjectId(decoded.userId) }],
      };
    } catch {
      userQuery = { id: decoded.userId };
    }

    let user = await db.collection("users").findOne(userQuery);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const displayName = user.profile?.displayName || user.username || user.email;
    const avatar =
      user.profile?.avatar || user.avatar || user.profileImage || "";

    // --- CREDITS CHECK & DEDUCTION (TOKENIZATION PRICE) ---
    const MINT_COST_TOKEN = 25;
    if ((user.credits || 0) < MINT_COST_TOKEN) {
      return NextResponse.json(
        { error: "Insufficient credits to mint" },
        { status: 402 },
      );
    }

    const creditUpdate = await db.collection("users").findOneAndUpdate(
      { ...userQuery, credits: { $gte: MINT_COST_TOKEN } },
      { $inc: { credits: -MINT_COST_TOKEN } },
      { returnDocument: "after" },
    );

    if (!creditUpdate) {
      return NextResponse.json(
        { error: "Insufficient credits (race condition prevented)" },
        { status: 402 },
      );
    }

    const senderWallet = connectedWallet || user.walletAddress;
    if (!senderWallet || !algosdk.isValidAddress(senderWallet)) {
      return NextResponse.json(
        { error: "Valid wallet address required" },
        { status: 400 },
      );
    }

    if (!name || !imageCid) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const ipAssetId = new (await import("mongodb")).ObjectId().toString();

    const isPublicIp = isPublic !== false;
    const isLicensableIp = licensable !== false;

    let licensingFeeCents = 0;

    if (isPublicIp && isLicensableIp) {
      licensingFeeCents = parseUsdToCents(
        licenseFeeUsd,
        "licenseFeeUsd"
      );
    }

    // 1. Validate stakeholders
    let norm = (incomingStakeholders || []).map((s, index) => ({
      name: String(s.name || (index === 0 ? "Creator" : "")).trim(),
      address: String(s.address || (index === 0 ? senderWallet : "")).trim(),
      perc: parseFloat(s.percentage ?? s.perc ?? 0),
    }));

    if (!norm.length) {
      norm = [{ name: "Creator", address: senderWallet, perc: 100 }];
    }

    norm = norm.filter((s) => s.address && Number(s.perc) > 0);

    if (!norm.length) {
      return NextResponse.json(
        { error: "At least one stakeholder is required" },
        { status: 400 }
      );
    }

    const invalidStakeholder = norm.find((s) => !algosdk.isValidAddress(s.address));
    if (invalidStakeholder) {
      return NextResponse.json(
        {
          error: `Invalid stakeholder address: ${invalidStakeholder.address}`,
        },
        { status: 400 }
      );
    }

    const normalizedAddresses = norm.map((s) => s.address.toUpperCase());
    const uniqueAddresses = new Set(normalizedAddresses);

    if (uniqueAddresses.size !== normalizedAddresses.length) {
      return NextResponse.json(
        { error: "Duplicate stakeholder addresses are not allowed" },
        { status: 400 }
      );
    }

    const totalPerc = norm.reduce((sum, s) => sum + Number(s.perc || 0), 0);
    if (Math.round(totalPerc * 100) !== 10000) {
      return NextResponse.json(
        {
          error: `Stakeholder percentages must total exactly 100%. Got ${totalPerc.toFixed(2)}%`,
        },
        { status: 400 }
      );
    }

    const stakeholdersForContract = norm.map((s) => ({
      address: s.address,
      bps: Math.round(Number(s.perc) * 100),
    }));

    const totalBps = stakeholdersForContract.reduce((sum, s) => sum + s.bps, 0);
    if (totalBps !== 10000) {
      return NextResponse.json(
        {
          error: `Stakeholder BPS must total exactly 10000. Got ${totalBps}`,
        },
        { status: 400 }
      );
    }

    // 2. Validate IPFS CID
    const isCid = imageCid && !imageCid.startsWith("http") && imageCid.length > 20;
    if (!isCid) {
      return NextResponse.json(
        {
          error:
            "image must be an IPFS CID, not a URL. Pin via /api/ipfs/upload first.",
        },
        { status: 400 },
      );
    }

    // 3. Build & upload ARC3 metadata
    const imageUrl = imageCid.startsWith("ipfs://")
      ? imageCid
      : `ipfs://${imageCid}`;

    const meta = createARC3Metadata({
      name,
      description,
      imageUrl,
      ipAssetId,
      category,
      creator: senderWallet,
    });

    const metaRes = await uploadJsonToPinata(meta, name + "_meta");
    const metadataHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(meta))
      .digest("base64");

    // 4. Create NFT Mint Transaction
    const params = await getTransactionParams();
    const cidOnly = metaRes.ipfsUrl.split("/").pop();
    const shortAssetUrl = `ipfs://${cidOnly}#arc3`;

    const nftTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
      sender: senderWallet,
      total: 1n,
      decimals: 0,
      defaultFrozen: false,
      manager: senderWallet,
      reserve: senderWallet,
      unitName: "IPNFT",
      assetName: name.substring(0, 32),
      assetURL: shortAssetUrl,
      assetMetadataHash: new Uint8Array(Buffer.from(metadataHash, "base64")),
      suggestedParams: params,
    });

    // 5. Persist ip_asset (tokenized)
    const ipAsset = {
      id: ipAssetId,
      name,
      assetType: assetType || "token",
      description,
      category,
      imageUrl: imageUrl.replace(
        "ipfs://",
        `${String(process.env.PINATA_GATEWAY || "")
          .replace(/\/+$/, "")
          .replace(/\/ipfs$/, "")}/ipfs/`,
      ),
      metadataUrl: metaRes.ipfsUrl,
      metadataHash,
      ownerId: decoded.userId,
      ownerWallet: senderWallet,
      ownerName: displayName,
      ownerUsername: user.username,
      ownerAvatar: avatar,

      isPublic: isPublicIp,
      licensable: isLicensableIp,
      licensingFeeCents,

      stakeholders: stakeholdersForContract, // { address, bps }
      type: "tokenized",
      status: "pending_nft_mint",
      createdAt: new Date(),
    };

    await db.collection("ip_assets").insertOne(ipAsset);

    // Compute MBR that user must fund up front:
    // - pool MBR (one-time)
    // - round-buffer MBR (recycled for every future claim round)
    const shCount = stakeholdersForContract.length;
    const poolMbrAmount = poolMbr(ipAssetId, shCount);
    const roundMbrAmount = roundMbr(ipAssetId, shCount);
    const usdcAssetMbr = 100_000; // App account opts into USDC
    const revenueAssetMbr = 100_000; // App account creates/holds revenue ASA
    const poolFundingBuffer = 10_000; // 0.01 ALGO safety margin

    const mbrMicroAlgos =
      poolMbrAmount +
      roundMbrAmount +
      usdcAssetMbr +
      revenueAssetMbr +
      poolFundingBuffer;

    console.log("Revenue tokenization MBR calculation", {
      ipAssetId,
      shCount,
      poolMbrAmount,
      roundMbrAmount,
      usdcAssetMbr,
      revenueAssetMbr,
      poolFundingBuffer,
      mbrMicroAlgos,
    });

    return NextResponse.json(
      safeJson({
        success: true,
        step: "mint_nft",
        ipAssetId,
        mbrMicroAlgos, // <-- NEW: tell frontend how much ALGO to charge
        transaction: Buffer.from(
          algosdk.encodeUnsignedTransaction(nftTxn),
        ).toString("base64"),
      }),
    );
  } catch (e) {
    console.error("Revenue Tokenization POST Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// =========================================================
// PUT: CONFIRM NFT + CREATE POOL + CONFIRM POOL
// =========================================================
export async function PUT(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.substring(7);
    if (!token) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (e) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { step, ipAssetId, signedTxn, signedTxns } = await request.json();
    const { db } = await connectToDatabase();
    const algodClient = getAlgodClient();

    const ipAsset = await db.collection("ip_assets").findOne({ id: ipAssetId });
    if (!ipAsset) {
      return NextResponse.json({ error: "IP asset not found" }, { status: 404 });
    }

    if (String(ipAsset.ownerId) !== String(decoded.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // -----------------------------------------------------
    // STEP 1: Confirm NFT Mint -> Admin Create Pool (after user MBR payment)
    // -----------------------------------------------------
    if (step === "confirm_nft") {
      const txnBytes = signedTxns?.[0] ?? signedTxn;
      let nftAssetId;

      // 1) Confirm NFT mint
      try {
        const { txid } = await algodClient
          .sendRawTransaction(new Uint8Array(Buffer.from(txnBytes, "base64")))
          .do();
        const confirmed = await waitForConfirmation(txid, 10);
        nftAssetId =
          confirmed["asset-index"] ??
          confirmed["created-asset-index"] ??
          confirmed.assetIndex ??
          confirmed.createdAssetIndex;
      } catch (e) {
        if (e.message?.includes("already in ledger")) {
          const existing = await db
            .collection("ip_assets")
            .findOne({ id: ipAssetId });
          if (existing?.nftAssetId) {
            nftAssetId = existing.nftAssetId;
          } else {
            throw new Error(
              "Transaction already submitted but NFT asset ID not found. Please wait and retry.",
            );
          }
        } else {
          throw e;
        }
      }

      if (!nftAssetId) {
        throw new Error("NFT mint confirmed but asset-index missing.");
      }

      // 2) Ensure user has paid MBR via /pool-funding
      if (!ipAsset.mbrPaidMicroAlgos || !ipAsset.mbrPaymentTxId) {
        throw new Error(
          "Pool creation MBR not funded by user. Please fund pool first.",
        );
      }

      const poolAppId = APP_ID;
      if (!poolAppId) {
        throw new Error(
          "Global Pool App ID not configured (check NEXT_PUBLIC_REVENUE_POOL_APP_ID)",
        );
      }

      const algod = getAlgodClient("testnet");
      const sp = await getTransactionParams();
      const appAddr = algosdk.getApplicationAddress(poolAppId).toString();

      // Stakeholders saved as { address, bps }
      const stakeholdersForContract = ipAsset.stakeholders || [];
      const shBytes = packStakeholders(stakeholdersForContract);

      const poolBoxMbr = poolMbr(
        ipAssetId,
        stakeholdersForContract.length,
      );

      const usdcAssetMbr = 100_000;
      const revenueAssetMbr = 100_000;
      const poolFundingBuffer = 10_000;

      const reserveFundingAmount =
        usdcAssetMbr +
        revenueAssetMbr +
        poolFundingBuffer;

      const adminSigner = getSigner(); // METAWORK_PLATFORM_MNEMONIC
      const boxName = poolBoxName(ipAssetId);

      console.log("Revenue pool create funding", {
        ipAssetId,
        stakeholderCount: stakeholdersForContract.length,
        poolBoxMbr,
        usdcAssetMbr,
        revenueAssetMbr,
        poolFundingBuffer,
        reserveFundingAmount,
        totalSentToApp: reserveFundingAmount + poolBoxMbr,
      });

      const reserveFundingTxn =
        algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: adminSigner.address,
          receiver: appAddr,
          amount: reserveFundingAmount,
          suggestedParams: sp,
        });

      const poolMbrPaymentTxn =
        algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: adminSigner.address,
          receiver: appAddr,
          amount: poolBoxMbr,
          suggestedParams: sp,
        });

      const appTxn = algosdk.makeApplicationNoOpTxnFromObject({
        sender: adminSigner.address,
        appIndex: poolAppId,
        appArgs: [
          new TextEncoder().encode("create_pool"),
          new TextEncoder().encode(ipAssetId),
          new TextEncoder().encode(`Rev ${ipAsset.name.substring(0, 10)}`),
          new TextEncoder().encode("REV"),
          shBytes,
          algosdk.encodeUint64(1), // pool MBR payment is group txn index 1
        ],
        foreignAssets: [USDC_ID],
        boxes: [{ appIndex: poolAppId, name: boxName }],
        suggestedParams: { ...sp, fee: BigInt(3000), flatFee: true },
      });

      algosdk.assignGroupID([
        reserveFundingTxn,  // group index 0: 210,000 microALGO
        poolMbrPaymentTxn, // group index 1: exact pool box MBR
        appTxn,            // group index 2
      ]);

      const signedGroup = [
        adminSigner.signTxn(reserveFundingTxn),
        adminSigner.signTxn(poolMbrPaymentTxn),
        adminSigner.signTxn(appTxn),
      ];

      const { txid } = await algod.sendRawTransaction(signedGroup).do();
      await waitForConfirmation(txid, 10);

      // Read pool box to get rev ASA ID
      const boxVal = await algod.getApplicationBoxByName(poolAppId, boxName).do();
      const boxBytes = boxVal.value;
      const view = new DataView(
        boxBytes.buffer,
        boxBytes.byteOffset,
        boxBytes.byteLength,
      );
      const revenueTokenId = Number(view.getBigUint64(0, false));

      await db.collection("ip_assets").updateOne(
        { id: ipAssetId },
        {
          $set: {
            nftAssetId: Number(nftAssetId),
            revenuePoolAppId: poolAppId,
            revenuePoolAddress: algosdk.getApplicationAddress(poolAppId),
            revenueTokenAssetId: revenueTokenId,
            status: "active",
          },
        },
      );

      return NextResponse.json(
        safeJson({
          success: true,
          step: "complete",
          revenueTokenId,
        }),
      );
    }

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  } catch (error) {
    console.error("Revenue Tokenization PUT Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}