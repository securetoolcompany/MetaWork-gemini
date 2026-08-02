// app/api/ip/pool-funding/route.js
import { NextResponse } from "next/server";
import algosdk from "algosdk";
import { getAlgodClient, waitForConfirmation } from "@/lib/algorand";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { safeJson } from "@/lib/utils";

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

    const { ipAssetId, signedMbrTxn, mbrAmount } = await request.json();
    if (!ipAssetId || !signedMbrTxn || !mbrAmount) {
      return NextResponse.json(
        { error: "ipAssetId, signedMbrTxn, and mbrAmount are required" },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();
    const ipAsset = await db.collection("ip_assets").findOne({ id: ipAssetId });
    if (!ipAsset) {
      return NextResponse.json(
        { error: "IP asset not found" },
        { status: 404 },
      );
    }

    if (String(ipAsset.ownerId) !== String(decoded.userId)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 },
      );
    }

    const algod = getAlgodClient("testnet");
    const raw = new Uint8Array(Buffer.from(signedMbrTxn, "base64"));

    // Submit user → platform payment
    const { txid } = await algod.sendRawTransaction(raw).do();
    await waitForConfirmation(txid, 10);

    // Record payment on IP asset
    await db.collection("ip_assets").updateOne(
      { id: ipAssetId },
      {
        $set: {
          mbrPaidMicroAlgos: Number(mbrAmount),
          mbrPaymentTxId: txid,
        },
      },
    );

    return NextResponse.json(
      safeJson({
        success: true,
        ipAssetId,
        mbrAmount: Number(mbrAmount),
        mbrPaymentTxId: txid,
      }),
    );
  } catch (error) {
    console.error("Pool Funding POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}