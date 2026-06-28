import { NextResponse } from "next/server";
import algosdk from "algosdk";
import { getAlgodClient, getTransactionParams, waitForConfirmation } from "@/lib/algorand";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { safeJson } from "@/lib/utils";

/**
 * Global Revenue Pool API — V7
 *
 * GET  /api/pool/global?productId=<id>   Read pool box state
 * POST /api/pool/global                  Build create_pool transaction group
 * PUT  /api/pool/global                  Submit signed transactions + persist to DB
 */

const USDC_ASSET_ID      = parseInt(process.env.USDC_ASSET_ID || "10458941");
const GLOBAL_POOL_APP_ID = parseInt(process.env.GLOBAL_POOL_APP_ID || "0");
const METAWORK_WALLET    = process.env.METAWORK_PLATFORM_WALLET;
const METAWORK_BPS       = 2000;   // MetaWork's fixed 20% cut
const TOTAL_BPS          = 10000;
const MAX_STAKEHOLDERS   = 100;    // contract hard-cap

// ---------------------------------------------------------------------------
// Pool box offsets — verified against smoke test (143-byte box, 2 stakeholders)
// ---------------------------------------------------------------------------
const OFFSETS = {
  REV_ASA:      0,
  UNALLOCATED:  8,
  TOTAL_CLM:    16,
  HELD:         24,
  CUR_ROUND:    32,
  NUM_SH:       40,   // 1 byte
  PROXY_ADDR:   41,   // 32 bytes
  ENTRIES:      73,   // stakeholder entries start here
};
const SH_ENTRY_SIZE = 35; // addr(32) + bps(2) + flag(1)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read an 8-byte big-endian uint64 from a Buffer at offset. */
function readU64(buf, offset) {
  return Number(buf.readBigUInt64BE(offset));
}

/** Read a 2-byte big-endian uint16 from a Buffer at offset. */
function readU16(buf, offset) {
  return buf.readUInt16BE(offset);
}

/**
 * Parse the full pool box into a structured object.
 * Throws if the buffer is smaller than the minimum 73-byte header.
 */
function parsePoolBox(data, productId) {
  const buf = Buffer.from(data);
  if (buf.length < OFFSETS.ENTRIES) {
    throw new Error(`Pool box too small: ${buf.length} bytes`);
  }

  const numSh = buf[OFFSETS.NUM_SH];
  const expectedSize = OFFSETS.ENTRIES + numSh * SH_ENTRY_SIZE;
  if (buf.length !== expectedSize) {
    throw new Error(`Pool box size mismatch: got ${buf.length}, expected ${expectedSize}`);
  }

  const stakeholders = [];
  for (let i = 0; i < numSh; i++) {
    const off  = OFFSETS.ENTRIES + i * SH_ENTRY_SIZE;
    const addr = algosdk.encodeAddress(new Uint8Array(buf.slice(off, off + 32)));
    const bps  = readU16(buf, off + 32);
    const flag = buf[off + 34]; // 0x00 = UNCLAIMED, 0x01 = CLAIMED (token)
    stakeholders.push({ address: addr, bps, tokenClaimed: flag === 1 });
  }

  const proxyAddrBytes = buf.slice(OFFSETS.PROXY_ADDR, OFFSETS.PROXY_ADDR + 32);
  const proxyAddr = proxyAddrBytes.every(b => b === 0)
    ? null
    : algosdk.encodeAddress(new Uint8Array(proxyAddrBytes));

  const unallocated = readU64(buf, OFFSETS.UNALLOCATED);
  const totalClaimed = readU64(buf, OFFSETS.TOTAL_CLM);
  const held = readU64(buf, OFFSETS.HELD);
  const curRound = readU64(buf, OFFSETS.CUR_ROUND);

  return {
    productId,
    revenueAsaId:  readU64(buf, OFFSETS.REV_ASA),
    unallocated,
    totalClaimed,
    held,
    curRound,
    numStakeholders: numSh,
    proxyAddress: proxyAddr,
    stakeholders,
    // Derived — total liquid USDC available to distribute
    availableToRelease: held,
    // Liquidity sitting in pool not yet in any round
    unallocatedUsdc: unallocated,
  };
}

/**
 * Encode stakeholder array into the 34-byte-per-entry format expected by
 * create_pool: addr[32] + bps[2] (big-endian uint16).
 * Note: this is the INPUT format (no flag byte — contract writes that).
 */
function packStakeholders(stakeholders) {
  const buf = Buffer.alloc(stakeholders.length * 34);
  for (let i = 0; i < stakeholders.length; i++) {
    const addrBytes = Buffer.from(algosdk.decodeAddress(stakeholders[i].address).publicKey);
    addrBytes.copy(buf, i * 34);
    buf.writeUInt16BE(stakeholders[i].bps, i * 34 + 32);
  }
  return buf;
}

