import { NextResponse } from "next/server";
import algosdk from "algosdk";
import { getAlgodClient, getTransactionParams, waitForConfirmation } from "@/lib/algorand";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { safeJson } from "@/lib/utils";

/**
 * Global Pool Claims API
 * 
 * Handles claiming revenue tokens and USDC from the global revenue pool
 * 
 * Revenue Token Flow:
 * 1. User opts-in to revenue ASA
 * 2. User calls claim_rev_tokens to receive their allocation
 * 
 * USDC Revenue Flow:
 * 1. User holds revenue tokens
 * 2. User calls claim_revenue to receive pro-rata USDC
 */

const USDC_ASSET_ID = parseInt(process.env.USDC_ASSET_ID || "10458941");
const GLOBAL_POOL_APP_ID = parseInt(process.env.GLOBAL_POOL_APP_ID || "0");

// Safe uint64 encoding
function encodeUint64(num) {
  const buf = Buffer.alloc(8);
  const high = Math.floor(num / 0x100000000);
  const low = num % 0x100000000;
  buf.writeUInt32BE(high, 0);
  buf.writeUInt32BE(low, 4);
  return new Uint8Array(buf);
}

/**
 * GET /api/pool/global/claims
 * Get claimable tokens and revenue for a user
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get("userAddress");
    
    if (!userAddress) {
      return NextResponse.json({ error: "userAddress required" }, { status: 400 });
    }
    
    if (!GLOBAL_POOL_APP_ID || GLOBAL_POOL_APP_ID === 0) {
      return NextResponse.json({ 
        success: true,
        globalPoolDeployed: false,
        claimableTokens: [],
        claimableRevenue: []
      });
    }
    
    const { db } = await connectToDatabase();
    const algodClient = getAlgodClient();
    
    // Get user's assets
    let userAssets = [];
    try {
      const accountInfo = await algodClient.accountInformation(userAddress).do();
      userAssets = accountInfo.assets || [];
    } catch (err) {
      console.error("Failed to fetch account:", err.message);
    }
    
    // Find IPs where user is a stakeholder and using global pool
    const userRegex = new RegExp(`^${userAddress}$`, "i");
    const ips = await db.collection("ip_assets").find({
      $and: [
        { globalPoolAppId: GLOBAL_POOL_APP_ID },
        { "stakeholders.address": { $regex: userRegex } }
      ]
    }).toArray();
    
    const claimableTokens = [];
    const claimableRevenue = [];
    
    for (const ip of ips) {
      const stakeholder = ip.stakeholders?.find(s =>
        s.address?.toLowerCase() === userAddress.toLowerCase()
      );
      if (!stakeholder) continue;
      
      const revenueAsaId = Number(ip.revenueTokenAssetId || ip.revenueTokenId);
      if (!revenueAsaId) continue;
      
      // Check if user has opted in and their balance
      const userAsset = userAssets.find(a => Number(a["asset-id"]) === revenueAsaId);
      const hasOptedIn = !!userAsset;
      const tokenBalance = userAsset ? Number(userAsset.amount) : 0;
      
      // Allocation: stakeholder percentage as tokens (100 total)
      const allocatedTokens = Math.floor(Number(stakeholder.percentage));
      const claimableAmount = Math.max(0, allocatedTokens - tokenBalance);
      
      claimableTokens.push({
        ipId: ip.id,
        ipName: ip.name,
        imageUrl: ip.imageUrl,
        productId: ip.globalPoolProductId,
        revenueAsaId,
        stakeholderPercentage: Number(stakeholder.percentage),
        allocatedTokens,
        tokenBalance,
        claimableAmount,
        hasOptedIn,
        needsOptIn: !hasOptedIn
      });
      
      // Get pool balance for revenue claims
      if (hasOptedIn && tokenBalance > 0 && ip.globalPoolProductId) {
        const boxName = Buffer.concat([Buffer.from("p_"), Buffer.from(ip.globalPoolProductId)]);
        try {
          const boxValue = await algodClient.getApplicationBoxByName(GLOBAL_POOL_APP_ID, boxName).do();
          if (boxValue && boxValue.value) {
            const data = Buffer.from(boxValue.value);
            const totalDeposited = Number(data.readBigUInt64BE(8));
            const totalClaimed = Number(data.readBigUInt64BE(16));
            const poolBalance = totalDeposited - totalClaimed;
            
            // Pro-rata share: (poolBalance * tokenBalance) / 100
            const userShare = Math.floor((poolBalance * tokenBalance) / 100);
            
            if (userShare > 0) {
              claimableRevenue.push({
                ipId: ip.id,
                ipName: ip.name,
                productId: ip.globalPoolProductId,
                tokenBalance,
                poolBalance,
                poolBalanceFormatted: (poolBalance / 1000000).toFixed(2),
                userShare,
                userShareFormatted: (userShare / 1000000).toFixed(2)
              });
            }
          }
        } catch (err) {
          console.log("Box not found:", ip.globalPoolProductId);
        }
      }
    }
    
    return NextResponse.json(safeJson({
      success: true,
      globalPoolDeployed: true,
      globalPoolAppId: GLOBAL_POOL_APP_ID,
      claimableTokens,
      claimableRevenue,
      totalClaimableTokens: claimableTokens.reduce((sum, t) => sum + t.claimableAmount, 0),
      totalClaimableUSDC: claimableRevenue.reduce((sum, r) => sum + r.userShare, 0)
    }));
    
  } catch (error) {
    console.error("GET /api/pool/global/claims error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/pool/global/claims
 * Create claim transactions
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, userAddress, productId, revenueAsaId, amount } = body;
    
    if (!userAddress) {
      return NextResponse.json({ error: "userAddress required" }, { status: 400 });
    }
    
    if (!GLOBAL_POOL_APP_ID || GLOBAL_POOL_APP_ID === 0) {
      return NextResponse.json({ error: "Global pool not deployed" }, { status: 400 });
    }
    
    const algodClient = getAlgodClient();
    const suggestedParams = await getTransactionParams();
    const appAddress = algosdk.getApplicationAddress(GLOBAL_POOL_APP_ID);
    
    // Create opt-in transaction for revenue ASA
    if (action === "opt_in") {
      if (!revenueAsaId) {
        return NextResponse.json({ error: "revenueAsaId required" }, { status: 400 });
      }
      
      const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: userAddress,
        receiver: userAddress,
        amount: 0,
        assetIndex: Number(revenueAsaId),
        suggestedParams: { ...suggestedParams, fee: 1000, flatFee: true }
      });
      
      return NextResponse.json(safeJson({
        success: true,
        action: "opt_in",
        transaction: Buffer.from(algosdk.encodeUnsignedTransaction(optInTxn)).toString("base64"),
        message: "Sign to opt-in to the revenue token"
      }));
    }
    
    // Create claim_rev_tokens transaction
    if (action === "claim_tokens") {
      if (!productId || !amount) {
        return NextResponse.json({ error: "productId and amount required" }, { status: 400 });
      }
      
      const boxName = Buffer.concat([Buffer.from("p_"), Buffer.from(productId)]);
      
      // Get revenue ASA ID from box if not provided
      let asaId = revenueAsaId;
      if (!asaId) {
        const boxValue = await algodClient.getApplicationBoxByName(GLOBAL_POOL_APP_ID, boxName).do();
        if (boxValue && boxValue.value) {
          asaId = Number(Buffer.from(boxValue.value).readBigUInt64BE(0));
        }
      }
      
      if (!asaId) {
        return NextResponse.json({ error: "Could not find revenue ASA" }, { status: 400 });
      }
      
      const claimTxn = algosdk.makeApplicationNoOpTxnFromObject({
        sender: userAddress,
        appIndex: GLOBAL_POOL_APP_ID,
        appArgs: [
          new Uint8Array(Buffer.from("claim_rev_tokens")),
          new Uint8Array(Buffer.from(productId)),
          encodeUint64(Number(amount))
        ],
        foreignAssets: [Number(asaId)],
        boxes: [{ appIndex: GLOBAL_POOL_APP_ID, name: boxName }],
        suggestedParams: { ...suggestedParams, fee: 2000, flatFee: true }
      });
      
      return NextResponse.json(safeJson({
        success: true,
        action: "claim_tokens",
        transaction: Buffer.from(algosdk.encodeUnsignedTransaction(claimTxn)).toString("base64"),
        amount: Number(amount),
        message: `Sign to claim ${amount} revenue tokens`
      }));
    }
    
    // Create claim_revenue transaction (for USDC)
    if (action === "claim_revenue") {
      if (!productId) {
        return NextResponse.json({ error: "productId required" }, { status: 400 });
      }
      
      // Get user's token balance
      const accountInfo = await algodClient.accountInformation(userAddress).do();
      const boxName = Buffer.concat([Buffer.from("p_"), Buffer.from(productId)]);
      const boxValue = await algodClient.getApplicationBoxByName(GLOBAL_POOL_APP_ID, boxName).do();
      
      if (!boxValue || !boxValue.value) {
        return NextResponse.json({ error: "Product pool not found" }, { status: 404 });
      }
      
      const revenueAsaIdFromBox = Number(Buffer.from(boxValue.value).readBigUInt64BE(0));
      const userAsset = accountInfo.assets?.find(a => Number(a["asset-id"]) === revenueAsaIdFromBox);
      
      if (!userAsset || userAsset.amount === 0) {
        return NextResponse.json({ error: "You don't hold any revenue tokens" }, { status: 400 });
      }
      
      const tokenBalance = Number(userAsset.amount);
      
      const claimTxn = algosdk.makeApplicationNoOpTxnFromObject({
        sender: userAddress,
        appIndex: GLOBAL_POOL_APP_ID,
        appArgs: [
          new Uint8Array(Buffer.from("claim_revenue")),
          new Uint8Array(Buffer.from(productId)),
          encodeUint64(tokenBalance)
        ],
        foreignAssets: [USDC_ASSET_ID],
        boxes: [{ appIndex: GLOBAL_POOL_APP_ID, name: boxName }],
        suggestedParams: { ...suggestedParams, fee: 2000, flatFee: true }
      });
      
      return NextResponse.json(safeJson({
        success: true,
        action: "claim_revenue",
        transaction: Buffer.from(algosdk.encodeUnsignedTransaction(claimTxn)).toString("base64"),
        tokenBalance,
        message: "Sign to claim your USDC revenue"
      }));
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    
  } catch (error) {
    console.error("POST /api/pool/global/claims error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/pool/global/claims
 * Submit signed claim transactions
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const { signedTxn, action } = body;
    
    if (!signedTxn) {
      return NextResponse.json({ error: "signedTxn required" }, { status: 400 });
    }
    
    const algodClient = getAlgodClient();
    
    // Submit transaction
    const signedBytes = new Uint8Array(Buffer.from(signedTxn, "base64"));
    const { txid } = await algodClient.sendRawTransaction(signedBytes).do();
    console.log("Claim transaction submitted:", txid);
    
    // Wait for confirmation
    const confirmed = await waitForConfirmation(txid, 15);
    console.log("Claim confirmed:", confirmed["confirmed-round"]);
    
    return NextResponse.json(safeJson({
      success: true,
      txId: txid,
      confirmedRound: confirmed["confirmed-round"],
      action,
      message: `${action} successful!`
    }));
    
  } catch (error) {
    console.error("PUT /api/pool/global/claims error:", error);
    let msg = error.message;
    if (msg.includes("overspend")) msg = "Insufficient balance";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
