import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import algosdk from 'algosdk';
import nacl from 'tweetnacl';

const routeSource = readFileSync(
  new URL('../app/api/ip/pool-funding/route.js', import.meta.url),
  'utf8',
)
  .replace(/^import .*;\r?$/gm, '')
  .replace(/^export const (GET|POST) =/gm, 'const $1 =');

const sender = algosdk.generateAccount();
const treasury = algosdk.generateAccount();
const other = algosdk.generateAccount();

function payment({ receiver = treasury.addr, amount = 250_000n } = {}) {
  return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: sender.addr,
    receiver,
    amount,
    suggestedParams: {
      fee: 1000n,
      minFee: 1000n,
      flatFee: true,
      firstValid: 10n,
      lastValid: 100n,
      genesisID: 'mainnet-v1.0',
      genesisHash: new Uint8Array(32).fill(1),
    },
  });
}

function corruptSignature(signedBytes) {
  const signature = algosdk.decodeSignedTransaction(signedBytes).sig;
  assert.equal(signature?.length, 64);
  const bytes = Buffer.from(signedBytes);
  const offset = bytes.indexOf(Buffer.from(signature));
  assert.ok(offset >= 0, 'Locate the signature in the signed envelope');
  bytes[offset] ^= 1;
  return bytes;
}

function setup(expected, { authAddr } = {}) {
  const calls = { claims: 0, broadcasts: 0, lookups: 0 };
  let sent = false;
  const attempt = {
    status: 'awaiting_signature',
    expectedTransactionId: expected.txID(),
    unsigned: Buffer.from(algosdk.encodeUnsignedTransaction(expected)).toString('base64'),
    amount: 250_000,
    lastValid: 100,
  };
  const collection = {
    async findOne(binding) {
      assert.equal(binding.ownerId, 'fixture-owner');
      assert.equal(binding.id, 'fixture-asset');
      assert.equal(binding.tokenizationOperationKey, 'fixture-operation');
      return { fundingAttempt: { ...attempt } };
    },
  };

  const POST = vm.runInNewContext(`${routeSource}\nPOST`, {
    Buffer,
    URL,
    nacl,
    algosdk: {
      decodeSignedTransaction: algosdk.decodeSignedTransaction,
      encodeUnsignedTransaction: algosdk.encodeUnsignedTransaction,
      waitForConfirmation: async () => {},
    },
    NextResponse: {
      json: (body, options) => ({ body, status: options.status }),
    },
    verifyToken: token => {
      assert.equal(token, 'offline-fixture');
      return { userId: 'fixture-owner' };
    },
    connectToDatabase: async () => ({ db: { collection: () => collection } }),
    getAlgodClient: network => {
      assert.equal(network, 'mainnet');
      return {
        status: () => ({ do: async () => ({ lastRound: 20n }) }),
        accountInformation: address => ({
          do: async () => {
            assert.equal(address, sender.addr.toString());
            return authAddr ? { authAddr } : {};
          },
        }),
        sendRawTransaction: bytes => ({
          do: async () => {
            calls.broadcasts++;
            assert.equal(algosdk.decodeSignedTransaction(bytes).txn.txID(), expected.txID());
            sent = true;
          },
        }),
      };
    },
    // Spies at the side-effect boundary. The existing Mongo test covers
    // the real atomic claim; this test checks what can reach that boundary.
    claimIpFunding: async ({ txid, broadcast }) => {
      calls.claims++;
      assert.equal(txid, expected.txID());
      attempt.status = 'submitting';
      await broadcast();
      return true;
    },
    reconcileIpFunding: async () => {
      calls.lookups++;
      assert.equal(sent, true);
      return { status: 'confirmed', mbrPaymentTxId: expected.txID() };
    },
  });

  return {
    calls,
    submit: bytes => POST(new Request('http://localhost/api/ip/pool-funding', {
      method: 'POST',
      headers: { Authorization: 'Bearer offline-fixture' },
      body: JSON.stringify({
        ipAssetId: 'fixture-asset',
        operationKey: 'fixture-operation',
        signedMbrTxn: Buffer.from(bytes).toString('base64'),
      }),
    })),
  };
}

test('exact SDK-signed payment reaches the claim and broadcasts once', async () => {
  const expected = payment();
  const { submit, calls } = setup(expected);
  const response = await submit(expected.signTxn(sender.sk));
  assert.equal(response.status, 200);
  assert.equal(response.body.mbrPaymentTxId, expected.txID());
  assert.deepEqual(calls, { claims: 1, broadcasts: 1, lookups: 1 });
});

