import algosdk from 'algosdk';

const PROTECTED_PRODUCTION_ADDRESS =
  '73C6PQVLAPE6M2GFV3ZKXJRHCNZ4P75GY3LMTHJ7MS2MALZJ6RRJKNWHBU';

export function assertStakingWritableAddresses(addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    fail(
      'An explicit non-empty writable-address list is required',
      'INVALID_WRITABLE_ADDRESSES',
    );
  }

  for (const address of addresses) {
    if (
      typeof address !== 'string' ||
      address.length !== 58 ||
      !/^[A-Z2-7]{58}$/.test(address) ||
      !algosdk.isValidAddress(address)
    ) {
      fail(
        'Every writable address must be a canonical Algorand address',
        'INVALID_WRITABLE_ADDRESS',
      );
    }

    if (address === PROTECTED_PRODUCTION_ADDRESS) {
      fail(
        'The production reference account must not be a sender or writable target',
        'PRODUCTION_ACCOUNT_FORBIDDEN',
      );
    }
  }
}

export class StakingValidationError extends Error {
  constructor(message, { code = 'STAKING_VALIDATION_ERROR' } = {}) {
    super(message);
    this.name = 'StakingValidationError';
    this.code = code;
  }
}

function fail(message, code) {
  throw new StakingValidationError(message, { code });
}

function assertGenesisID(value, fieldName) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    fail(
      `${fieldName} must be an explicit non-empty genesis ID`,
      'INVALID_GENESIS_ID',
    );
  }

  return value;
}

function assertGenesisHash(value, fieldName) {
  if (!(value instanceof Uint8Array) || value.length !== 32) {
    fail(
      `${fieldName} must contain exactly 32 decoded genesis-hash bytes`,
      'INVALID_GENESIS_HASH',
    );
  }

  return value;
}

function assertNetworkGenesisID(network, genesisID) {
  const normalized = genesisID.toLowerCase();

  if (normalized.includes('mainnet')) {
    fail(
      'MainNet genesis is forbidden for ALGO staking development',
      'MAINNET_FORBIDDEN',
    );
  }

  if (network === 'testnet' && genesisID !== 'testnet-v1.0') {
    fail(
      'TestNet selection requires the testnet-v1.0 genesis ID',
      'NETWORK_GENESIS_MISMATCH',
    );
  }

  if (
    network === 'localnet' &&
    (normalized.includes('testnet') || normalized.includes('betanet'))
  ) {
    fail(
      'LocalNet selection must not use a public-network genesis ID',
      'NETWORK_GENESIS_MISMATCH',
    );
  }
}

export function assertStakingNetwork({
  network,
  expectedGenesisID,
  expectedGenesisHash,
  suggestedParams,
} = {}) {
  if (
    typeof network === 'string' &&
    network.toLowerCase().includes('mainnet')
  ) {
    fail(
      'MainNet is forbidden for ALGO staking development',
      'MAINNET_FORBIDDEN',
    );
  }

  if (network !== 'localnet' && network !== 'testnet') {
    fail(
      'Explicit network selection is required: localnet or testnet',
      'INVALID_NETWORK',
    );
  }

  const expectedID = assertGenesisID(
    expectedGenesisID,
    'expectedGenesisID',
  );
  const expectedHash = assertGenesisHash(
    expectedGenesisHash,
    'expectedGenesisHash',
  );

  if (
    !suggestedParams ||
    typeof suggestedParams !== 'object' ||
    Array.isArray(suggestedParams)
  ) {
    fail(
      'Node suggested parameters are required for genesis validation',
      'INVALID_SUGGESTED_PARAMS',
    );
  }

  const actualID = assertGenesisID(
    suggestedParams.genesisID,
    'suggestedParams.genesisID',
  );
  const actualHash = assertGenesisHash(
    suggestedParams.genesisHash,
    'suggestedParams.genesisHash',
  );

  assertNetworkGenesisID(network, expectedID);
  assertNetworkGenesisID(network, actualID);

  if (actualID !== expectedID) {
    fail(
      'Node genesis ID does not match the explicitly configured genesis ID',
      'GENESIS_ID_MISMATCH',
    );
  }

  for (let index = 0; index < expectedHash.length; index += 1) {
    if (actualHash[index] !== expectedHash[index]) {
      fail(
        'Node genesis hash does not match the explicitly configured genesis hash',
        'GENESIS_HASH_MISMATCH',
      );
    }
  }
}