/**
 * Calculate pool box MBR in microAlgo.
 * Formula from contract: 2500 + 400 * (75 + len(ip_id) + sh_count * 35)
 */
function calcPoolMbr(ipIdBytes, shCount) {
  return 2500 + 400 * (75 + ipIdBytes.length + shCount * 35);
}

// ---------------------------------------------------------------------------
// GET /api/pool/global
// ---------------------------------------------------------------------------
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!GLOBAL_POOL_APP_ID || GLOBAL_POOL_APP_ID === 0) {
      return NextResponse.json({ success: true, globalPoolDeployed: false });
    }

    const algodClient = getAlgodClient();
    const appAddress  = algosdk.getApplicationAddress(GLOBAL_POOL_APP_ID).toString();

    let appInfo;
    try {
      appInfo = await algodClient.getApplicationByID(GLOBAL_POOL_APP_ID).do();
    } catch {
      return NextResponse.json({ success: false, error: "Global pool app not found on chain" }, { status: 404 });
    }

    let productInfo = null;
    if (productId) {
      const boxName = Buffer.concat([Buffer.from("p_"), Buffer.from(productId)]);
      try {
        const boxResp = await algodClient.getApplicationBoxByName(GLOBAL_POOL_APP_ID, boxName).do();
        if (boxResp?.value) {
          productInfo = parsePoolBox(Buffer.from(boxResp.value, "base64"), productId);
        }
      } catch (err) {
        console.log("Box not found for product:", productId, err.message);
      }
    }

    return NextResponse.json(safeJson({
      success: true,
      globalPoolDeployed: true,
      appId: GLOBAL_POOL_APP_ID,
      appAddress,
      productInfo,
    }));

  } catch (error) {
    console.error("GET /api/pool/global error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/pool/global  — build create_pool transaction group
// ---------------------------------------------------------------------------
export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.substring(7) || request.cookies.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: "Authorization required" }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await request.json();
    const { productId, tokenName, tokenUnit, stakeholders } = body;

    if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });
    if (!tokenName) return NextResponse.json({ error: "tokenName required" }, { status: 400 });
    if (!tokenUnit) return NextResponse.json({ error: "tokenUnit required" }, { status: 400 });
    if (!Array.isArray(stakeholders) || stakeholders.length === 0) {
      return NextResponse.json({ error: "stakeholders array required" }, { status: 400 });
    }

    if (!METAWORK_WALLET) {
      return NextResponse.json({ error: "METAWORK_PLATFORM_WALLET not configured" }, { status: 500 });
    }

    // Validate user-submitted stakeholders sum to 8000 (remainder after MetaWork's 2000)
    const userBpsSum = stakeholders.reduce((sum, s) => sum + s.bps, 0);
    if (userBpsSum !== TOTAL_BPS - METAWORK_BPS) {
      return NextResponse.json({
        error: `Stakeholder BPS must sum to ${TOTAL_BPS - METAWORK_BPS} (MetaWork takes the remaining ${METAWORK_BPS}). Got ${userBpsSum}.`
      }, { status: 400 });
    }

    // Prepend MetaWork entry — always first
    const allStakeholders = [
      { address: METAWORK_WALLET, bps: METAWORK_BPS },
      ...stakeholders,
    ];

    if (allStakeholders.length > MAX_STAKEHOLDERS) {
      return NextResponse.json({
        error: `Total stakeholders (${allStakeholders.length}) exceeds contract limit of ${MAX_STAKEHOLDERS}`
      }, { status: 400 });
    }

    // Validate all addresses
    for (const s of allStakeholders) {
      if (!algosdk.isValidAddress(s.address)) {
        return NextResponse.json({ error: `Invalid address: ${s.address}` }, { status: 400 });
      }
      if (!Number.isInteger(s.bps) || s.bps <= 0 || s.bps > TOTAL_BPS) {
        return NextResponse.json({ error: `Invalid BPS value for ${s.address}: ${s.bps}` }, { status: 400 });
      }
    }

    const { db }          = await connectToDatabase();
    const algodClient     = getAlgodClient();
    const suggestedParams = await getTransactionParams();
    const appAddress      = algosdk.getApplicationAddress(GLOBAL_POOL_APP_ID);

    // Get creator address from DB
    const user = await db.collection("users").findOne({ id: decoded.userId });
    if (!user?.walletAddress) {
      return NextResponse.json({ error: "Wallet not connected" }, { status: 400 });
    }
    const creatorAddress = user.walletAddress;

    // Check pool doesn't already exist
    const ipIdBytes = Buffer.from(productId);
    const boxName   = Buffer.concat([Buffer.from("p_"), ipIdBytes]);
    try {
      await algodClient.getApplicationBoxByName(GLOBAL_POOL_APP_ID, boxName).do();
      return NextResponse.json({ error: "Product pool already exists", existingPool: true }, { status: 400 });
    } catch {
      // Expected — box doesn't exist yet
    }

    const shBytes  = packStakeholders(allStakeholders);
    const mbr      = calcPoolMbr(ipIdBytes, allStakeholders.length);

    // Group:
    //   [0] Payment  → app address for pool box MBR
    //   [1] NoOp     → create_pool (companion_idx arg = 0)
    const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: creatorAddress,
      receiver: appAddress,
      amount: mbr,
      suggestedParams: { ...suggestedParams, fee: 1000, flatFee: true },
    });

    const appTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: creatorAddress,
      appIndex: GLOBAL_POOL_APP_ID,
      appArgs: [
        new Uint8Array(Buffer.from("create_pool")),
        new Uint8Array(ipIdBytes),
        new Uint8Array(Buffer.from(tokenName)),
        new Uint8Array(Buffer.from(tokenUnit)),
        new Uint8Array(shBytes),
        new Uint8Array(Buffer.alloc(8).fill(0)), // companion_idx = 0
      ],
      boxes: [{ appIndex: GLOBAL_POOL_APP_ID, name: boxName }],
      foreignAssets: [USDC_ASSET_ID],
      suggestedParams: {
        ...suggestedParams,
        fee: 3000, // covers outer + 2 inner txns (USDC opt-in + ASA create)
        flatFee: true,
      },
    });

    algosdk.assignGroupID([payTxn, appTxn]);

    const txnsBase64 = [payTxn, appTxn].map(txn =>
      Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString("base64")
    );

    return NextResponse.json(safeJson({
      success: true,
      productId,
      transactions: txnsBase64,
      transactionCount: 2,
      mbr,
      mbrFormatted: (mbr / 1e6).toFixed(6) + " ALGO",
      stakeholderCount: allStakeholders.length,
      message: `Sign 2 transactions to create pool for ${productId} (${(mbr / 1e6).toFixed(6)} ALGO MBR)`,
    }));

  } catch (error) {
    console.error("POST /api/pool/global error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/pool/global  — submit signed transactions + persist to DB
// ---------------------------------------------------------------------------
export async function PUT(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.substring(7) || request.cookies.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: "Authorization required" }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await request.json();
    const { productId, signedTxns, ipAssetId } = body;

    if (!signedTxns || !Array.isArray(signedTxns)) {
      return NextResponse.json({ error: "signedTxns array required" }, { status: 400 });
    }

    const { db }      = await connectToDatabase();
    const algodClient = getAlgodClient();

    const signedBytes = signedTxns.map(t => new Uint8Array(Buffer.from(t, "base64")));
    const { txid }    = await algodClient.sendRawTransaction(signedBytes).do();
    console.log("Pool creation submitted:", txid);

    const confirmed = await waitForConfirmation(txid, 15);
    console.log("Pool creation confirmed in round:", confirmed["confirmed-round"]);

    // Extract revenue ASA ID from the "asset_id:<uint64>" log emitted by contract
    let revenueAsaId = null;
    if (confirmed.logs) {
      for (const log of confirmed.logs) {
        const decoded = Buffer.from(log, "base64");
        if (decoded.slice(0, 9).toString() === "asset_id:") {
          revenueAsaId = Number(decoded.readBigUInt64BE(9));
          break;
        }
      }
    }

    // Fallback: read directly from box offset 0
    if (!revenueAsaId && productId) {
      const boxName = Buffer.concat([Buffer.from("p_"), Buffer.from(productId)]);
      try {
        await new Promise(r => setTimeout(r, 2000));
        const boxResp = await algodClient.getApplicationBoxByName(GLOBAL_POOL_APP_ID, boxName).do();
        if (boxResp?.value) {
          revenueAsaId = Number(Buffer.from(boxResp.value, "base64").readBigUInt64BE(0));
        }
      } catch (err) {
        console.error("Fallback box read failed:", err.message);
      }
    }

    // Persist to DB
    if (ipAssetId) {
      await db.collection("ip_assets").updateOne(
        { id: ipAssetId },
        {
          $set: {
            globalPoolAppId:      GLOBAL_POOL_APP_ID,
            globalPoolProductId:  productId,
            revenueTokenAssetId:  revenueAsaId,
            status:               "pool_created",
            poolCreatedAt:        new Date(),
          },
        }
      );
    }

    return NextResponse.json(safeJson({
      success: true,
      txId: txid,
      productId,
      revenueAsaId,
      globalPoolAppId: GLOBAL_POOL_APP_ID,
      message: `Pool created. Revenue token ASA: ${revenueAsaId}`,
    }));

  } catch (error) {
    console.error("PUT /api/pool/global error:", error);
    const msg = error.message?.includes("overspend") ? "Insufficient ALGO balance" : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}