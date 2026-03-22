import { NextResponse } from "next/server";
import algosdk from "algosdk";
import { getAlgodClient, getTransactionParams } from "@/lib/algorand";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { safeJson } from "@/lib/utils";

const USDC_ASSET_ID = parseInt(process.env.USDC_ASSET_ID || "10458941");

/**
 * POST /api/ip/reinitialize-pool
 * Reinitialize a pool that was deployed but not properly set up
 */
export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cookieToken = request.cookies.get("auth_token")?.value;
    const token = authHeader?.substring(7) || cookieToken;

    if (!token) return NextResponse.json({ error: "Authorization required" }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await request.json();
    const { ipAssetId } = body;

    const { db } = await connectToDatabase();
    const algodClient = getAlgodClient();

    const ipAsset = await db.collection("ip_assets").findOne({
      id: ipAssetId,
      ownerId: decoded.userId,
    });

    if (!ipAsset) return NextResponse.json({ error: "IP asset not found" }, { status: 404 });
    if (!ipAsset.revenuePoolAppId) return NextResponse.json({ error: "No pool deployed" }, { status: 400 });

    const poolAppId = Number(ipAsset.revenuePoolAppId);
    const poolAddress = algosdk.getApplicationAddress(poolAppId);
    const creatorAddress = ipAsset.ownerWallet;

    // --- SYNC / REPAIR CHECK ---
    // Double check if it's already initialized on-chain before asking to sign anything
    let foundTokenId = null;
    try {
      const appInfo = await algodClient.getApplicationByID(poolAppId).do();
      const globalState = appInfo.params["global-state"] || [];
      const tokenItem = globalState.find(
        (item) => Buffer.from(item.key, "base64").toString() === "rev_token_id"
      );
      if (tokenItem && tokenItem.value.uint > 0) {
        foundTokenId = Number(tokenItem.value.uint);
      }
    } catch (e) {}

    // Fallback: Check created assets
    if (!foundTokenId) {
      try {
        const acct = await algodClient.accountInformation(poolAddress).do();
        const created = acct['created-assets'] || acct.createdAssets || [];
        if (created.length > 0) foundTokenId = Number(created[0].index);
      } catch (e) {}
    }

    if (foundTokenId) {
      await db.collection("ip_assets").updateOne(
        { id: ipAssetId },
        {
          $set: {
            status: "minted",
            revenueTokenAssetId: foundTokenId,
            revenueTokenId: foundTokenId,
          },
        },
      );
      return NextResponse.json({
        success: true,
        alreadyInitialized: true,
        message: "Pool synced successfully.",
        revenueTokenId: foundTokenId,
      });
    }

    // --- LOGIC FOR UNINITIALIZED POOL ---
    // If we are here, the pool is truly uninitialized or partially initialized.

    // Check state to see what steps are missing
    let tokensCreated = false;
    try {
      const appInfo = await algodClient.getApplicationByID(poolAppId).do();
      const globalState = appInfo.params["global-state"] || [];
      const createdFlag = globalState.find(
        (item) => Buffer.from(item.key, "base64").toString() === "tokens_created"
      );
      if (createdFlag && createdFlag.value.uint === 1) tokensCreated = true;
    } catch(e) {}

    // Check balance
    const poolAccount = await algodClient.accountInformation(poolAddress).do();
    const poolBalance = Number(poolAccount.amount);

    const suggestedParams = await getTransactionParams();
    const stakeholders = ipAsset.stakeholders || [];
    const tokenName = `${ipAsset.name} Revenue`.substring(0, 32);
    const unitName = `REV${(ipAssetId || "IP").substring(0, 4).toUpperCase()}`;

    const transactions = [];

    // 1. Fund Pool (if low balance)
    if (poolBalance < 500000) {
      transactions.push(
        algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: creatorAddress,
          receiver: poolAddress,
          amount: 500000 - poolBalance,
          suggestedParams,
        }),
      );
    }

    // 2. Init (if strictly needed, though V2 creates often handle this in one go)
    // We add it just in case it wasn't run
    transactions.push(
      algosdk.makeApplicationNoOpTxnFromObject({
        sender: creatorAddress,
        suggestedParams,
        appIndex: poolAppId,
        appArgs: [new Uint8Array(Buffer.from("init")), new Uint8Array(Buffer.from(ipAssetId))],
      }),
    );

    // 3. Create Tokens (if not already done)
    if (!tokensCreated) {
      transactions.push(
        algosdk.makeApplicationNoOpTxnFromObject({
          sender: creatorAddress,
          suggestedParams: { ...suggestedParams, fee: 2000 },
          appIndex: poolAppId,
          appArgs: [
            new Uint8Array(Buffer.from("create_tokens")),
            new Uint8Array(Buffer.from(tokenName)),
            new Uint8Array(Buffer.from(unitName)),
          ],
        }),
      );
    }

    // 4. Opt-in to USDC (Safety check)
    const poolAssets = poolAccount.assets || [];
    const hasUSDC = poolAssets.some(a => Number(a['asset-id']) === USDC_ASSET_ID);
    if (!hasUSDC) {
      transactions.push(algosdk.makeApplicationNoOpTxnFromObject({
        sender: creatorAddress,
        suggestedParams,
        appIndex: poolAppId,
        appArgs: [new Uint8Array(Buffer.from("opt_in_usdc"))],
        foreignAssets: [USDC_ASSET_ID],
      }));
    }

    // 5. Set Stakeholders
    for (const stakeholder of stakeholders) {
      const cleanPercentage = parseInt(stakeholder.percentage, 10);
      transactions.push(
        algosdk.makeApplicationNoOpTxnFromObject({
          sender: creatorAddress,
          suggestedParams: { ...suggestedParams, fee: 2000 },
          appIndex: poolAppId,
          appArgs: [
            new Uint8Array(Buffer.from("set_stakeholder")),
            algosdk.decodeAddress(stakeholder.address).publicKey,
            algosdk.encodeUint64(cleanPercentage),
          ],
          boxes: [
            {
              appIndex: poolAppId,
              name: Buffer.concat([
                Buffer.from("stk_"),
                algosdk.decodeAddress(stakeholder.address).publicKey,
              ]),
            },
          ],
        }),
      );
    }

    algosdk.assignGroupID(transactions);
    const txnsBase64 = transactions.map((txn) =>
      Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString("base64"),
    );

    return NextResponse.json(safeJson({
      success: true,
      step: "reinit_pool",
      transactions: txnsBase64,
      transactionCount: transactions.length,
      message: `Sign ${transactions.length} transactions to reinitialize pool`,
    }));

  } catch (error) {
    console.error("[reinitialize] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to initialize" }, { status: 500 });
  }
}

