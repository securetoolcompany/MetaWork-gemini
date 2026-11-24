export async function claimIpFunding({ collection, binding, txid, broadcast }) {
  const claimed = await collection.findOneAndUpdate({
    ...binding, 'fundingAttempt.expectedTransactionId': txid,
    'fundingAttempt.status': 'awaiting_signature',
  }, { $set: { 'fundingAttempt.status': 'submitting',
    'fundingAttempt.claimedAt': new Date() } },
  { returnDocument: 'after', writeConcern: { w: 'majority' } });
  if (!claimed) return false;
  try { await broadcast(); } catch { /* The outcome is unknown; reconcile by ID. */ }
  return true;
}

export async function reconcileIpFunding({ collection, binding, attempt, lookup, round }) {
  const txid = attempt.expectedTransactionId;
  if (attempt.status === 'awaiting_signature') return { status: 'awaiting_signature' };
  if (attempt.status === 'confirmed') return { status: 'confirmed', mbrPaymentTxId: txid, mbrPaidMicroAlgos: attempt.amount };
  let confirmedRound;
  try { confirmedRound = await lookup(txid); } catch { /* Unknown is not failure. */ }
  if (confirmedRound > 0) {
    const result = await collection.updateOne({ ...binding,
      'fundingAttempt.expectedTransactionId': txid,
      'fundingAttempt.status': 'submitting',
    }, { $set: { 'fundingAttempt.status': 'confirmed',
      'fundingAttempt.confirmedRound': confirmedRound,
      mbrPaymentTxId: txid, mbrPaidMicroAlgos: attempt.amount,
    } }, { writeConcern: { w: 'majority' } });
    if (result.matchedCount || (await collection.findOne(binding))?.mbrPaymentTxId === txid) {
      return { status: 'confirmed', mbrPaymentTxId: txid, mbrPaidMicroAlgos: attempt.amount };
    }
  }
  let expired = false;
  try { expired = (await round()) > attempt.lastValid; } catch { /* Still unknown. */ }
  return expired ? { status: 'review_required', code: 'IP_FUNDING_REVIEW_REQUIRED', txid }
    : { status: 'pending', code: 'IP_FUNDING_RECOVERY_PENDING', txid };
}
