import assert from 'node:assert/strict';
import test from 'node:test';

import algosdk from 'algosdk';

import { createDisposableSigner } from './signer.js';

const GENESIS_ID = 'metawork-disposable-localnet';
const GENESIS_HASH = new Uint8Array(32).fill(11);
const PRODUCTION_ADDRESS =
  '73C6PQVLAPE6M2GFV3ZKXJRHCNZ4P75GY3LMTHJ7MS2MALZJ6RRJKNWHBU';

function makeNetwork(overrides = {}) {
  return {
    network: 'localnet',
    expectedGenesisID: GENESIS_ID,
    expectedGenesisHash: GENESIS_HASH.slice(),
    suggestedParams: {
      genesisID: GENESIS_ID,
      genesisHash: GENESIS_HASH.slice(),
    },
    ...overrides,
  };
}

function makePayment(sender, overrides = {}) {
  return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver: sender,
    amount: 0n,
    suggestedParams: {
      fee: 1000n,
      minFee: 1000n,
      flatFee: true,
      firstValid: 1n,
      lastValid: 100n,
      genesisID: GENESIS_ID,
      genesisHash: GENESIS_HASH.slice(),
    },
    ...overrides,
  });
}

test('creates distinct disposable signers without exposing secret fields', () => {
  const first = createDisposableSigner();
  const second = createDisposableSigner();

  assert.ok(algosdk.isValidAddress(first.address));
  assert.ok(algosdk.isValidAddress(second.address));
  assert.notEqual(first.address, second.address);
  assert.equal(typeof first.signTransaction, 'function');

  assert.deepEqual(
    Object.keys(first).sort(),
    ['address', 'signTransaction'],
  );
  assert.ok(Object.isFrozen(first));
});

test('signs an own-account transaction after network validation', () => {
  const signer = createDisposableSigner();
  const transaction = makePayment(signer.address);

  const signedBytes = signer.signTransaction(transaction, makeNetwork());
  const decoded = algosdk.decodeSignedTransaction(signedBytes);

  assert.ok(signedBytes instanceof Uint8Array);
  assert.equal(decoded.txn.sender.toString(), signer.address);
  assert.equal(decoded.txn.txID(), transaction.txID());
  assert.ok(decoded.sig instanceof Uint8Array);
  assert.equal(decoded.sig.length, 64);
});

test('rejects missing network context and MainNet selection', () => {
  const signer = createDisposableSigner();
  const transaction = makePayment(signer.address);

  assert.throws(() => signer.signTransaction(transaction));

  assert.throws(() =>
    signer.signTransaction(
      transaction,
      makeNetwork({ network: 'mainnet' }),
    ),
  );
});

test('rejects a transaction whose sender is not the disposable signer', () => {
  const signer = createDisposableSigner();
  const other = createDisposableSigner();

  assert.throws(() =>
    signer.signTransaction(makePayment(other.address), makeNetwork()),
  );
});

test('rejects the production reference account as transaction sender', () => {
  const signer = createDisposableSigner();

  assert.throws(() =>
    signer.signTransaction(
      makePayment(PRODUCTION_ADDRESS),
      makeNetwork(),
    ),
  );
});

test('rejects a transaction whose genesis differs from validated node parameters', () => {
  const signer = createDisposableSigner();
  const transaction = makePayment(signer.address);

  transaction.genesisHash = new Uint8Array(32).fill(22);

  assert.throws(() =>
    signer.signTransaction(transaction, makeNetwork()),
  );
});

test('rejects a production reference payment recipient', () => {
  const signer = createDisposableSigner();

  assert.throws(() =>
    signer.signTransaction(
      makePayment(signer.address, { receiver: PRODUCTION_ADDRESS }),
      makeNetwork(),
    ),
  );
});

test('rejects rekeying even to another disposable address', () => {
  const signer = createDisposableSigner();
  const target = createDisposableSigner();

  const transaction = makePayment(signer.address, {
    rekeyTo: target.address,
  });

  assert.throws(
    () => signer.signTransaction(transaction, makeNetwork()),
    (error) => error.code === 'REKEY_FORBIDDEN',
  );
});

test('rejects payment close-out even to another disposable address', () => {
  const signer = createDisposableSigner();
  const target = createDisposableSigner();

  const transaction = makePayment(signer.address, {
    closeRemainderTo: target.address,
  });

  assert.throws(
    () => signer.signTransaction(transaction, makeNetwork()),
    (error) => error.code === 'CLOSE_REMAINDER_FORBIDDEN',
  );
});

test('rejects asset transfers until dedicated validation exists', () => {
  const signer = createDisposableSigner();

  const transaction =
    algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: signer.address,
      receiver: signer.address,
      assetIndex: 1n,
      amount: 0n,
      suggestedParams: {
        fee: 1000n,
        minFee: 1000n,
        flatFee: true,
        firstValid: 1n,
        lastValid: 100n,
        genesisID: GENESIS_ID,
        genesisHash: GENESIS_HASH.slice(),
      },
    });

  assert.throws(
    () => signer.signTransaction(transaction, makeNetwork()),
    (error) => error.code === 'UNSUPPORTED_TRANSACTION_TYPE',
  );
});

test('rejects transaction genesis ID differing from the configured network', () => {
  const signer = createDisposableSigner();
  const transaction = makePayment(signer.address);

  transaction.genesisID = 'another-disposable-localnet';

  assert.throws(
    () => signer.signTransaction(transaction, makeNetwork()),
    (error) => error.code === 'GENESIS_ID_MISMATCH',
  );
});

test('rejects mismatched node genesis before signing a matching transaction', () => {
  const signer = createDisposableSigner();
  const transaction = makePayment(signer.address);

  const network = makeNetwork({
    suggestedParams: {
      genesisID: GENESIS_ID,
      genesisHash: new Uint8Array(32).fill(22),
    },
  });

  assert.throws(
    () => signer.signTransaction(transaction, network),
    (error) => error.code === 'GENESIS_HASH_MISMATCH',
  );
});


test('rejects missing transaction input', () => {
  const signer = createDisposableSigner();

  assert.throws(() =>
    signer.signTransaction(undefined, makeNetwork()),
  );
});