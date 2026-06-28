import { NextResponse } from "next/server";
import algosdk from "algosdk";
import { getAlgodClient, getTransactionParams } from "@/lib/algorand";
import { verifyToken } from "@/lib/auth";
import { safeJson } from "@/lib/utils";

/**
 * POST /api/revenue-pool/deposit-held
 * Admin-only. Moves USDC into the pool's held bucket.
 * Held funds are later atomically distributed via release_held.
 *
 * Body: { productId, amountUsdc }
 * Returns: unsigned transaction group for admin to sign
 *
 * Group layout:
 *   [0] AssetTransfer  — USDC from admin → app address
 *   [1] NoOp           — deposit_held call (companion_idx = 0)
 */

const USDC_ASSET_ID      = parseInt(process.env.USDC_ASSET_ID || "10458941");
const GLOBAL_POOL_APP_ID = parseInt(process.env.GLOBAL_POOL_APP_ID || "0");

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.substring(7) || request.cookies.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: "Authorization required" }, { status: 401 });

    /*const decoded = verifyToken(token);
    if (!decoded?.userId || !decoded?.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }*/

     const isDev = process.env.NODE_ENV === "development";
    if (!isDev) {
      if (!token) return NextResponse.json({ error: "Authorization required" }, { status: 401 });
      const decoded = verifyToken(token);
      if (!decoded?.userId || !decoded?.isAdmin) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const { productId, amountUsdc } = await request.json();

    if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });
    if (!amountUsdc || amountUsdc <= 0) return NextResponse.json({ error: "amountUsdc must be > 0" }, { status: 400 });

    if (!GLOBAL_POOL_APP_ID) return NextResponse.json({ error: "GLOBAL_POOL_APP_ID not configured" }, { status: 500 });

    const algodClient = getAlgodClient();
    const sp          = await getTransactionParams();
    const appAddress  = algosdk.getApplicationAddress(GLOBAL_POOL_APP_ID).toString();

    const adminAddress = process.env.METAWORK_PLATFORM_WALLET;
    if (!adminAddress) return NextResponse.json({ error: "METAWORK_PLATFORM_WALLET not configured" }, { status: 500 });

    // Verify pool box exists
    const boxName = Buffer.concat([Buffer.from("p_"), Buffer.from(productId)]);
    try {
      await algodClient.getApplicationBoxByName(GLOBAL_POOL_APP_ID, boxName).do();
    } catch {
      return NextResponse.json({ error: `Pool not found for productId: ${productId}` }, { status: 404 });
    }

    // [0] USDC transfer — admin sends USDC to app
    const transferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: adminAddress,
      receiver: appAddress,
      amount: amountUsdc,   // in base USDC units (1 USDC = 1,000,000)
      assetIndex: USDC_ASSET_ID,
      suggestedParams: { ...sp, fee: 1000, flatFee: true },
    });

    // [1] deposit_held NoOp — companion_idx = 0
    const appTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: adminAddress,
      appIndex: GLOBAL_POOL_APP_ID,
      appArgs: [
        new Uint8Array(Buffer.from("deposit_held")),
        new Uint8Array(Buffer.from(productId)),
        new Uint8Array(Buffer.alloc(8).fill(0)), // companion_idx = 0
      ],
      boxes: [{ appIndex: GLOBAL_POOL_APP_ID, name: boxName }],
      foreignAssets: [USDC_ASSET_ID],
      suggestedParams: { ...sp, fee: 1000, flatFee: true },
    });

    algosdk.assignGroupID([transferTxn, appTxn]);

    const txnsBase64 = [transferTxn, appTxn].map(txn =>
      Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString("base64")
    );

    return NextResponse.json(safeJson({
      success: true,
      productId,
      amountUsdc,
      amountFormatted: (amountUsdc / 1e6).toFixed(6) + " USDC",
      transactions: txnsBase64,
      transactionCount: 2,
      message: `Sign 2 transactions to deposit ${(amountUsdc / 1e6).toFixed(2)} USDC into held bucket for ${productId}`,
    }));

  } catch (error) {
    console.error("POST /api/revenue-pool/deposit-held error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}