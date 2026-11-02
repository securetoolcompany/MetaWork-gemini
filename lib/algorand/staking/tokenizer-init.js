import algosdk from 'algosdk';

import {
  assertStakingNetwork,
  assertStakingWritableAddresses,
} from './client.js';

const UINT64_MAX = 0xffffffffffffffffn;
const GENESIS_ID = 'dockernet-v1';
const GENESIS_HASH = algosdk.base64ToBytes(
  '0TJVyrVwfL/CRhaQzRG1mF29GzfDdG4Dzr2M5uXbg2o=',
);

const APPROVED_ROLES = Object.freeze({
  creatorInitializer:
    'QAVXZK43SGUJC7DQ2QC6LBWTAYCKDGOG7XUSFYQRJBE23GZMHN3ORHFG3M',
  staking:
    'V6C6BWQKI4LS3FCZEM5XIOHCM2SSQSIB7AXOIVSBHUNXVVEWMBWTMXRWFU',
  seedRecipient:
    'JJOIC2KGZPABBPXRWF5JP67L3VVV5GJ334YQSTSQBS3QKZARUCUSKJER4Y',
});

function requirePositiveUint64(value, name) {
  if (
    typeof value !== 'bigint' ||
    value <= 0n ||
    value > UINT64_MAX
  ) {
    throw new TypeError(`${name} must be a positive uint64 bigint`);
  }
  return value;
}

function requireMinimumFee(value) {
  if (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return BigInt(value);
  }
  return requirePositiveUint64(value, 'suggestedParams.minFee');
}

function validateRoles(roles) {
  if (
    !roles ||
    typeof roles !== 'object' ||
    Array.isArray(roles) ||
    Object.keys(roles).length !== 3
  ) {
    throw new TypeError('Exactly three explicit approved roles are required');
  }

  for (const [name, address] of Object.entries(APPROVED_ROLES)) {
    if (roles[name] !== address) {
      throw new Error(`Unapproved Tokenizer role: ${name}`);
    }
  }

  assertStakingWritableAddresses(Object.values(roles));

  if (new Set(Object.values(roles)).size !== 3) {
    throw new Error('Tokenizer roles must be distinct');
  }
}

/**
 * Prepare transactions only. No wallet, identity creation, signing, or network.
 *
 * Caller must provide fresh node parameters and separately approved live
 * application/asset identifiers. This function does not verify deployed
 * bytecode, asset parameters, balances, holdings, or current authority.
 *
 * Do not pass this group to a one-wallet-for-all signer. The signer plan
 * describes required senders; it is not a signing authorization or validator.
 */
export function buildTokenizerInitialization({
  network,
  roles,
  appID,
  assetID,
  includeRecipientOptIn,
  suggestedParams,
} = {}) {
  if (network !== 'localnet') {
    throw new Error('This Tokenizer configuration permits explicit LocalNet only');
  }

  assertStakingNetwork({
    network,
    expectedGenesisID: GENESIS_ID,
    expectedGenesisHash: GENESIS_HASH,
    suggestedParams,
  });

  validateRoles(roles);
  requirePositiveUint64(appID, 'appID');
  requirePositiveUint64(assetID, 'assetID');

  if (typeof includeRecipientOptIn !== 'boolean') {
    throw new TypeError('includeRecipientOptIn must be explicitly boolean');
  }

  const appAddress = algosdk.getApplicationAddress(appID).toString();
  assertStakingWritableAddresses([
    roles.creatorInitializer,
    roles.staking,
    roles.seedRecipient,
    appAddress,
  ]);

  const minimumFee = requireMinimumFee(suggestedParams.minFee);
  const groupSize = includeRecipientOptIn ? 3n : 2n;
  const outerFee = minimumFee * (groupSize + 1n);

  if (outerFee > UINT64_MAX) {
    throw new RangeError('Initialization fee exceeds uint64');
  }

  function params(fee) {
    return {
      ...suggestedParams,
      genesisHash: suggestedParams.genesisHash.slice(),
      flatFee: true,
      fee,
    };
  }

  const transactions = [
    algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: roles.staking,
      receiver: roles.staking,
      amount: 0n,
      rekeyTo: appAddress,
      suggestedParams: params(0n),
    }),
  ];

  if (includeRecipientOptIn) {
    transactions.push(
      algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: roles.seedRecipient,
        receiver: roles.seedRecipient,
        assetIndex: assetID,
        amount: 0n,
        suggestedParams: params(0n),
      }),
    );
  }

  transactions.push(
    algosdk.makeApplicationNoOpTxnFromObject({
      sender: roles.creatorInitializer,
      appIndex: appID,
      appArgs: [new TextEncoder().encode('initialize_seed')],
      accounts: [roles.staking, roles.seedRecipient],
      foreignAssets: [assetID],
      suggestedParams: params(outerFee),
    }),
  );

  algosdk.assignGroupID(transactions);

  const signerAssignments = transactions.map((transaction, index) =>
    Object.freeze({
      transactionIndex: index,
      sender: transaction.sender.toString(),
    }),
  );

  return Object.freeze({
    transactions,
    signerAssignments: Object.freeze(signerAssignments),
    initializerOuterFeeMicroAlgo: outerFee,
    includesRecipientOptIn: includeRecipientOptIn,
  });
}