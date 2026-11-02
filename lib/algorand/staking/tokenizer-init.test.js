import assert from 'node:assert/strict';
import test from 'node:test';

import algosdk from 'algosdk';

import { buildTokenizerInitialization } from './tokenizer-init.js';

const GENESIS_HASH_BASE64 =
  '0TJVyrVwfL/CRhaQzRG1mF29GzfDdG4Dzr2M5uXbg2o=';

const ROLES = Object.freeze({
  creatorInitializer:
    'QAVXZK43SGUJC7DQ2QC6LBWTAYCKDGOG7XUSFYQRJBE23GZMHN3ORHFG3M',
  staking:
    'V6C6BWQKI4LS3FCZEM5XIOHCM2SSQSIB7AXOIVSBHUNXVVEWMBWTMXRWFU',
  seedRecipient:
    'JJOIC2KGZPABBPXRWF5JP67L3VVV5GJ334YQSTSQBS3QKZARUCUSKJER4Y',
});

// Synthetic identifiers and rounds only. No deployed application or ASA
// is claimed, created, queried, signed for, or submitted by these tests.
function input(overrides = {}) {
  return {
    network: 'localnet',
    roles: { ...ROLES },
    appID: 123n,
    assetID: 456n,
    includeRecipientOptIn: false,
    suggestedParams: {
      genesisID: 'dockernet-v1',
      genesisHash: Uint8Array.from(
        Buffer.from(GENESIS_HASH_BASE64, 'base64'),
      ),
      firstValid: 10n,
      lastValid: 100n,
      minFee: 1000n,
      fee: 1000n,
      flatFee: true,
    },
    ...overrides,
  };
}

function assertUnsetAddress(address) {
  assert.ok(
    address === undefined ||
    address === null ||
    address.toString() === algosdk.encodeAddress(new Uint8Array(32)),
  );
}

test('builds both group shapes with exact fees and sender assignments', () => {
  for (const includeRecipientOptIn of [false, true]) {
    const result = buildTokenizerInitialization(
      input({ includeRecipientOptIn }),
    );
    const transactions = result.transactions;
    const expectedSenders = includeRecipientOptIn
      ? [ROLES.staking, ROLES.seedRecipient, ROLES.creatorInitializer]
      : [ROLES.staking, ROLES.creatorInitializer];

    assert.equal(transactions.length, expectedSenders.length);
    assert.equal(
      result.initializerOuterFeeMicroAlgo,
      includeRecipientOptIn ? 4000n : 3000n,
    );
    assert.deepEqual(
      result.signerAssignments,
      expectedSenders.map((sender, transactionIndex) => ({
        transactionIndex,
        sender,
      })),
    );

    for (const [index, transaction] of transactions.entries()) {
      assert.equal(transaction.sender.toString(), expectedSenders[index]);
      assert.equal(
        transaction.fee,
        index === transactions.length - 1
          ? result.initializerOuterFeeMicroAlgo
          : 0n,
      );
      assert.ok(transaction.group instanceof Uint8Array);
      assert.equal(transaction.group.length, 32);
      assert.deepEqual(transaction.group, transactions[0].group);
      assert.equal(transaction.genesisID, 'dockernet-v1');
      assert.equal(
        Buffer.from(transaction.genesisHash).toString('base64'),
        GENESIS_HASH_BASE64,
      );

      const decoded = algosdk.decodeUnsignedTransaction(
        algosdk.encodeUnsignedTransaction(transaction),
      );
      assert.equal(decoded.sender.toString(), expectedSenders[index]);
      assert.deepEqual(decoded.group, transaction.group);
    }
  }
});

test('rekey is zero-value staking self-payment to the synthetic app address', () => {
  const { transactions } = buildTokenizerInitialization(input());
  const rekey = transactions[0];

  assert.equal(rekey.type, 'pay');
  assert.equal(rekey.payment.receiver.toString(), ROLES.staking);
  assert.equal(rekey.payment.amount, 0n);
  assert.equal(
    rekey.rekeyTo.toString(),
    algosdk.getApplicationAddress(123n).toString(),
  );
  assertUnsetAddress(rekey.payment.closeRemainderTo);
});

test('optional opt-in is a zero-value recipient self-transfer without rekey', () => {
  const { transactions } = buildTokenizerInitialization(
    input({ includeRecipientOptIn: true }),
  );
  const optIn = transactions[1];

  assert.equal(optIn.type, 'axfer');
  assert.equal(optIn.assetTransfer.assetIndex, 456n);
  assert.equal(optIn.assetTransfer.receiver.toString(), ROLES.seedRecipient);
  assert.equal(optIn.assetTransfer.amount, 0n);
  assertUnsetAddress(optIn.assetTransfer.assetSender);
  assertUnsetAddress(optIn.assetTransfer.closeRemainderTo);
  assertUnsetAddress(optIn.rekeyTo);
});