test('an unrelated envelope signer cannot claim the original payment', async () => {
  const expected = payment();
  const bytes = expected.signTxn(other.sk);
  assert.equal(algosdk.decodeSignedTransaction(bytes).sgnr?.toString(), other.addr.toString());
  const { submit, calls } = setup(expected);
  const response = await submit(bytes);
  assert.equal(response.status, 400);
  assert.match(response.body.error, /not authorized/);
  assert.deepEqual(calls, { claims: 0, broadcasts: 0, lookups: 0 });
});

test('the ledger-authorized rekey signer can claim the original payment', async () => {
  const expected = payment();
  const { submit, calls } = setup(expected, { authAddr: other.addr });
  const response = await submit(expected.signTxn(other.sk));
  assert.equal(response.status, 200);
  assert.equal(response.body.mbrPaymentTxId, expected.txID());
  assert.deepEqual(calls, { claims: 1, broadcasts: 1, lookups: 1 });
});

for (const [name, signedBytes] of [
  ['changed recipient', () => payment({ receiver: other.addr }).signTxn(sender.sk)],
  ['changed amount', () => payment({ amount: 250_001n }).signTxn(sender.sk)],
  ['corrupted signature', expected => corruptSignature(expected.signTxn(sender.sk))],
]) {
  test(`${name} is rejected before claim or broadcast`, async () => {
    const expected = payment();
    const { submit, calls } = setup(expected);
    const response = await submit(signedBytes(expected));
    assert.equal(response.status, 400);
    assert.deepEqual(calls, { claims: 0, broadcasts: 0, lookups: 0 });
  });
}

test('GET recovers the original receipt without broadcasting', async () => {
  const { reconcileIpFunding } = await import('../lib/ip-source/pool-funding.js');
  const expected = payment({ amount: 321_000n });
  const txid = expected.txID();
  const binding = {
    id: 'fixture-asset',
    ownerId: 'fixture-owner',
    tokenizationOperationKey: 'fixture-operation',
  };
  const asset = {
    ...binding,
    fundingAttempt: {
      status: 'submitting',
      expectedTransactionId: txid,
      amount: 321_000,
      lastValid: 100,
    },
  };
  const calls = { lookups: 0, writes: 0, claims: 0, broadcasts: 0 };
  const plain = value => JSON.parse(JSON.stringify(value));

  const collection = {
    async findOne(filter) {
      assert.deepEqual(plain(filter), binding);
      return { ...asset, fundingAttempt: { ...asset.fundingAttempt } };
    },
    async updateOne(filter, update, options) {
      calls.writes++;
      assert.deepEqual(plain(filter), {
        ...binding,
        'fundingAttempt.expectedTransactionId': txid,
        'fundingAttempt.status': 'submitting',
      });
      assert.equal(options.writeConcern.w, 'majority');
      assert.deepEqual(plain(update.$set), {
        'fundingAttempt.status': 'confirmed',
        'fundingAttempt.confirmedRound': 42,
        mbrPaymentTxId: txid,
        mbrPaidMicroAlgos: 321_000,
      });
      asset.fundingAttempt.status = 'confirmed';
      asset.mbrPaymentTxId = update.$set.mbrPaymentTxId;
      asset.mbrPaidMicroAlgos = update.$set.mbrPaidMicroAlgos;
      return { matchedCount: 1 };
    },
  };

  const GET = vm.runInNewContext(`${routeSource}\nGET`, {
    URL,
    NextResponse: {
      json: (body, options) => ({ body, status: options.status }),
    },
    verifyToken: token => {
      assert.equal(token, 'offline-fixture');
      return { userId: binding.ownerId };
    },
    connectToDatabase: async () => ({
      db: { collection: () => collection },
    }),
    reconcileIpFunding,
    claimIpFunding: async () => { calls.claims++; },
    getAlgodClient: network => {
      assert.equal(network, 'mainnet');
      return {
        pendingTransactionInformation: id => ({
          do: async () => {
            calls.lookups++;
            assert.equal(id, txid);
            return { confirmedRound: 42n };
          },
        }),
        sendRawTransaction: () => {
          calls.broadcasts++;
          throw new Error('Recovery must not broadcast');
        },
      };
    },
  });

  const recover = () => GET(new Request(
    'http://localhost/api/ip/pool-funding?ipAssetId=fixture-asset&operationKey=fixture-operation',
    { headers: { Authorization: 'Bearer offline-fixture' } },
  ));

  for (let i = 0; i < 2; i++) {
    const response = await recover();
    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'confirmed');
    assert.equal(response.body.mbrPaymentTxId, txid);
    assert.equal(response.body.mbrPaidMicroAlgos, 321_000);
  }

  assert.deepEqual(calls, { lookups: 1, writes: 1, claims: 0, broadcasts: 0 });
});
