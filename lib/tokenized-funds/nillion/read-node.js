// lib/tokenized-funds/nillion/read-node.js

import {
  createPublicClient,
  http,
  parseAbi,
} from 'viem';
import { mainnet } from 'viem/chains';

import {
  NILLION_CONTRACTS,
  NILLION_EXPECTED_OWNER,
  NILLION_RPC_URL,
  getNillionNode,
} from './config.js';

const client = createPublicClient({
  chain: mainnet,
  transport: http(NILLION_RPC_URL, {
    timeout: 15_000,
    retryCount: 2,
  }),
});

const stakingAbi = parseAbi([
  'function ownerOf(uint256 nodeId) view returns (address)',
  'function stakeOf(uint256 nodeId) view returns (uint256)',
  'function isEligibleStake(uint256 nodeId) view returns (bool eligible, uint256 stake)',
  'function retired(uint256 nodeId) view returns (bool)',
  'function getUnbonding(uint256 nodeId) view returns ((uint256 amount, uint64 releaseTime)[])',
]);

const registryAbi = parseAbi([
  'function keyValid(uint256 nodeId) view returns (bool)',
]);

const triggerMarketAbi = parseAbi([
  'function accruedEarnings(uint256 nodeId) view returns (uint256)',
  'function sharesPostedBy(uint256 nodeId) view returns (uint256)',
]);

const emissionsAbi = parseAbi([
  'function enrolled(uint256 nodeId) view returns (bool)',
  'function enrolledStake(uint256 nodeId) view returns (uint256)',
  'function snapshotIndex(uint256 nodeId) view returns (uint256)',
  'function accrued(uint256 nodeId) view returns (uint256)',
  'function index() view returns (uint256)',
  'function lastTouch() view returns (uint64)',
  'function totalEnrolled() view returns (uint256)',
  'function rate() view returns (uint256)',
]);

function nodeCall(address, abi, functionName, nodeId) {
  return {
    address,
    abi,
    functionName,
    args: [nodeId],
  };
}

function networkCall(functionName) {
  return {
    address: NILLION_CONTRACTS.emissions,
    abi: emissionsAbi,
    functionName,
  };
}

export async function readNillionNode(nodeId) {
  const node = getNillionNode(nodeId);

  if (!node) {
    throw new Error(`Unknown Nillion node: ${String(nodeId)}`);
  }

  const id = BigInt(node.id);
  const block = await client.getBlock({
    blockTag: 'latest',
  });

  if (block.number === null) {
    throw new Error('Unable to determine the Ethereum block number.');
  }

  const results = await client.multicall({
    blockNumber: block.number,
    allowFailure: false,
    contracts: [
      nodeCall(
        NILLION_CONTRACTS.staking,
        stakingAbi,
        'ownerOf',
        id,
      ),
      nodeCall(
        NILLION_CONTRACTS.staking,
        stakingAbi,
        'stakeOf',
        id,
      ),
      nodeCall(
        NILLION_CONTRACTS.staking,
        stakingAbi,
        'isEligibleStake',
        id,
      ),
      nodeCall(
        NILLION_CONTRACTS.staking,
        stakingAbi,
        'retired',
        id,
      ),
      nodeCall(
        NILLION_CONTRACTS.staking,
        stakingAbi,
        'getUnbonding',
        id,
      ),
      nodeCall(
        NILLION_CONTRACTS.nodeRegistry,
        registryAbi,
        'keyValid',
        id,
      ),
      nodeCall(
        NILLION_CONTRACTS.emissions,
        emissionsAbi,
        'enrolled',
        id,
      ),
      nodeCall(
        NILLION_CONTRACTS.emissions,
        emissionsAbi,
        'enrolledStake',
        id,
      ),
      nodeCall(
        NILLION_CONTRACTS.emissions,
        emissionsAbi,
        'snapshotIndex',
        id,
      ),
      nodeCall(
        NILLION_CONTRACTS.emissions,
        emissionsAbi,
        'accrued',
        id,
      ),
      networkCall('index'),
      networkCall('lastTouch'),
      networkCall('totalEnrolled'),
      networkCall('rate'),
    ],
  });

  const [
    owner,
    stake,
    eligibleStake,
    retired,
    unbonding,
    keyValid,
    enrolled,
    enrolledStake,
    snapshotIndex,
    accrued,
    index,
    lastTouch,
    totalEnrolled,
    rate,
  ] = results;

  const [stakeEligible, eligibilityStake] = eligibleStake;

  // ETH job earnings are supplementary. A failure here must not
  // take down the NIL dashboard.
  let eth = {
    available: false,
    accruedWei: null,
    sharesPosted: null,
  };

  try {
    const ethResults = await client.multicall({
      blockNumber: block.number,
      allowFailure: true,
      contracts: [
        nodeCall(
          NILLION_CONTRACTS.triggerMarket,
          triggerMarketAbi,
          'accruedEarnings',
          id,
        ),
        nodeCall(
          NILLION_CONTRACTS.triggerMarket,
          triggerMarketAbi,
          'sharesPostedBy',
          id,
        ),
      ],
    });

    if (ethResults.every((entry) => entry.status === 'success')) {
      eth = {
        available: true,
        accruedWei: ethResults[0].result.toString(),
        sharesPosted: ethResults[1].result.toString(),
      };
    }
  } catch (error) {
    console.error('[nillion/read-node] ETH earnings read failed:', error);
  }

  const ownerMatches =
    owner.toLowerCase() === NILLION_EXPECTED_OWNER.toLowerCase();

  const stakeSynced = enrolledStake === stake;

  const warnings = [];

  if (!ownerMatches) {
    warnings.push('Node owner differs from the configured operating wallet.');
  }

  if (!stakeEligible) {
    warnings.push('Node stake is not eligible for rewards.');
  }

  if (!keyValid) {
    warnings.push('Node key is not valid.');
  }

  if (!enrolled) {
    warnings.push('Node is not enrolled in emissions.');
  }

  if (retired) {
    warnings.push('Node is retired.');
  }

  if (!stakeSynced) {
    warnings.push('Emission stake differs from the bonded node stake.');
  }

  if (unbonding.length > 0) {
    warnings.push('Node has stake in the unbonding process.');
  }

  // Convert chain integers to strings so the result is JSON-safe.
  // Reward calculations will convert these back to BigInt.
  return {
    nodeId: node.id,
    name: node.name,
    chainId: mainnet.id,
    blockNumber: block.number.toString(),
    blockTimestamp: block.timestamp.toString(),
    fetchedAt: new Date().toISOString(),

    owner,
    expectedOwner: NILLION_EXPECTED_OWNER,
    ownerMatches,

    stakeBaseUnits: stake.toString(),
    eligibilityStakeBaseUnits: eligibilityStake.toString(),
    enrolledStakeBaseUnits: enrolledStake.toString(),

    status: {
      earning: enrolled && stakeEligible && keyValid && !retired,
      enrolled,
      stakeEligible,
      keyValid,
      retired,
      stakeSynced,
    },

    unbonding: unbonding.map((tranche) => ({
      amountBaseUnits: tranche.amount.toString(),
      releaseTime: tranche.releaseTime.toString(),
    })),

    emissions: {
      accruedBaseUnits: accrued.toString(),
      snapshotIndex: snapshotIndex.toString(),
      index: index.toString(),
      lastTouch: lastTouch.toString(),
      totalEnrolledBaseUnits: totalEnrolled.toString(),
      rateBaseUnitsPerSecond: rate.toString(),
    },
		eth,
    warnings,
  };
}