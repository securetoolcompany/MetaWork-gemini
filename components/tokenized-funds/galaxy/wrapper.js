// lib/tokenized-funds/galaxy/wrapper.js

import {
  getAddress,
  isAddress,
  parseAbi,
  zeroAddress,
} from 'viem';

import { GALAXY_USDC } from './config';

import {
  simulateGalaxyWrapperDeployment,
} from '../../../lib/tokenized-funds/galaxy/wrapper';

export const feeWrapperDeployerAbi = parseAbi([
  'function createFeeWrapper(address morphoVaultV2Factory, address morphoVaultV1AdapterFactory, (address owner, bytes32 salt, address childVault, string name, string symbol, uint256 performanceFee, uint256 managementFee, address feeRecipient, bool abdicateNonCriticalGates) config) returns (address vault)',
  'function feeWrapperSalt(address caller, address owner, address childVault, bytes32 userSalt) pure returns (bytes32)',
  'function isChildVaultFullyNonCustodial(address childVault) view returns (bool)',
  'event FeeWrapperCreated(address indexed vault, address indexed caller, address indexed owner, address childVault, bytes32 userSalt)',
]);

const factoryAbi = parseAbi([
  'function isVaultV2(address vault) view returns (bool)',
]);

const vaultAbi = parseAbi([
  'function asset() view returns (address)',
]);

const tokenAbi = parseAbi([
  'function decimals() view returns (uint8)',
]);

export const METAWORK_WRAPPER = Object.freeze({
  productId: 'galaxy-usdc-enhanced-ethereum',
  name: 'MetaWork Galaxy USDC Enhanced',
  symbol: 'mwGUSDCe',
  chainId: 1,

  // WAD encoding: 10% performance fee.
  performanceFee: 100_000_000_000_000_000n,
  managementFee: 0n,
});

function checkedAddress(value, label) {
  if (
    typeof value !== 'string' ||
    !isAddress(value) ||
    value.toLowerCase() === zeroAddress
  ) {
    throw new Error(`${label} must be a valid nonzero address.`);
  }

  return getAddress(value);
}

/**
 * Read-only deployment preflight and eth_call simulation.
 * Does not request a signature or send a transaction.
 *
 * Required inputs:
 * - deployer
 * - vaultFactory
 * - adapterFactory
 * - caller
 * - administrator
 * - expectedAsset
 * - expectedAssetDecimals
 * - salt
 * - abdicateNonCriticalGates
 */
export async function simulateGalaxyWrapperDeployment(client, inputs) {
  if (!client || !inputs) {
    throw new Error('A public client and deployment inputs are required.');
  }

  const chainId = await client.getChainId();

  if (chainId !== METAWORK_WRAPPER.chainId) {
    throw new Error('Ethereum mainnet is required (chain ID 1).');
  }

  if (
    typeof inputs.salt !== 'string' ||
    !/^0x[0-9a-fA-F]{64}$/.test(inputs.salt)
  ) {
    throw new Error('Deployment salt must be exactly 32 bytes.');
  }

  if (
    typeof inputs.abdicateNonCriticalGates !== 'boolean'
  ) {
    throw new Error(
      'Explicitly select abdicateNonCriticalGates: true or false.',
    );
  }

  if (
    !Number.isInteger(inputs.expectedAssetDecimals) ||
    inputs.expectedAssetDecimals < 0 ||
    inputs.expectedAssetDecimals > 255
  ) {
    throw new Error('Expected asset decimals must be an integer from 0–255.');
  }

  const deployer = checkedAddress(inputs.deployer, 'Deployer');
  const vaultFactory = checkedAddress(
    inputs.vaultFactory,
    'Vault factory',
  );
  const adapterFactory = checkedAddress(
    inputs.adapterFactory,
    'Adapter factory',
  );
  const caller = checkedAddress(inputs.caller, 'Deployment caller');
  const administrator = checkedAddress(
    inputs.administrator,
    'Administrator',
  );
  const expectedAsset = checkedAddress(
    inputs.expectedAsset,
    'Expected asset',
  );
  const childVault = checkedAddress(
    GALAXY_USDC.underlyingVault,
    'Underlying vault',
  );
  const feeRecipient = checkedAddress(
    GALAXY_USDC.feeRecipient,
    'Fee recipient',
  );

  const blockNumber = await client.getBlockNumber();

  const contracts = [
    ['Deployer', deployer],
    ['Vault factory', vaultFactory],
    ['Adapter factory', adapterFactory],
    ['Underlying vault', childVault],
    ['Deposit asset', expectedAsset],
  ];

  await Promise.all(
    contracts.map(async ([label, address]) => {
      const code = await client.getCode({
        address,
        blockNumber,
      });

      if (!code || code === '0x') {
        throw new Error(`${label} has no deployed code.`);
      }
    }),
  );

  const isV2 = await client.readContract({
    address: vaultFactory,
    abi: factoryAbi,
    functionName: 'isVaultV2',
    args: [childVault],
    blockNumber,
  });

  if (!isV2) {
    throw new Error(
      'Underlying vault is not registered by the supplied V2 factory.',
    );
  }

  const asset = await client.readContract({
    address: childVault,
    abi: vaultAbi,
    functionName: 'asset',
    blockNumber,
  });

  if (getAddress(asset) !== expectedAsset) {
    throw new Error(
      'Underlying deposit asset does not match the expected USDC address.',
    );
  }

  const decimals = await client.readContract({
    address: asset,
    abi: tokenAbi,
    functionName: 'decimals',
    blockNumber,
  });

  if (Number(decimals) !== inputs.expectedAssetDecimals) {
    throw new Error('Deposit asset decimals do not match.');
  }

  const childFullyNonCustodial = await client.readContract({
    address: deployer,
    abi: feeWrapperDeployerAbi,
    functionName: 'isChildVaultFullyNonCustodial',
    args: [childVault],
    blockNumber,
  });

  if (
    inputs.abdicateNonCriticalGates &&
    !childFullyNonCustodial
  ) {
    throw new Error(
      'Automatic gate abdication would revert with the current ' +
        'underlying permissions. No transaction was sent.',
    );
  }

  const config = {
    owner: administrator,
    salt: inputs.salt,
    childVault,
    name: METAWORK_WRAPPER.name,
    symbol: METAWORK_WRAPPER.symbol,
    performanceFee: METAWORK_WRAPPER.performanceFee,
    managementFee: METAWORK_WRAPPER.managementFee,
    feeRecipient,
    abdicateNonCriticalGates: inputs.abdicateNonCriticalGates,
  };

  const simulation = await client.simulateContract({
    account: caller,
    address: deployer,
    abi: feeWrapperDeployerAbi,
    functionName: 'createFeeWrapper',
    args: [vaultFactory, adapterFactory, config],
    blockNumber,
  });

  return {
    status: 'simulated-not-deployed',
    blockNumber,
    chainId,
    deployer,
    vaultFactory,
    adapterFactory,
    caller,
    administrator,
    feeRecipient,
    childVault,
    asset,
    decimals: Number(decimals),
    config,
    childFullyNonCustodial,
    predictedWrapperAddress: simulation.result,
    request: simulation.request,

    // Successful simulation alone never enables customer deposits.
    customerDepositsEnabled: false,

    remainingLaunchRequirements: [
      'Verify deployer implementation and factory provenance.',
      'Approve administrator powers and timelocks.',
      'Verify final wrapper gates and abdications.',
      'Verify force-deallocation penalty and scope.',
      'Complete and verify the initial protection deposit.',
      'Test deposits, withdrawals, and fee accrual on a fork.',
    ],
  };
}