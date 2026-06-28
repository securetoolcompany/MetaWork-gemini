import { NextResponse } from "next/server";
import algosdk from "algosdk";
import { getAlgodClient, getTransactionParams } from "@/lib/algorand";
import { verifyToken } from "@/lib/auth";
import { safeJson } from "@/lib/utils";

/**
 * POST /api/revenue-pool/release-held
 * Admin-only. Atomically snapshots held USDC into a new round box,
 * writing one entry per stakeholder with their floor(held*bps/10000) amount.
 * Dust from integer division stays in unallocated.
 *
 * Body: { productId }
 * Returns: unsigned transaction group for admin to sign
 *
 * Group layout:
 *   [0] Payment   — ALGO to app address covering round box MBR
 *   [1] NoOp      — release_held call (companion_idx = 0)
 *
 * Round box MBR formula (from contract):
 *   2500 + 400 * (12 + len(ip_id) + RND_ENTRIES_OFFSET + sh_count * RND_ENTRY_SIZE)
 *   where RND_ENTRIES_OFFSET = 18, RND_ENTRY_SIZE = 41
 */

const GLOBAL_POOL_APP_ID = parseInt(process.env.GLOBAL_POOL_APP_ID || "0");

// Pool box offsets needed to read sh_count
const NUM_SH_OFFSET       = 40;
const POOL_ENTRIES_OFFSET = 73;
const SH_ENTRY_SIZE       = 35;

// Round box constants
const RND_ENTRIES_OFFSET = 18;
const RND_ENTRY_SIZE     = 41;

function calcRoundMbr(ipIdLength, shCount) {
  const roundSize = RND_ENTRIES_OFFSET + shCount * RND_ENTRY_SIZE;
  return 2500 + 400 * (12 + ipIdLength + roundSize);
}

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

    const { productId } = await request.json();
    if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });
    if (!GLOBAL_POOL_APP_ID) return NextResponse.json({ error: "GLOBAL_POOL_APP_ID not configured" }, { status: 500 });

    const adminAddress = process.env.METAWORK_PLATFORM_WALLET;
    if (!adminAddress) return NextResponse.json({ error: "METAWORK_PLATFORM_WALLET not configured" }, { status: 500 });

    const algodClient = getAlgodClient();
    const sp          = await getTransactionParams();
    const appAddress  = algosdk.getApplicationAddress(GLOBAL_POOL_APP_ID).toString();

    // Read pool box to get sh_count and verify held > 0
    const ipIdBytes = Buffer.from(productId);
    const boxName   = Buffer.concat([Buffer.from("p_"), ipIdBytes]);

    let boxData;
    try {
      const boxResp = await algodClient.getApplicationBoxByName(GLOBAL_POOL_APP_ID, boxName).do();
      boxData = Buffer.from(boxResp.value, "base64");
    } catch {
      return NextResponse.json({ error: `Pool not found for productId: ${productId}` }, { status: 404 });
    }

    const held   = Number(boxData.readBigUInt64BE(24));  // HELD_OFFSET = 24
    const shCount = boxData[NUM_SH_OFFSET];

    if (held === 0) {
      return NextResponse.json({ error: "No held USDC to release. Call deposit_held first." }, { status: 400 });
    }

    const mbr = calcRoundMbr(ipIdBytes.length, shCount);

    // Determine what the next round number will be (for the round box reference)
    const curRound  = Number(boxData.readBigUInt64BE(32)); // CUR_ROUND_OFFSET = 32
    const nextRound = curRound + 1;
    const roundBoxName = Buffer.concat([
      Buffer.from("rnd_"),
      ipIdBytes,
      Buffer.from(BigInt(nextRound).toString(16).padStart(16, "0"), "hex"),
    ]);

    // [0] Payment — ALGO to cover round box MBR
    const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: adminAddress,
      receiver: appAddress,
      amount: mbr,
      suggestedParams: { ...sp, fee: 1000, flatFee: true },
    });

    // [1] release_held NoOp — companion_idx = 0
    const appTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: adminAddress,
      appIndex: GLOBAL_POOL_APP_ID,
      appArgs: [
        new Uint8Array(Buffer.from("release_held")),
        new Uint8Array(ipIdBytes),
        new Uint8Array(Buffer.alloc(8).fill(0)), // companion_idx = 0
      ],
      boxes: [
        { appIndex: GLOBAL_POOL_APP_ID, name: boxName },
        { appIndex: GLOBAL_POOL_APP_ID, name: roundBoxName },
      ],
      suggestedParams: { ...sp, fee: 1000, flatFee: true },
    });

    algosdk.assignGroupID([payTxn, appTxn]);

    const txnsBase64 = [payTxn, appTxn].map(txn =>
      Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString("base64")
    );

    return NextResponse.json(safeJson({
      success: true,
      productId,
      heldUsdc: held,
      heldFormatted: (held / 1e6).toFixed(6) + " USDC",
      nextRound,
      roundBoxMbr: mbr,
      roundBoxMbrFormatted: (mbr / 1e6).toFixed(6) + " ALGO",
      stakeholderCount: shCount,
      transactions: txnsBase64,
      transactionCount: 2,
      message: `Sign 2 transactions to release ${(held / 1e6).toFixed(2)} USDC into round ${nextRound} for ${shCount} stakeholders`,
    }));

  } catch (error) {
    console.error("POST /api/revenue-pool/release-held error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}