import { NextResponse } from "next/server";
import algosdk from "algosdk";
import { getAlgodClient, getTransactionParams, waitForConfirmation } from "@/lib/algorand";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { uploadFileToPinata, uploadJsonToPinata, createARC3Metadata } from "@/lib/pinata";
import { safeJson } from "@/lib/utils";
import crypto from "crypto";

// --- HELPER: Safe Uint64 Encoding (Fixes BigInt Crash) ---
function encodeUint64(num) {
  try {
    const n = BigInt(Math.floor(Number(num) || 0));
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(n);
    return new Uint8Array(buf);
  } catch (e) {
    console.error("Encoding Error:", e);
    return new Uint8Array(8); 
  }
}

// --- HELPER: Encode Stakeholders for Smart Contract ---
function encodeAllocations(stakeholders) {
  const buffers = [];
  for (const s of stakeholders) {
    const addrStr = String(s.address).trim();
    const addr = algosdk.decodeAddress(addrStr).publicKey;
    const pct = Math.round(parseFloat(s.percentage) || 0);
    buffers.push(addr);
    buffers.push(encodeUint64(pct));
  }
  return Buffer.concat(buffers);
}

// =========================================================
// POST: MINT IP NFT (Step 1)
// =========================================================
export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.substring(7);
    if (!token) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const decoded = verifyToken(token);
    const { db } = await connectToDatabase();
    const body = await request.json();

    const { 
      name, 
      description, 
      category, 
      image: imageCid, 
      walletAddress: connectedWallet,
      stakeholders: incomingStakeholders 
    } = body;

    const { ObjectId } = await import('mongodb');

    let userQuery;
    try {
      userQuery = { $or: [{ id: decoded.userId }, { _id: new ObjectId(decoded.userId) }] };
    } catch {
      // decoded.userId isn't a valid ObjectId — query by id field only
      userQuery = { id: decoded.userId };
    }

    let user = await db.collection("users").findOne(userQuery);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });


    const senderWallet = connectedWallet || user.walletAddress;
      if (!senderWallet || !algosdk.isValidAddress(senderWallet)) {
        return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 });
      }

    if (!name || !imageCid) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const ipAssetId = new (await import('mongodb')).ObjectId().toString();

    // 1. Sanitize Stakeholders (Platform 20% Fee)
    const platformWallet = process.env.METAWORK_PLATFORM_WALLET;
      let finalStakeholders = (incomingStakeholders || []).filter(s => s.address !== platformWallet);

      // Normalize remaining stakeholders to sum to 80
      const currentTotal = finalStakeholders.reduce((sum, s) => sum + parseFloat(s.percentage || 0), 0);
      if (currentTotal > 0) {
        finalStakeholders = finalStakeholders.map(s => ({
          ...s,
          percentage: Math.round((parseFloat(s.percentage) / currentTotal) * 80)
        }));
      } else {
        // Default: creator gets 80%
        finalStakeholders = [{ address: senderWallet, percentage: 80, name: "Creator" }];
      }

      finalStakeholders.push({ address: platformWallet, percentage: 20, name: "Platform" });

    // 2. Prepare IPFS URLs
    const isCid = imageCid && !imageCid.startsWith('http') && imageCid.length > 20;
    if (!isCid) {
      return NextResponse.json({ 
        error: "image must be an IPFS CID, not a URL. Pin via /api/ipfs/upload first." 
      }, { status: 400 });
    }

    // 3. Prepare Database Record
    const imageUrl = imageCid.startsWith('ipfs://') ? imageCid : `ipfs://${imageCid}`;

    // Create and upload only the ARC3 Metadata JSON
    const meta = createARC3Metadata({ 
        name, 
        description, 
        imageUrl, 
        ipAssetId,
        category, 
        creator: senderWallet 
    });
    
    const metaRes = await uploadJsonToPinata(meta, name + "_meta");
    const metadataHash = crypto.createHash("sha256").update(JSON.stringify(meta)).digest("base64");

    
