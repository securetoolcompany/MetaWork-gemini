// app/api/ip/pool-funding/route.js
import { NextResponse } from "next/server";
import algosdk from "algosdk";
import { getAlgodClient } from "@/lib/algorand";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import nacl from 'tweetnacl';
import { claimIpFunding, reconcileIpFunding } from '@/lib/ip-source/pool-funding';
import { getIndexerClient } from '@/lib/algorand';

async function funding(request, submit) {
  const reply = (body, status = 200) => NextResponse.json(body, {
    status, headers: { 'Cache-Control': 'no-store', ...(status === 202 ? { 'Retry-After': '3' } : {}) },
  });
  let ownerId;
  try { ownerId = verifyToken(request.headers.get('authorization')?.replace(/^Bearer /, ''))?.userId; } catch {}
  if (!ownerId) return reply({ error: 'Auth required' }, 401);
  try {
    const input = submit ? await request.json() : Object.fromEntries(new URL(request.url).searchParams);
    const { ipAssetId, operationKey, signedMbrTxn } = input;
    if (typeof ipAssetId !== 'string' || !ipAssetId || typeof operationKey !== 'string' || !operationKey) {
      return reply({ error: 'Asset ID and operation key are required.' }, 400);
    }
    const { db } = await connectToDatabase();
    const collection = db.collection('ip_assets');
    const binding = { id: ipAssetId, ownerId, tokenizationOperationKey: operationKey };
    const asset = await collection.findOne(binding);
    if (!asset) return reply({ error: 'IP funding operation not found.' }, 404);
    const attempt = asset.fundingAttempt;
    if (!attempt) return reply({ status: 'review_required', code: 'IP_FUNDING_REVIEW_REQUIRED' }, 409);
    if (attempt.status === 'confirmed') {
      return reply({ status: 'confirmed', mbrPaymentTxId: attempt.expectedTransactionId, mbrPaidMicroAlgos: attempt.amount });
    }
    const algod = getAlgodClient('mainnet');
    if (submit && attempt.status === 'awaiting_signature') {
      let bytes;
      let senderAddress;
      let signerAddress;
      try {
        if (typeof signedMbrTxn !== 'string' || !signedMbrTxn || signedMbrTxn.length > 22000) throw new Error();
        bytes = Buffer.from(signedMbrTxn, 'base64');
        const signed = algosdk.decodeSignedTransaction(bytes);
        const txn = signed.txn;
        senderAddress = txn.sender.toString();
        signerAddress = (signed.sgnr ?? txn.sender).toString();
        if (txn.txID() !== attempt.expectedTransactionId ||
            !Buffer.from(algosdk.encodeUnsignedTransaction(txn)).equals(Buffer.from(attempt.unsigned, 'base64')) ||
            !signed.sig || signed.msig || signed.lsig ||
            !nacl.sign.detached.verify(txn.bytesToSign(), signed.sig, (signed.sgnr ?? txn.sender).publicKey)) throw new Error();
      } catch { return reply({ error: 'Signed payment does not match the prepared funding attempt.' }, 400); }
      // A valid envelope signature does not establish that its signer is
      // authorized for the sender. Check the current ledger before claiming.
      const senderAccount = await algod.accountInformation(senderAddress).do();
      const authAddress = senderAccount.authAddr ?? senderAccount['auth-addr'];
      const authorizedSigner = authAddress ? authAddress.toString() : senderAddress;
      if (signerAddress !== authorizedSigner) {
        return reply({ error: 'Signer is not authorized for the prepared funding sender.' }, 400);
      }
      const { lastRound } = await algod.status().do();
      if (Number(lastRound) >= attempt.lastValid) return reply({ status: 'review_required', code: 'IP_FUNDING_REVIEW_REQUIRED' }, 409);
      await claimIpFunding({ collection, binding, txid: attempt.expectedTransactionId,
        broadcast: async () => {
          await algod.sendRawTransaction(bytes).do();
          await algosdk.waitForConfirmation(algod, attempt.expectedTransactionId, 10);
        } });
    }
    const current = (await collection.findOne(binding))?.fundingAttempt;
    if (!current) return reply({ status: 'review_required', code: 'IP_FUNDING_REVIEW_REQUIRED' }, 409);
    const result = await reconcileIpFunding({ collection, binding, attempt: current,
      round: async () => Number((await algod.status().do()).lastRound),
      lookup: async (id) => {
        try {
          const pending = await algod.pendingTransactionInformation(id).do();
          const confirmed = Number(pending.confirmedRound ?? pending['confirmed-round'] ?? 0);
          if (confirmed > 0) return confirmed;
        } catch { /* Try the confirmed ledger index. */ }
        const { transaction } = await getIndexerClient('mainnet').lookupTransactionByID(id).do();
        return transaction?.id === id ? Number(transaction.confirmedRound ?? transaction['confirmed-round'] ?? 0) : 0;
      },
    });
    return reply(result, result.status === 'pending' ? 202 : result.status === 'review_required' ? 409 : 200);
  } catch {
    return reply({ status: 'pending', code: 'IP_FUNDING_RECOVERY_PENDING', error: 'Funding is unresolved. Do not sign or pay again.' }, 202);
  }
}

export const GET = (request) => funding(request, false);
export const POST = (request) => funding(request, true);
