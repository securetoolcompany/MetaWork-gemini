import assert from 'node:assert/strict';
import test from 'node:test';

import algosdk from 'algosdk';

import {
  assertStakingNetwork,
  assertStakingWritableAddresses,
} from './client.js';

const PROTECTED_PRODUCTION_ADDRESS =
  '73C6PQVLAPE6M2GFV3ZKXJRHCNZ4P75GY3LMTHJ7MS2MALZJ6RRJKNWHBU';

function makeDisposableAddress() {
  return algosdk.generateAccount().addr.toString();
}

test('accepts an explicit non-empty list of valid disposable addresses', () => {
  assert.doesNotThrow(() =>
    assertStakingWritableAddresses([
      makeDisposableAddress(),
      makeDisposableAddress(),
    ]),
  );
});

test('rejects the production reference account at every list position', () => {
  const first = makeDisposableAddress();
  const second = makeDisposableAddress();

  for (const addresses of [
    [PROTECTED_PRODUCTION_ADDRESS],
    [PROTECTED_PRODUCTION_ADDRESS, first, second],
    [first, PROTECTED_PRODUCTION_ADDRESS, second],
    [first, second, PROTECTED_PRODUCTION_ADDRESS],
  ]) {
    assert.throws(() => assertStakingWritableAddresses(addresses));
  }
});

test('rejects missing, empty, or non-array writable-address lists', () => {
  for (const addresses of [
    undefined,
    null,
    [],
    {},
    makeDisposableAddress(),
  ]) {
    assert.throws(() => assertStakingWritableAddresses(addresses));
  }
});

test('rejects malformed or non-string writable addresses', () => {
  const address = makeDisposableAddress();

  for (const invalid of [
    undefined,
    null,
    '',
    'not-an-algorand-address',
    ` ${address}`,
    `${address} `,
    address.toLowerCase(),
    123,
    {},
  ]) {
    assert.throws(() =>
      assertStakingWritableAddresses([address, invalid]),
    );
  }
});

test('validates writable addresses without changing the supplied list', () => {
  const addresses = Object.freeze([
    makeDisposableAddress(),
    makeDisposableAddress(),
  ]);
  const before = [...addresses];

  assertStakingWritableAddresses(addresses);

  assert.deepEqual(addresses, before);
});

// Synthetic identities for offline unit tests, not real network genesis hashes.
const LOCAL_GENESIS_HASH = new Uint8Array(32).fill(11);
const TEST_GENESIS_HASH = new Uint8Array(32).fill(22);

function makeInput(overrides = {}) {
  return {
    network: 'localnet',
    expectedGenesisID: 'metawork-disposable-localnet',
    expectedGenesisHash: LOCAL_GENESIS_HASH.slice(),
    suggestedParams: {
      genesisID: 'metawork-disposable-localnet',
      genesisHash: LOCAL_GENESIS_HASH.slice(),
    },
    ...overrides,
  };
}

test('accepts explicitly selected LocalNet with matching genesis identity', () => {
  assert.doesNotThrow(() => assertStakingNetwork(makeInput()));
});

test('accepts explicitly selected TestNet with matching genesis identity', () => {
  assert.doesNotThrow(() =>
    assertStakingNetwork(
      makeInput({
        network: 'testnet',
        expectedGenesisID: 'testnet-v1.0',
        expectedGenesisHash: TEST_GENESIS_HASH.slice(),
        suggestedParams: {
          genesisID: 'testnet-v1.0',
          genesisHash: TEST_GENESIS_HASH.slice(),
        },
      }),
    ),
  );
});

test('rejects missing, unsupported, and MainNet network selection', () => {
  for (const network of [
    undefined,
    null,
    '',
    'mainnet',
    'MainNet',
    'betanet',
  ]) {
    assert.throws(() => assertStakingNetwork(makeInput({ network })));
  }
});

test('rejects MainNet genesis even when the network label says LocalNet', () => {
  assert.throws(() =>
    assertStakingNetwork(
      makeInput({
        expectedGenesisID: 'mainnet-v1.0',
        suggestedParams: {
          genesisID: 'mainnet-v1.0',
          genesisHash: LOCAL_GENESIS_HASH.slice(),
        },
      }),
    ),
  );
});

test('rejects a TestNet genesis presented as LocalNet', () => {
  assert.throws(() =>
    assertStakingNetwork(
      makeInput({
        expectedGenesisID: 'testnet-v1.0',
        suggestedParams: {
          genesisID: 'testnet-v1.0',
          genesisHash: TEST_GENESIS_HASH.slice(),
        },
      }),
    ),
  );
});

test('rejects a non-TestNet genesis presented as TestNet', () => {
  assert.throws(() =>
    assertStakingNetwork(makeInput({ network: 'testnet' })),
  );
});

test('rejects mismatched genesis ID or genesis hash', () => {
  const invalidParams = [
    {
      genesisID: 'another-disposable-network',
      genesisHash: LOCAL_GENESIS_HASH.slice(),
    },
    {
      genesisID: 'metawork-disposable-localnet',
      genesisHash: TEST_GENESIS_HASH.slice(),
    },
  ];

  for (const suggestedParams of invalidParams) {
    assert.throws(() =>
      assertStakingNetwork(makeInput({ suggestedParams })),
    );
  }
});

test('requires an explicit expected genesis identity', () => {
  for (const overrides of [
    { expectedGenesisID: undefined },
    { expectedGenesisID: '' },
    { expectedGenesisHash: undefined },
    { expectedGenesisHash: new Uint8Array(0) },
    { expectedGenesisHash: new Uint8Array(31) },
    { expectedGenesisHash: new Uint8Array(33) },
    { expectedGenesisHash: 'not-decoded-genesis-bytes' },
  ]) {
    assert.throws(() => assertStakingNetwork(makeInput(overrides)));
  }
});

test('rejects missing or malformed node genesis identity', () => {
  for (const suggestedParams of [
    undefined,
    null,
    {},
    { genesisID: 'metawork-disposable-localnet' },
    {
      genesisID: '',
      genesisHash: LOCAL_GENESIS_HASH.slice(),
    },
    {
      genesisID: 'metawork-disposable-localnet',
      genesisHash: new Uint8Array(31),
    },
    {
      genesisID: 'metawork-disposable-localnet',
      genesisHash: 'not-decoded-genesis-bytes',
    },
  ]) {
    assert.throws(() =>
      assertStakingNetwork(makeInput({ suggestedParams })),
    );
  }
});

test('validates without modifying the supplied genesis bytes', () => {
  const input = makeInput();
  const expectedBefore = input.expectedGenesisHash.slice();
  const actualBefore = input.suggestedParams.genesisHash.slice();

  assertStakingNetwork(input);

  assert.deepEqual(input.expectedGenesisHash, expectedBefore);
  assert.deepEqual(input.suggestedParams.genesisHash, actualBefore);
});