// 4. Create NFT Mint Transaction
    const params = await getTransactionParams();
    
    // We only send the CID to stay under the 96-byte limit
    // This turns "https://.../ipfs/CID" into just "ipfs://CID"
    const cidOnly = metaRes.ipfsUrl.split('/').pop();
    const shortAssetUrl = `ipfs://${cidOnly}`;

    const nftTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
      sender: senderWallet,
      total: 1n,
      decimals: 0,
      defaultFrozen: false,
      manager: senderWallet,
      reserve: senderWallet,
      unitName: "IPNFT",
      assetName: name.substring(0, 32),
      assetURL: shortAssetUrl, // This will be ~54 bytes, well under the 96 limit
      assetMetadataHash: new Uint8Array(Buffer.from(metadataHash, 'base64')),
      suggestedParams: params
    });

    const ipAsset = {
      id: ipAssetId, 
      name, 
      description, 
      category,
      imageUrl: imageUrl.replace("ipfs://", `${process.env.PINATA_GATEWAY}/ipfs/`),
      metadataUrl: metaRes.ipfsUrl, 
      metadataHash,
      ownerId: decoded.userId, 
      ownerWallet: senderWallet,
      stakeholders: finalStakeholders, // Uses sanitized stakeholders
      status: "pending_nft_mint", 
      createdAt: new Date()
    };
    await db.collection("ip_assets").insertOne(ipAsset);

    return NextResponse.json(safeJson({
      success: true, 
      step: "mint_nft", 
      ipAssetId, 
      transaction: Buffer.from(algosdk.encodeUnsignedTransaction(nftTxn)).toString("base64")
    }));

  } catch (e) {
    console.error("Mint POST Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// =========================================================
// PUT: CONFIRM MINT & CREATE POOL (Step 2 & 3)
// =========================================================
export async function PUT(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.substring(7);
    if (!token) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (e) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }


    const { step, ipAssetId, signedTxn, signedTxns } = await request.json();
    const { db } = await connectToDatabase();
    const algodClient = getAlgodClient();

    // -----------------------------------------------------
    // STEP A: Confirm NFT Mint -> Prepare Pool Creation
    // -----------------------------------------------------
    const ipAsset = await db.collection("ip_assets").findOne({ id: ipAssetId });
      if (!ipAsset) return NextResponse.json({ error: "IP asset not found" }, { status: 404 });

      // ✅ Verify the requestor owns this asset before submitting to chain
      if (String(ipAsset.ownerId) !== String(decoded.userId)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }    
    
    if (step === "confirm_nft") {
      // 1. Submit the signed NFT Mint transaction
      const { txid } = await algodClient.sendRawTransaction(new Uint8Array(Buffer.from(signedTxn, "base64"))).do();
      const confirmed = await waitForConfirmation(txid, 10);
      const nftAssetId = confirmed["asset-index"]    // v2 style
      ?? confirmed["created-asset-index"]           // v2 alt
      ?? confirmed.assetIndex                       // v3 style
      ?? confirmed.createdAssetIndex;               // v3 alt

    if (!nftAssetId) throw new Error(`NFT mint confirmed but asset-index missing. TxID: ${txid}`);

      const poolAppId = parseInt(process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID || "0");
      if (!poolAppId) throw new Error("Global Pool App ID not configured (check .env)");

      const creatorAddress = String(ipAsset.ownerWallet).trim();

      // 2. Prepare "Safety Deposit" Transaction Group
      // We send 0.5 ALGO to cover all possible storage costs + opt-ins.
      // The contract calculates actual usage and refunds the rest.
      const SAFE_MBR_AMOUNT = 500_000; // 0.5 ALGO

      const params = await getTransactionParams();

      // Transaction 1: Safety Deposit Payment
      const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: creatorAddress,
        receiver: algosdk.getApplicationAddress(poolAppId),
        amount: SAFE_MBR_AMOUNT,
        suggestedParams: params
      });

      // Construct box name with prefix "p_"
      const boxName = new Uint8Array(Buffer.concat([Buffer.from("p_"), Buffer.from(ipAssetId)]));

      // Transaction 2: Create Pool Call
      const appTxn = algosdk.makeApplicationNoOpTxnFromObject({
        sender: creatorAddress,
        appIndex: poolAppId,
        appArgs: [
            new Uint8Array(Buffer.from("create_pool")),
            new Uint8Array(Buffer.from(ipAssetId)),
            encodeUint64(nftAssetId),
            new Uint8Array(Buffer.from(`Rev ${ipAsset.name.substring(0,10)}`)),
            new Uint8Array(Buffer.from("REV")),
new Uint8Array(encodeAllocations(ipAsset.stakeholders || []))        ],
        boxes: [{ appIndex: poolAppId, name: boxName }],
        // CRITICAL: Fee 3000 to cover:
        // 1. This App Call (1000)
        // 2. Inner Asset Create (1000)
        // 3. Inner Refund Payment (1000)
        suggestedParams: { ...params, fee: 3000, flatFee: true }
      });

      algosdk.assignGroupID([payTxn, appTxn]);

      // Update DB status
      await db.collection("ip_assets").updateOne(
         { id: ipAssetId }, 
         { $set: { nftAssetId: Number(nftAssetId), status: "pending_pool_create" } }
      );

      return NextResponse.json(safeJson({
        success: true,
        step: "create_pool",
        transactions: [
            Buffer.from(algosdk.encodeUnsignedTransaction(payTxn)).toString("base64"),
            Buffer.from(algosdk.encodeUnsignedTransaction(appTxn)).toString("base64")
        ]
      }));
    }

    // -----------------------------------------------------
    // STEP B: Confirm Pool Creation -> Finalize
    // -----------------------------------------------------
    if (step === "confirm_pool") {
        // 1. Submit Group Transaction
        const rawTxns = signedTxns.map(t => new Uint8Array(Buffer.from(t, "base64")));
        const { txid } = await algodClient.sendRawTransaction(rawTxns).do();
        await waitForConfirmation(txid, 10);

        const poolAppId = parseInt(process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID);

        // 2. Read the new Box to get the Revenue Token ID
        // This confirms everything worked on-chain.
        const boxName = new Uint8Array(Buffer.concat([Buffer.from("p_"), Buffer.from(ipAssetId)]));
        const boxVal = await algodClient.getApplicationBoxByName(poolAppId, boxName).do();

        const boxBytes = boxVal.value;
        const view = new DataView(boxBytes.buffer, boxBytes.byteOffset, boxBytes.byteLength);
        const revenueTokenId = Number(view.getBigUint64(0, false));
        //const view = new DataView(boxBytes.buffer);
        // The first 8 bytes of the box are the Revenue Token Asset ID
        //const revenueTokenId = Number(BigInt(view.getBigUint64(0, false))); 

        // 3. Final DB Update
        await db.collection("ip_assets").updateOne(
            { id: ipAssetId },
            { $set: { 
                revenuePoolAppId: poolAppId,
                revenuePoolAddress: algosdk.getApplicationAddress(poolAppId),
                revenueTokenAssetId: revenueTokenId,
                status: "active"
            }}
        );

        return NextResponse.json(safeJson({ success: true, step: "complete", revenueTokenId }));
    }

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });

  } catch (error) {
    console.error("Mint Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}