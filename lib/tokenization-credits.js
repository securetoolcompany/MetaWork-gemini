export class InsufficientCreditsError extends Error {
  constructor() {
    super('Insufficient credits.');
    this.name = 'InsufficientCreditsError';
    this.code = 'INSUFFICIENT_CREDITS';
  }
}

export class TokenizationConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TokenizationConflictError';
    this.code = 'TOKENIZATION_CONFLICT';
  }
}

export async function createTokenizationWithCredits({
  client,
  db,
  userFilter,
  creditCost,
  operation,
  persist,
}) {
  if (!client) {
    throw new Error('MongoDB client is required.');
  }

  if (!db) {
    throw new Error('MongoDB database is required.');
  }

  if (!userFilter) {
    throw new Error('Authenticated user filter is required.');
  }

  if (!Number.isSafeInteger(creditCost) || creditCost <= 0) {
    throw new Error('creditCost must be a positive integer.');
  }

  if (typeof persist !== 'function') {
    throw new Error('persist must be a function.');
  }

  const session = client.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const creditUpdate = await db.collection('users').findOneAndUpdate(
        {
          ...userFilter,
          credits: { $gte: creditCost },
        },
        {
          $inc: {
            credits: -creditCost,
          },
        },
        {
          returnDocument: 'after',
          session,
        }
      );

      if (!creditUpdate) {
        throw new InsufficientCreditsError();
      }

      result = await persist({
        session,
        creditCost,
        operation,
        user: creditUpdate,
      });
    });

    return result;
  } finally {
    await session.endSession();
  }
}