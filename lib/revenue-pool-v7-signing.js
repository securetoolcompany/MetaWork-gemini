import algosdk from 'algosdk';

export class V7SigningValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'V7SigningValidationError';
  }
}

export class V7WalletSigningError extends Error {
  constructor(message, { cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'V7WalletSigningError';
  }
}

function getGroupId(transactions) {
  const group = transactions[0]?.group;

  if (!(group instanceof Uint8Array) || group.length === 0) {
    throw new V7SigningValidationError(
      'Approved transaction group is missing its group ID.'
    );
  }

  return Buffer.from(group).toString('base64');
}

function assertSameGroupId(transactions, expectedGroupId) {
  const groupId = getGroupId(transactions);

  if (groupId !== expectedGroupId) {
    throw new V7SigningValidationError(
      'Approved transaction group ID does not match the preflight-approved group ID.'
    );
  }

  for (const [index, transaction] of transactions.entries()) {
    const transactionGroupId = Buffer.from(transaction.group).toString(
      'base64'
    );

    if (transactionGroupId !== groupId) {
      throw new V7SigningValidationError(
        `Transaction ${index} does not belong to the approved transaction group.`
      );
    }
  }

  return groupId;
}

function assertReleaseHeldOrdering(transactions) {
  if (!Array.isArray(transactions) || transactions.length !== 2) {
    throw new V7SigningValidationError(
      'Approved release-held group must contain exactly two transactions.'
    );
  }

  if (transactions[0]?.type !== 'pay') {
    throw new V7SigningValidationError(
      'Approved release-held transaction 0 must be the MBR payment.'
    );
  }

  if (transactions[1]?.type !== 'appl') {
    throw new V7SigningValidationError(
      'Approved release-held transaction 1 must be the application call.'
    );
  }

  const action = Buffer.from(
    transactions[1].applicationCall?.appArgs?.[0] ?? []
  ).toString();

  if (action !== 'release_held') {
    throw new V7SigningValidationError(
      'Approved application call must use the release_held action.'
    );
  }
}

function assertApprovedGroup(approvedGroup) {
  if (!approvedGroup || !Array.isArray(approvedGroup.transactions)) {
    throw new V7SigningValidationError(
      'approvedGroup must contain the exact preflight-approved transactions.'
    );
  }

  return approvedGroup.transactions;
}

export async function signApprovedV7ReleaseHeldGroup({
  approvedGroup,
  expectedGroupId,
  signTransactionGroup,
}) {
  if (typeof expectedGroupId !== 'string' || !expectedGroupId) {
    throw new V7SigningValidationError(
      'expectedGroupId must be the preflight-approved group ID.'
    );
  }

  if (typeof signTransactionGroup !== 'function') {
    throw new V7SigningValidationError(
      'signTransactionGroup must be the connected wallet signing callback.'
    );
  }

  const transactions = assertApprovedGroup(approvedGroup);

  assertReleaseHeldOrdering(transactions);

  const verifiedGroupId = assertSameGroupId(
    transactions,
    expectedGroupId
  );

  const encodedUnsignedTransactions = transactions.map((transaction) =>
    algosdk.encodeUnsignedTransaction(transaction)
  );

  let signedTransactions;

  try {
    signedTransactions = await signTransactionGroup(
      encodedUnsignedTransactions
    );
  } catch (cause) {
    throw new V7WalletSigningError(
      'Wallet signing was rejected, cancelled, or failed.',
      { cause }
    );
  }

  if (
    !Array.isArray(signedTransactions) ||
    signedTransactions.length !== transactions.length
  ) {
    throw new V7WalletSigningError(
      `Wallet returned ${
        Array.isArray(signedTransactions)
          ? signedTransactions.length
          : 0
      } signed transactions; expected ${transactions.length}.`
    );
  }

  const normalizedSignedTransactions = signedTransactions.map(
    (signedTransaction, index) => {
      if (!(signedTransaction instanceof Uint8Array)) {
        throw new V7WalletSigningError(
          `Wallet result ${index} must be a signed Uint8Array transaction blob.`
        );
      }

      return new Uint8Array(signedTransaction);
    }
  );

  return Object.freeze({
    groupId: verifiedGroupId,
    transactionCount: transactions.length,
    signedTransactions: Object.freeze(normalizedSignedTransactions),
  });
}