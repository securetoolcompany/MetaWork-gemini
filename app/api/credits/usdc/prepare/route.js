/**
 * app/api/credits/usdc/prepare/route.js
 * Prepares an unsigned USDC (Algorand ASA) asset-transfer transaction so the
 * client can sign it with Pera and settle a credits purchase on-chain.
 * Mirrors the pattern used by
 * app/api/products/[id]/revenue-tokenization/funding/prepare/route.js,
 * swapping makePaymentTxnWithSuggestedParamsFromObject for
 * makeAssetTransferTxnWithSuggestedParamsFromObject.
 */

import { NextResponse } from "next/server";
import algosdk from "algosdk";
import { ObjectId } from "mongodb";
import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { getTransactionParams, getUsdcAssetId } from "@/lib/algorand";

export const dynamic = "force-dynamic";

const ATTEMPT_TTL_MS = 10 * 60 * 1000; // 10 minutes to sign in Pera

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }

    const decoded = verifyToken(authHeader.substring(7));

    if (!decoded?.userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { priceId, walletAddress } = await request.json();

    if (!priceId) {
      return NextResponse.json(
        { error: "priceId is required." },
        { status: 400 }
      );
    }

    if (!walletAddress || !algosdk.isValidAddress(walletAddress)) {
      return NextResponse.json(
        { error: "A valid Algorand wallet address is required." },
        { status: 400 }
      );
    }

    const treasuryAddress = process.env.NEXT_PUBLIC_TREASURY_ADDRESS;

    if (!treasuryAddress || !algosdk.isValidAddress(treasuryAddress)) {
      return NextResponse.json(
        {
          error:
            "NEXT_PUBLIC_TREASURY_ADDRESS is missing or invalid for this deployment.",
        },
        { status: 500 }
      );
    }

    const { db } = await connectToDatabase();

    let pack;

    try {
      pack = await db.collection("creditPacks").findOne({
        _id: new ObjectId(priceId),
        active: true,
      });
    } catch {
      return NextResponse.json({ error: "Invalid priceId." }, { status: 400 });
    }

    if (!pack) {
      return NextResponse.json(
        { error: "Credit pack not found or inactive." },
        { status: 404 }
      );
    }

    const usdcAssetId = getUsdcAssetId('mainnet');

    // USDC on Algorand uses 6 decimal places.
    const amountBaseUnits = Math.round(Number(pack.priceUSDC) * 1_000_000);

    if (!Number.isFinite(amountBaseUnits) || amountBaseUnits <= 0) {
      return NextResponse.json(
        { error: "This credit pack has an invalid USDC price." },
        { status: 500 }
      );
    }

    const suggestedParams = await getTransactionParams('mainnet');

    const usdcTransferTxn =
      algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: walletAddress,
        receiver: treasuryAddress,
        amount: amountBaseUnits,
        assetIndex: usdcAssetId,
        suggestedParams,
      });

    const expectedTransactionId = usdcTransferTxn.txID();

    const txnBase64 = Buffer.from(
      algosdk.encodeUnsignedTransaction(usdcTransferTxn)
    ).toString("base64");

    const now = new Date();

    const attempt = {
      userId: decoded.userId,
      packId: String(pack._id),
      credits: pack.credits,
      amountUsdc: pack.priceUSDC,
      amountBaseUnits,
      usdcAssetId,
      walletAddress,
      treasuryAddress,
      expectedTransactionId,
      status: "awaiting_signature",
      createdAt: now,
      expiresAt: new Date(now.getTime() + ATTEMPT_TTL_MS),
    };

    const insertResult = await db
      .collection("usdcCreditAttempts")
      .insertOne(attempt);

    return NextResponse.json({
      success: true,
      attemptId: insertResult.insertedId.toString(),
      expectedTransactionId,
      transaction: {
        index: 0,
        txnBase64,
        signers: [walletAddress],
      },
      credits: pack.credits,
      amountUsdc: pack.priceUSDC,
      treasuryAddress,
      expiresAt: attempt.expiresAt,
    });
  } catch (error) {
    console.error("[credits/usdc/prepare] failed:", error);

    return NextResponse.json(
      { error: error?.message || "Unable to prepare the USDC payment." },
      { status: 500 }
    );
  }
}