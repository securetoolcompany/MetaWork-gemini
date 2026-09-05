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
import { CREDIT_COSTS } from '@/lib/credit-costs';

// V10 server-side revenue-pool configuration.
function getRevenuePoolAppId() {
  const appId = Number(process.env.GLOBAL_POOL_APP_ID);

  if (!Number.isSafeInteger(appId) || appId <= 0) {
    throw new Error(
      'GLOBAL_POOL_APP_ID must be configured as a positive integer',
    );
  }

  return appId;
}

const USDC_ID = getUsdcAssetId('testnet');

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
      operationKey,
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
    const rawStakeholders =
      Array.isArray(incomingStakeholders) && incomingStakeholders.length > 0
        ? incomingStakeholders
        : [{ name: "Creator", address: senderWallet, percentage: 100 }];

    const norm = rawStakeholders.map((stakeholder, index) => ({
      name: String(
        stakeholder.name || (index === 0 ? "Creator" : ""),
      ).trim(),
      address: String(
        stakeholder.address || (index === 0 ? senderWallet : ""),
      ).trim(),
      percentage: String(
        stakeholder.percentage ?? stakeholder.perc ?? "",
      ).trim(),
    }));

    if (norm[0]?.address !== senderWallet) {
      return NextResponse.json(
        { error: "The creator stakeholder must use the connected wallet address." },
        { status: 400 },
      );
    }

    const missingStakeholderField = norm.find(
      (stakeholder) =>
        !stakeholder.address ||
        !stakeholder.percentage,
    );

    if (missingStakeholderField) {
      return NextResponse.json(
        {
          error:
            "Every stakeholder must include an Algorand wallet address and allocation percentage.",
        },
        { status: 400 },
      );
    }

    const invalidPercentage = norm.find(
      (stakeholder) =>
        !/^\d+(?:\.\d{1,2})?$/.test(stakeholder.percentage),
    );

    if (invalidPercentage) {
      return NextResponse.json(
        {
          error:
            "Stakeholder percentages must be non-negative values with at most two decimal places.",
        },
        { status: 400 },
      );
    }

    const stakeholdersForContract = norm.map((stakeholder) => {
      const [whole, fraction = ""] = stakeholder.percentage.split(".");
      const bps =
        Number(whole) * 100 +
        Number(fraction.padEnd(2, "0"));

      return {
        address: stakeholder.address,
        bps,
      };
    });

    const invalidStakeholder = stakeholdersForContract.find(
      (stakeholder) =>
        !algosdk.isValidAddress(stakeholder.address) ||
        !Number.isSafeInteger(stakeholder.bps) ||
        stakeholder.bps <= 0,
    );

    if (invalidStakeholder) {
      return NextResponse.json(
        {
          error:
            "Each stakeholder must have a valid Algorand wallet address and an allocation greater than 0%.",
        },
        { status: 400 },
      );
    }

    const normalizedAddresses = stakeholdersForContract.map(
      (stakeholder) => stakeholder.address.toUpperCase(),
    );

    if (new Set(normalizedAddresses).size !== normalizedAddresses.length) {
      return NextResponse.json(
        { error: "Duplicate stakeholder addresses are not allowed" },
        { status: 400 },
      );
    }

    const totalBps = stakeholdersForContract.reduce(
      (sum, stakeholder) => sum + stakeholder.bps,
      0,
    );

    if (totalBps !== 10000) {
      return NextResponse.json(
        {
          error:
            "Stakeholder allocations must total exactly 100.00%.",
        },
        { status: 400 },
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

    if (
      typeof operationKey !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(operationKey)
    ) {
      return NextResponse.json(
        { error: "A valid tokenization operation key is required." },
        { status: 400 },
      );
    }

    const existingIpAsset = await db.collection("ip_assets").findOne({
      ownerId: decoded.userId,
      tokenizationOperationKey: operationKey,
    });

    if (existingIpAsset) {
      if (existingIpAsset.status === 'active') {
        return NextResponse.json(
          safeJson({
            success: true,
            step: 'complete',
            ipAssetId: existingIpAsset.id,
            revenueTokenId: existingIpAsset.revenueTokenAssetId,
          }),
        );
      }

      if (
        existingIpAsset.status === 'pending_nft_mint' &&
        existingIpAsset.mbrMicroAlgos &&
        existingIpAsset.preparedNftTransaction
      ) {
        return NextResponse.json(
          safeJson({
            success: true,
            step: 'mint_nft',
            ipAssetId: existingIpAsset.id,
            mbrMicroAlgos: existingIpAsset.mbrMicroAlgos,
            transaction: existingIpAsset.preparedNftTransaction,
            resumed: true,
          }),
        );
      }

      return NextResponse.json(
        {
          error:
            'An existing tokenization operation is not in a resumable state. Please contact support.',
        },
        { status: 409 },
      );
    }

    // --- CREDITS CHECK & DEDUCTION (TOKENIZATION PRICE) ---
    const mintCostToken = CREDIT_COSTS.MINT_IP;

    if ((user.credits || 0) < mintCostToken) {
      return NextResponse.json(
        { error: "Insufficient credits to mint" },
        { status: 402 },
      );
    }

    const creditUpdate = await db.collection("users").findOneAndUpdate(
      { ...userQuery, credits: { $gte: mintCostToken } },
      { $inc: { credits: -mintCostToken } },
      { returnDocument: "after" },
    );

    if (!creditUpdate) {
      return NextResponse.json(
        { error: "Insufficient credits (race condition prevented)" },
        { status: 402 },
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

    const preparedNftTransaction = Buffer.from(
      algosdk.encodeUnsignedTransaction(nftTxn),
    ).toString("base64");

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

      tokenizationOperationKey: operationKey,
      creditCost: mintCostToken,
      creditStatus: "consumed",
      mbrMicroAlgos,
      preparedNftTransaction,
      updatedAt: new Date(),
      createdAt: new Date(),
    };

    await db.collection("ip_assets").insertOne(ipAsset);

    return NextResponse.json(
      safeJson({
        success: true,
        step: "mint_nft",
        ipAssetId,
        mbrMicroAlgos, // <-- NEW: tell frontend how much ALGO to charge
        transaction: preparedNftTransaction,
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

      const poolAppId = getRevenuePoolAppId();

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