/**
 * PUT /api/ip/reinitialize-pool
 * Confirm transactions and sync DB
 */
export async function PUT(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cookieToken = request.cookies.get("auth_token")?.value;
    const token = authHeader?.substring(7) || cookieToken;
    if (!token) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { ipAssetId, signedTxns } = await request.json();
    const { db } = await connectToDatabase();
    const algodClient = getAlgodClient();

    const ipAsset = await db.collection("ip_assets").findOne({ id: ipAssetId });
    if (!ipAsset) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Submit transactions
    const txnBytes = signedTxns.map(t => new Uint8Array(Buffer.from(t, "base64")));
    const { txid } = await algodClient.sendRawTransaction(txnBytes).do();

    // Wait for confirmation
    let confirmed = null;
    for(let i=0; i<15; i++) {
        try {
            await new Promise(r => setTimeout(r, 1000));
            const info = await algodClient.pendingTransactionInformation(txid).do();
            if(info['confirmed-round']) { confirmed = info; break; }
        } catch(e) {}
    }
    if(!confirmed) throw new Error("Transaction confirmation timed out");

    // Fetch Token ID (Retry loop + Robust Check)
    const poolAppId = Number(ipAsset.revenuePoolAppId);
    let revenueTokenId = null;

    // Retry loop for 10 seconds to allow indexer/node to catch up
    for (let i = 0; i < 10; i++) {
        if (revenueTokenId) break;
        await new Promise(r => setTimeout(r, 1000));

        // 1. Check Global State
        try {
            const appInfo = await algodClient.getApplicationByID(poolAppId).do();
            const globalState = appInfo.params?.['global-state'] || [];
            const item = globalState.find(i => Buffer.from(i.key, 'base64').toString() === 'rev_token_id');
            if (item && item.value.uint > 0) {
                revenueTokenId = Number(item.value.uint);
                continue; 
            }
        } catch(e) {}

        // 2. Check Created Assets (Handling both casing styles)
        try {
            const poolAddr = algosdk.getApplicationAddress(poolAppId);
            const acct = await algodClient.accountInformation(poolAddr).do();
            // Check both kebab-case (API) and camelCase (SDK objects)
            const created = acct['created-assets'] || acct.createdAssets || [];
            if (created.length > 0) {
                revenueTokenId = Number(created[0].index);
            }
        } catch(e) {}
    }

    if (!revenueTokenId) {
        return NextResponse.json({ 
            error: "Pool reinitialized, but Token ID not found yet. Please click 'Sync' again in a moment." 
        }, { status: 500 });
    }

    await db.collection("ip_assets").updateOne(
      { id: ipAssetId },
      {
        $set: {
          revenueTokenAssetId: revenueTokenId,
          revenueTokenId: revenueTokenId,
          status: "minted",
        },
      },
    );

    return NextResponse.json(safeJson({
      success: true,
      revenueTokenId,
      message: "Pool successfully reinitialized and synced!"
    }));

  } catch (error) {
    console.error("[reinitialize] PUT Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}