test('last call references fixed accounts and share asset with exact selector', () => {
  const { transactions } = buildTokenizerInitialization(input());
  const call = transactions.at(-1);

  assert.equal(call.type, 'appl');
  assert.equal(call.applicationCall.appIndex, 123n);
  assert.equal(call.applicationCall.onComplete, algosdk.OnApplicationComplete.NoOpOC);
  assert.deepEqual(
    call.applicationCall.appArgs.map((value) => Buffer.from(value).toString()),
    ['initialize_seed'],
  );
  assert.deepEqual(
    call.applicationCall.accounts.map((address) => address.toString()),
    [ROLES.staking, ROLES.seedRecipient],
  );
  assert.deepEqual(call.applicationCall.foreignAssets, [456n]);
  assertUnsetAddress(call.rekeyTo);
});

test('rejects network selection and genesis mismatches', () => {
  for (const network of [undefined, 'mainnet', 'testnet', '']) {
    assert.throws(() => buildTokenizerInitialization(input({ network })));
  }

  for (const change of [
    { genesisID: 'mainnet-v1.0' },
    { genesisID: 'another-localnet' },
    { genesisHash: new Uint8Array(32) },
  ]) {
    const original = input();
    assert.throws(() =>
      buildTokenizerInitialization(input({
        suggestedParams: { ...original.suggestedParams, ...change },
      })),
    );
  }
});

test('rejects missing, substituted, overlapping, or additional roles', () => {
  for (const roles of [
    undefined,
    {},
    { ...ROLES, staking: ROLES.seedRecipient },
    {
      ...ROLES,
      staking: 'UTXM245YRZLT7DV66OKQ2MVWPMGNZUVYQIIVJY6UYO7PB3WXL53GQNMMPQ',
    },
    { ...ROLES, administrator: ROLES.creatorInitializer },
  ]) {
    assert.throws(() => buildTokenizerInitialization(input({ roles })));
  }
});

test('rejects invalid IDs, implicit opt-in choice, and invalid fee values', () => {
  for (const field of ['appID', 'assetID']) {
    for (const value of [0n, -1n, 1n << 64n, 123, '123', undefined]) {
      assert.throws(() =>
        buildTokenizerInitialization(input({ [field]: value })),
      );
    }
  }

  for (const includeRecipientOptIn of [undefined, null, 0, 'false']) {
    assert.throws(() =>
      buildTokenizerInitialization(input({ includeRecipientOptIn })),
    );
  }

  for (const minFee of [0n, -1n, 1.5, Number.MAX_SAFE_INTEGER + 1, undefined, 1n << 63n]) {
    const original = input();
    assert.throws(() =>
      buildTokenizerInitialization(input({
        suggestedParams: { ...original.suggestedParams, minFee },
      })),
    );
  }
});

test('invalid inputs fail at their intended validation checks', () => {
  const original = input();

  assert.throws(
    () => buildTokenizerInitialization(input({
      suggestedParams: {
        ...original.suggestedParams,
        genesisHash: new Uint8Array(32),
      },
    })),
    { code: 'GENESIS_HASH_MISMATCH' },
  );

  assert.throws(
    () => buildTokenizerInitialization(input({
      suggestedParams: {
        ...original.suggestedParams,
        genesisID: 'another-localnet',
      },
    })),
    { code: 'GENESIS_ID_MISMATCH' },
  );

  assert.throws(
    () => buildTokenizerInitialization(input({
      roles: { ...ROLES, staking: ROLES.seedRecipient },
    })),
    /Unapproved Tokenizer role: staking/,
  );

  assert.throws(
    () => buildTokenizerInitialization(input({
      roles: { ...ROLES, administrator: ROLES.creatorInitializer },
    })),
    /Exactly three explicit approved roles are required/,
  );

  assert.throws(
    () => buildTokenizerInitialization(input({ appID: 0n })),
    /appID must be a positive uint64 bigint/,
  );

  assert.throws(
    () => buildTokenizerInitialization(input({ assetID: 456 })),
    /assetID must be a positive uint64 bigint/,
  );

  assert.throws(
    () => buildTokenizerInitialization(input({
      includeRecipientOptIn: undefined,
    })),
    /includeRecipientOptIn must be explicitly boolean/,
  );

  assert.throws(
    () => buildTokenizerInitialization(input({
      suggestedParams: {
        ...original.suggestedParams,
        minFee: undefined,
      },
    })),
    /suggestedParams.minFee must be a positive uint64 bigint/,
  );

  assert.throws(
    () => buildTokenizerInitialization(input({
      suggestedParams: {
        ...original.suggestedParams,
        minFee: 1n << 63n,
      },
    })),
    /Initialization fee exceeds uint64/,
  );
});


test('does not mutate caller roles or suggested parameters', () => {
  const original = input();
  const rolesBefore = { ...original.roles };
  const paramsBefore = {
    ...original.suggestedParams,
    genesisHash: original.suggestedParams.genesisHash.slice(),
  };
  Object.freeze(original.roles);
  Object.freeze(original.suggestedParams);

  buildTokenizerInitialization(original);

  assert.deepEqual(original.roles, rolesBefore);
  assert.deepEqual(original.suggestedParams, paramsBefore);
});