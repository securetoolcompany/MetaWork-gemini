/**
 * lib/credits.js
 * Platform credit helpers — read, add, deduct credits on user documents.
 * 1 credit = $0.01 USD
 * Use CREDIT_COSTS from lib/credit-costs.js for operation amounts.
 */

import { connectToDatabase } from '@/lib/mongodb';

/**
 * Returns the current credit balance for a user.
 */
export async function getCredits(userId) {
  const { db } = await connectToDatabase();
  const user = await db
    .collection('users')
    .findOne({ id: userId }, { projection: { credits: 1 } });
  return user?.credits ?? 0;
}

/**
 * Adds credits to a user atomically.
 * @param {string} userId
 * @param {number} qty — number of credits to add (must be > 0)
 * @returns {Promise<number>} new balance
 */
export async function addCredits(userId, qty) {
  if (qty <= 0) throw new Error('qty must be positive');
  const { db } = await connectToDatabase();
  const result = await db.collection('users').findOneAndUpdate(
    { id: userId },
    {
      $inc: { credits: qty },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after', projection: { credits: 1 } }
  );
  return result?.credits ?? qty;
}

/**
 * Atomically deducts `cost` credits from a user.
 * Returns true if successful, false if insufficient balance.
 * @param {string} userId
 * @param {number} cost — number of credits to deduct (use CREDIT_COSTS)
 * @returns {Promise<boolean>}
 */
export async function deductCredits(userId, cost) {
  if (cost <= 0) throw new Error('cost must be positive');
  const { db } = await connectToDatabase();
  const result = await db.collection('users').findOneAndUpdate(
    { id: userId, credits: { $gte: cost } },
    {
      $inc: { credits: -cost },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after', projection: { credits: 1 } }
  );
  return result !== null;
}