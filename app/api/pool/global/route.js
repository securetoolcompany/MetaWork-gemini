import { NextResponse } from "next/server";
import algosdk from "algosdk";
import { getAlgodClient, getTransactionParams, waitForConfirmation } from "@/lib/algorand";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { safeJson } from "@/lib/utils";
import fs from "fs";
import path from "path";

/**
 * Global Revenue Pool API
 * 
 * Uses a single global Algorand application (deployed once by platform)
 * Each product gets a box in this app with its own revenue ASA
 * 
 * Environment variables:
 * - GLOBAL_POOL_APP_ID: The deployed global pool app ID
 * - METAWORK_PLATFORM_WALLET: Platform wallet for MetaWork share
 */

const USDC_ASSET_ID = parseInt(process.env.USDC_ASSET_ID || "10458941");
const GLOBAL_POOL_APP_ID = parseInt(process.env.GLOBAL_POOL_APP_ID || "0");
const METAWORK_WALLET = process.env.METAWORK_PLATFORM_WALLET || "WNXGR6DCD4FWCK62JHWNI6OE37XMJGZFHO42FYFEGW5P3G4MYO4AJYJGTI";

// Cost breakdown for creating a product pool
const POOL_CREATION_COST = 111000; // ~0.111 ALGO (box MBR + ASA MBR + fees)

// Safe uint64 encoding (avoids BigInt issues)
function encodeUint64(num) {
  const buf = Buffer.alloc(8);
  const high = Math.floor(num / 0x100000000);
  const low = num % 0x100000000;
  buf.writeUInt32BE(high, 0);
  buf.writeUInt32BE(low, 4);
  return new Uint8Array(buf);
}

// Get compiled global pool programs
function getGlobalPoolPrograms() {
  const contractsDir = path.join(process.cwd(), "contracts");
  const approvalTeal = fs.readFileSync(path.join(contractsDir, "revenue_pool_global_approval.teal"), "utf8");
  const clearTeal = fs.readFileSync(path.join(contractsDir, "revenue_pool_global_clear.teal"), "utf8");
  return { approvalTeal, clearTeal };
}

async function compileTeal(tealSource) {
  const client = getAlgodClient();
  const compiled = await client.compile(tealSource).do();
  return new Uint8Array(Buffer.from(compiled.result, "base64"));
}

/**
 * GET /api/pool/global
 * Get info about the global pool and/or a specific product
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    
    const algodClient = getAlgodClient();
    
    // Check if global pool exists
    if (!GLOBAL_POOL_APP_ID || GLOBAL_POOL_APP_ID === 0) {
      return NextResponse.json({
        success: true,
        globalPoolDeployed: false,
        message: "Global pool not deployed yet"
      });
    }
    
    // Get app info
    let appInfo;
    try {
      appInfo = await algodClient.getApplicationByID(GLOBAL_POOL_APP_ID).do();
    } catch (err) {
      return NextResponse.json({
        success: false,
        error: "Global pool app not found on chain"
      }, { status: 404 });
    }
    
    const appAddress = algosdk.getApplicationAddress(GLOBAL_POOL_APP_ID);
    
    // Get product-specific info if productId provided
    let productInfo = null;
    if (productId) {
      const boxName = Buffer.concat([Buffer.from("p_"), Buffer.from(productId)]);
      try {
        const boxValue = await algodClient.getApplicationBoxByName(GLOBAL_POOL_APP_ID, boxName).do();
        if (boxValue && boxValue.value) {
          const data = Buffer.from(boxValue.value);
          productInfo = {
            productId,
            revenueAsaId: Number(data.readBigUInt64BE(0)),
            totalDeposited: Number(data.readBigUInt64BE(8)),
            totalClaimed: Number(data.readBigUInt64BE(16)),
            poolBalance: Number(data.readBigUInt64BE(8)) - Number(data.readBigUInt64BE(16))
          };
        }
      } catch (err) {
        console.log("Box not found for product:", productId);
      }
    }
    
    return NextResponse.json(safeJson({
      success: true,
      globalPoolDeployed: true,
      appId: GLOBAL_POOL_APP_ID,
      appAddress,
      productInfo,
      creationCost: POOL_CREATION_COST,
      creationCostFormatted: (POOL_CREATION_COST / 1000000).toFixed(3) + " ALGO"
    }));
    
  } catch (error) {
    console.error("GET /api/pool/global error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/pool/global
 * Create a new product pool in the global app
 * Returns transactions for the creator to sign
 */
