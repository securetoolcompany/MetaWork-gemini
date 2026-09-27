/**
 * app/api/credits/usdc/submit/route.js
 * Broadcasts the Pera-signed USDC asset-transfer transaction, waits for
 * Algorand confirmation, verifies the on-chain result matches the prepared
 * attempt, and grants credits via the shared addCredits() helper.
 * Mirrors app/api/products/[id]/revenue-tokenization/funding/submit/route.js.
 */

import { NextResponse } from "next/server";
import algosdk from "algosdk";
import { ObjectId } from "mongodb";
import { verifyToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { getAlgodClient, waitForConfirmation } from "@/lib/algorand";
import { addCredits } from "@/lib/credits";

export const dynamic = "force-dynamic";

function decodeSignedTransactionBase64(signedTransactionBase64) {
  if (
    typeof signedTransactionBase64 !== "string" ||
    !signedTransactionBase64.trim()
  ) {
    throw new Error("A signed transaction is required.");
  }

  const signedTransactionBytes = Uint8Array.from(
    Buffer.from(signedTransactionBase64, "base64")
  );

  try {
    return {
      signedTransactionBytes,
      signedTransaction: algosdk.decodeSignedTransaction(
        signedTransactionBytes
      ),
    };
  } catch {
    throw new Error("Unable to decode the signed transaction.");
  }
}

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

    const { attemptId, expectedTransactionId, signedTransactionBase64 } =
      await request.json();

    if (!attemptId || !expectedTransactionId || !signedTransactionBase64) {
      return NextResponse.json(
        { error: "attemptId, expectedTransactionId, and signedTransactionBase64 are required." },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    let attempt;

    try {
      attempt = await db.collection("usdcCreditAttempts").findOne({
        _id: new ObjectId(attemptId),
      });
    } catch {
      return NextResponse.json({ error: "Invalid attemptId." }, { status: 400 });
    }

    if (!attempt) {
      return NextResponse.json(
        { error: "USDC payment attempt not found." },
        { status: 404 }
      );
    }

    if (String(attempt.userId) !== String(decoded.userId)) {
      return NextResponse.json(
        { error: "This payment attempt does not belong to you." },
        { status: 403 }
      );
    }

    if (attempt.status === "confirmed") {
      return NextResponse.json(
        { error: "This payment has already been credited." },
        { status: 409 }
      );
    }

    if (attempt.status !== "awaiting_signature") {
      return NextResponse.json(
        { error: `This payment attempt is ${attempt.status} and can't be submitted.` },
        { status: 409 }
      );
    }

    if (new Date(attempt.expiresAt).getTime() < Date.now()) {
      await db.collection("usdcCreditAttempts").updateOne(
        { _id: attempt._id },
        { $set: { status: "expired" } }
      );

      return NextResponse.json(
        { error: "This prepared payment has expired. Please try again." },
        { status: 410 }
      );
    }

    if (attempt.expectedTransactionId !== expectedTransactionId) {
      return NextResponse.json(
        { error: "The submitted transaction does not match the prepared payment." },
        { status: 400 }
      );
    }

    const { signedTransactionBytes, signedTransaction } =
      decodeSignedTransactionBase64(signedTransactionBase64);

    const submittedTransactionId = signedTransaction.txn.txID();

    if (submittedTransactionId !== attempt.expectedTransactionId) {
      return NextResponse.json(
        { error: "The signed transaction ID does not match the prepared payment." },
        { status: 400 }
      );
    }

    const algod = getAlgodClient();

    try {
      await algod.sendRawTransaction(signedTransactionBytes).do();
    } catch (broadcastError) {
      console.error("[credits/usdc/submit] broadcast failed:", broadcastError);

      return NextResponse.json(
        { error: "Algorand rejected this transaction. It may already be submitted or malformed." },
        { status: 400 }
      );
    }

    let confirmation;

    try {
      confirmation = await waitForConfirmation(submittedTransactionId, 12);
    } catch (confirmError) {
      console.error("[credits/usdc/submit] confirmation failed:", confirmError);

      return NextResponse.json(
        { error: "Unable to confirm the USDC transfer on Algorand. It may still be pending — check back shortly." },
        { status: 202 }
      );
    }

    // Defense-in-depth: verify the confirmed on-chain transfer actually matches
    // what we prepared, in case the client tampered with the signed bytes.
    const assetTransfer = confirmation?.["asset-transfer-transaction"];

    if (
      !assetTransfer ||
      Number(assetTransfer["asset-id"]) !== Number(attempt.usdcAssetId) ||
      Number(assetTransfer.amount) !== Number(attempt.amountBaseUnits) ||
      assetTransfer.receiver !== attempt.treasuryAddress
    ) {
      console.error(
        "[credits/usdc/submit] on-chain transfer mismatch",
        attempt._id,
        assetTransfer
      );

      return NextResponse.json(
        { error: "The confirmed transfer did not match the expected USDC payment. No credits were granted." },
        { status: 409 }
      );
    }

    const newBalance = await addCredits(attempt.userId, Number(attempt.credits));

    await db.collection("usdcCreditAttempts").updateOne(
      { _id: attempt._id },
      {
        $set: {
          status: "confirmed",
          confirmedTransactionId: submittedTransactionId,
          confirmedRound: confirmation["confirmed-round"] || null,
          confirmedAt: new Date(),
        },
      }
    );

    console.log(
      `[credits] +${attempt.credits} credits → user ${attempt.userId} via USDC (balance: ${newBalance})`
    );

    return NextResponse.json({
      success: true,
      newBalance,
      creditsAdded: attempt.credits,
      transactionId: submittedTransactionId,
    });
  } catch (error) {
    console.error("[credits/usdc/submit] failed:", error);

    return NextResponse.json(
      { error: error?.message || "Unable to submit the USDC payment." },
      { status: 500 }
    );
  }
}