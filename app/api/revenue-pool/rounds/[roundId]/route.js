import { NextResponse } from "next/server";
import algosdk from "algosdk";
import { getAlgodClient } from "@/lib/algorand";
import { safeJson } from "@/lib/utils";

/**
 * GET /api/revenue-pool/rounds/[roundId]?productId=<id>
 * Read a round box and return its header + per-stakeholder entries.
 *
 * Round box layout:
 *   [0..7]   amount     uint64  — total USDC in this round
 *   [8..15]  created    uint64  — unix timestamp
 *   [16..17] nentries   uint16  — number of stakeholder entries
 *   [18+]    entries    41 bytes each:
 *              addr[32] + amount[8] + flag[1]  (0x00=unclaimed, 0x01=claimed)
 */

const GLOBAL_POOL_APP_ID = parseInt(process.env.GLOBAL_POOL_APP_ID || "0");
const RND_ENTRY_SIZE     = 41;

function parseRoundBox(data, roundId, productId) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, "base64");

  const amount   = Number(buf.readBigUInt64BE(0));
  const created  = Number(buf.readBigUInt64BE(8));
  const nentries = buf.readUInt16BE(16);

  const expectedSize = 18 + nentries * RND_ENTRY_SIZE;
  if (buf.length !== expectedSize) {
    throw new Error(`Round box size mismatch: got ${buf.length}, expected ${expectedSize}`);
  }

  const entries = [];
  let allClaimed = true;

  for (let i = 0; i < nentries; i++) {
    const off    = 18 + i * RND_ENTRY_SIZE;
    const addr   = algosdk.encodeAddress(new Uint8Array(buf.slice(off, off + 32)));
    const amt    = Number(buf.readBigUInt64BE(off + 32));
    const flag   = buf[off + 40];
    const claimed = flag === 1;
    if (!claimed) allClaimed = false;

    entries.push({
      address: addr,
      amount: amt,
      amountFormatted: (amt / 1e6).toFixed(6) + " USDC",
      claimed,
    });
  }

  return {
    productId,
    roundId,
    amount,
    amountFormatted: (amount / 1e6).toFixed(6) + " USDC",
    createdAt: created,
    createdAtIso: new Date(created * 1000).toISOString(),
    numEntries: nentries,
    fullySettled: allClaimed,
    entries,
  };
}

export async function GET(request, { params }) {
  try {
    const { roundId: roundIdStr } = await params;
    const roundId = parseInt(roundIdStr);
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) return NextResponse.json({ error: "productId query param required" }, { status: 400 });
    if (!roundId || roundId < 1) return NextResponse.json({ error: "roundId must be >= 1" }, { status: 400 });
    if (!GLOBAL_POOL_APP_ID) return NextResponse.json({ error: "GLOBAL_POOL_APP_ID not configured" }, { status: 500 });

    const algodClient = getAlgodClient();
    const ipIdBytes   = Buffer.from(productId);

    // Build round box key: "rnd_" + ip_id + Itob(round_id)
    const roundIdBuf  = Buffer.alloc(8);
    roundIdBuf.writeBigUInt64BE(BigInt(roundId));
    const roundBoxName = Buffer.concat([Buffer.from("rnd_"), ipIdBytes, roundIdBuf]);

    let boxData;
    try {
      const boxResp = await algodClient.getApplicationBoxByName(GLOBAL_POOL_APP_ID, roundBoxName).do();
      boxData = boxResp.value;
    } catch {
      return NextResponse.json({
        error: `Round ${roundId} not found for product ${productId}`
      }, { status: 404 });
    }

    const round = parseRoundBox(boxData, roundId, productId);

    return NextResponse.json(safeJson({ success: true, round }));

  } catch (error) {
    console.error("GET /api/revenue-pool/rounds/[roundId] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}