export async function POST(request) {
  try {
    // Auth check
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.substring(7) || request.cookies.get("auth_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    
    const body = await request.json();
    const { productId, nftAssetId, stakeholders, step } = body;
    
    const { db } = await connectToDatabase();
    const algodClient = getAlgodClient();
    const suggestedParams = await getTransactionParams();
    
    // Get user
    const user = await db.collection("users").findOne({ id: decoded.userId });
    if (!user?.walletAddress) {
      return NextResponse.json({ error: "Wallet not connected" }, { status: 400 });
    }
    
    const creatorAddress = user.walletAddress;
    
    // Check if global pool is deployed
    if (!GLOBAL_POOL_APP_ID || GLOBAL_POOL_APP_ID === 0) {
      return NextResponse.json({ 
        error: "Global pool not deployed. Contact platform admin." 
      }, { status: 400 });
    }
    
    const appAddress = algosdk.getApplicationAddress(GLOBAL_POOL_APP_ID);
    
    // Step 1: Create transactions for pool creation
    if (step === "create_pool" || !step) {
      if (!productId) {
        return NextResponse.json({ error: "productId required" }, { status: 400 });
      }
      
      // Build box key
      const boxName = Buffer.concat([Buffer.from("p_"), Buffer.from(productId)]);
      
      // Check if product already exists
      try {
        const existingBox = await algodClient.getApplicationBoxByName(GLOBAL_POOL_APP_ID, boxName).do();
        if (existingBox) {
          return NextResponse.json({ 
            error: "Product pool already exists",
            existingPool: true 
          }, { status: 400 });
        }
      } catch (err) {
        // Box doesn't exist, which is expected
      }
      
      // Create atomic group: [Payment, AppCall]
      const transactions = [];
      
      // Tx0: Payment to app for MBR
      transactions.push(algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: creatorAddress,
        receiver: appAddress,
        amount: POOL_CREATION_COST,
        suggestedParams: { ...suggestedParams, fee: 1000, flatFee: true }
      }));
      
      // Tx1: AppCall to create_pool
      transactions.push(algosdk.makeApplicationNoOpTxnFromObject({
        sender: creatorAddress,
        appIndex: GLOBAL_POOL_APP_ID,
        appArgs: [
          new Uint8Array(Buffer.from("create_pool")),
          new Uint8Array(Buffer.from(productId))
        ],
        boxes: [{ appIndex: GLOBAL_POOL_APP_ID, name: boxName }],
        suggestedParams: { ...suggestedParams, fee: 2000, flatFee: true }
      }));
      
      // Assign group ID
      algosdk.assignGroupID(transactions);
      
      // Encode for signing
      const txnsBase64 = transactions.map(txn =>
        Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString("base64")
      );
      
      return NextResponse.json(safeJson({
        success: true,
        step: "create_pool",
        productId,
        transactions: txnsBase64,
        transactionCount: transactions.length,
        cost: POOL_CREATION_COST,
        costFormatted: (POOL_CREATION_COST / 1000000).toFixed(3) + " ALGO",
        message: `Sign ${transactions.length} transactions to create your product pool (~${(POOL_CREATION_COST / 1000000).toFixed(3)} ALGO, mostly refundable)`
      }));
    }
    
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    
  } catch (error) {
    console.error("POST /api/pool/global error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/pool/global
 * Handle confirmation of signed transactions
 */
export async function PUT(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.substring(7) || request.cookies.get("auth_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    
    const body = await request.json();
    const { step, productId, signedTxns, ipAssetId } = body;
    
    const { db } = await connectToDatabase();
    const algodClient = getAlgodClient();
    
    // Submit signed transactions
    if (step === "confirm_create_pool") {
      if (!signedTxns || !Array.isArray(signedTxns)) {
        return NextResponse.json({ error: "signedTxns required" }, { status: 400 });
      }
      
      // Submit
      const signedBytes = signedTxns.map(t => new Uint8Array(Buffer.from(t, "base64")));
      const { txid } = await algodClient.sendRawTransaction(signedBytes).do();
      console.log("Pool creation submitted:", txid);
      
      // Wait for confirmation
      const confirmed = await waitForConfirmation(txid, 15);
      console.log("Pool creation confirmed:", confirmed["confirmed-round"]);
      
      // Extract revenue ASA ID from logs
      let revenueAsaId = null;
      if (confirmed.logs) {
        for (const log of confirmed.logs) {
          const logStr = Buffer.from(log, "base64").toString();
          if (logStr.startsWith("rev_asa:")) {
            const asaIdBytes = Buffer.from(log, "base64").slice(8);
            revenueAsaId = Number(asaIdBytes.readBigUInt64BE(0));
            break;
          }
        }
      }
      
      // Fallback: read from box
      if (!revenueAsaId && productId) {
        const boxName = Buffer.concat([Buffer.from("p_"), Buffer.from(productId)]);
        try {
          await new Promise(r => setTimeout(r, 2000)); // Wait for state to settle
          const boxValue = await algodClient.getApplicationBoxByName(GLOBAL_POOL_APP_ID, boxName).do();
          if (boxValue && boxValue.value) {
            revenueAsaId = Number(Buffer.from(boxValue.value).readBigUInt64BE(0));
          }
        } catch (err) {
          console.error("Failed to read box:", err.message);
        }
      }
      
      console.log("Revenue ASA ID:", revenueAsaId);
      
      // Update database if ipAssetId provided
      if (ipAssetId) {
        await db.collection("ip_assets").updateOne(
          { id: ipAssetId },
          {
            $set: {
              globalPoolAppId: GLOBAL_POOL_APP_ID,
              globalPoolProductId: productId,
              revenueTokenAssetId: revenueAsaId,
              revenueTokenId: revenueAsaId,
              status: "pool_created",
              poolCreatedAt: new Date()
            }
          }
        );
      }
      
      return NextResponse.json(safeJson({
        success: true,
        step: "pool_created",
        txId: txid,
        productId,
        revenueAsaId,
        globalPoolAppId: GLOBAL_POOL_APP_ID,
        message: `Product pool created! Revenue ASA ID: ${revenueAsaId}`
      }));
    }
    
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    
  } catch (error) {
    console.error("PUT /api/pool/global error:", error);
    let msg = error.message;
    if (msg.includes("overspend")) msg = "Insufficient ALGO balance";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
