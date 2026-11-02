import { mkdir, writeFile } from 'node:fs/promises';
import { simulateArcGateRisk } from './simulate-galaxy-arc-gate-risk.mjs';
import {
  parseAbi,
  decodeFunctionData,
  encodeFunctionData,
  decodeFunctionResult,
  encodeAbiParameters,
  keccak256,
  toFunctionSelector,
  toHex,
} from 'viem';

const abi = parseAbi([
  'function decimals() view returns (uint8)',
  'function setName(string)',
  'function setSymbol(string)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function owner() view returns (address)',
  'function curator() view returns (address)',
  'function performanceFeeRecipient() view returns (address)',
  'function asset() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function transfer(address,uint256) returns (bool)',
  'function setCurator(address)',
  'function setIsSentinel(address,bool)',
  'function isSentinel(address) view returns (bool)',
  'function submit(bytes)',
  'function increaseTimelock(bytes4,uint256)',
  'function timelock(bytes4) view returns (uint256)',
  'function abdicate(bytes4)',
  'function abdicated(bytes4) view returns (bool)',
  'function multicall(bytes[])',
  'function setPerformanceFeeRecipient(address)',
  'function setPerformanceFee(uint256)',
  'function performanceFee() view returns (uint96)',
  'function managementFee() view returns (uint96)',
  'function setForceDeallocatePenalty(address,uint256)',
  'function forceDeallocatePenalty(address) view returns (uint256)',
  'function addAdapter(address)',
  'function isAdapter(address) view returns (bool)',
  'function setIsAllocator(address,bool)',
  'function increaseAbsoluteCap(bytes,uint256)',
  'function increaseRelativeCap(bytes,uint256)',
  'function setMaxRate(uint256)',
  'function setLiquidityAdapterAndData(address,bytes)',
  'function liquidityAdapter() view returns (address)',
  'function receiveSharesGate() view returns (address)',
  'function sendSharesGate() view returns (address)',
  'function receiveAssetsGate() view returns (address)',
  'function morpho() view returns (address)',
  'function mint(uint256,address) returns (uint256)',
  'function deposit(uint256,address) returns (uint256)',
  'function redeem(uint256,address,address) returns (uint256)',
]);

const customer = '0x1111111111111111111111111111111111111111';
const dead = '0x000000000000000000000000000000000000dead';
const zero = '0x0000000000000000000000000000000000000000';

const encode = (functionName, args = []) =>
  encodeFunctionData({ abi, functionName, args });

const decode = (output, functionName) =>
  decodeFunctionResult({
    abi, functionName, data: output.returnData,
  });

const same = (a, b) =>
  typeof a === 'string' && typeof b === 'string'
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;

function requireCheck(condition, message) {
  if (!condition) throw new Error(message);
}

export async function simulateArcRoundTrip({
  client,
  simulate,
  product,
  owner,
  wrapper,
  adapter,
  createVault,
  createAdapter,
  blockNumber,
}) {
  const read = async (address, functionName, args = []) => {
    await new Promise(resolve => setTimeout(resolve, 750));
    return client.readContract({
      address, abi, functionName, args, blockNumber,
    });
  };

  const call = (
    to,
    functionName,
    args = [],
    from = owner,
    gas = 200_000n,
  ) => ({
    from,
    to,
    data: encode(functionName, args),
    gas: toHex(gas),
  });

  requireCheck(
    same(await read(product.underlying, 'asset'), product.asset),
    'Underlying asset mismatch.',
  );

  const decimals = await read(product.asset, 'decimals');
  requireCheck(decimals === 6, 'Expected verified 6-decimal asset.');

  // Read the market contract through the underlying vault's actual adapter.
  const underlyingAdapter = await read(product.underlying, 'liquidityAdapter');
  const morpho = await read(underlyingAdapter, 'morpho');

  const fundingAmount = 3_000_000n;
  const depositAmount = 1_000_000n;
  const protectionBudget = 1_000_000n;
  const protectionShares = 10n ** 18n;

  // Impersonated transfers exist ONLY inside eth_simulateV1.
  // No private key, signature, real transfer, or storage override is used.
  let fundingSource = null;

  for (const candidate of [morpho, product.underlying]) {
    const balance = await read(product.asset, 'balanceOf', [candidate]);
    if (balance >= fundingAmount) {
      fundingSource = candidate;
      break;
    }
  }

  requireCheck(fundingSource, 'No sufficiently funded simulation fixture found.');

  const customerBefore = await read(
    product.asset, 'balanceOf', [customer],
  );

  const identities = {
    'galaxy-usdc-arc': {
      name: 'MetaWork Galaxy USDC on Arc',
      symbol: 'mwGUSDCa',
    },
    'galaxy-eurc-arc': {
      name: 'MetaWork Galaxy EURC on Arc',
      symbol: 'mwGEURCa',
    },
  };

  const identity = identities[product.id];
  requireCheck(identity, 'Unknown Arc product.');

  const configuration = [
    encode('setCurator', [owner]),
    encode('setIsSentinel', [owner, true]),
    encode('setName', [identity.name]),
    encode('setSymbol', [identity.symbol]),
  ];

  function configure(functionName, args) {
    const data = encode(functionName, args);
    configuration.push(encode('submit', [data]), data);
  }

  configure('setPerformanceFeeRecipient', [owner]);
  configure('setPerformanceFee', [100_000_000_000_000_000n]);

  // Approved Arc policy: zero penalty, setter retained.
  // The existing nine-timelock configuration installs a 48-hour delay.
  configure('setForceDeallocatePenalty', [adapter, 0n]);

  const gates = [
    ['receiveSharesGate', 'setReceiveSharesGate(address)'],
    ['sendSharesGate', 'setSendSharesGate(address)'],
    ['receiveAssetsGate', 'setReceiveAssetsGate(address)'],
  ];

  for (const [, signature] of gates) {
    configure('abdicate', [toFunctionSelector(signature)]);
  }

  configure('addAdapter', [adapter]);

  for (const signature of ['addAdapter(address)', 'removeAdapter(address)']) {
    configure('abdicate', [toFunctionSelector(signature)]);
  }

  const idData = encodeAbiParameters(
    [{ type: 'string' }, { type: 'address' }],
    ['this', adapter],
  );

  configure('setIsAllocator', [owner, true]);
  configure('increaseAbsoluteCap', [idData, (1n << 128n) - 1n]);
  configure('increaseRelativeCap', [idData, 10n ** 18n]);
  configure('setMaxRate', [2n * 10n ** 18n / 31_536_000n]);

  configuration.push(
    encode('setLiquidityAdapterAndData', [adapter, '0x']),
    encode('mint', [protectionShares, dead]),
  );

  // Simulation proposal: the nine durations in the Enhanced review plan.
  // Install after initial setup and protection mint.
  const administratorTimelocks = [
    ['setPerformanceFee(uint256)', 172800n],
    ['setManagementFee(uint256)', 172800n],
    ['setPerformanceFeeRecipient(address)', 172800n],
    ['setManagementFeeRecipient(address)', 172800n],
    ['setForceDeallocatePenalty(address,uint256)', 172800n],
    ['setIsAllocator(address,bool)', 86400n],
    ['setSendAssetsGate(address)', 259200n],
    ['increaseAbsoluteCap(bytes,uint256)', 259200n],
    ['increaseRelativeCap(bytes,uint256)', 259200n],
  ];

  for (const [signature, seconds] of administratorTimelocks) {
    configure('increaseTimelock', [
      toFunctionSelector(signature),
      seconds,
    ]);
  }

  const prefix = [
    createVault,
    createAdapter,
    call(
      product.asset, 'transfer', [owner, fundingAmount], fundingSource,
    ),
    call(product.asset, 'approve', [wrapper, protectionBudget]),
    call(wrapper, 'multicall', [configuration], owner, 5_000_000n),
    call(product.asset, 'transfer', [customer, depositAmount]),
    call(product.asset, 'approve', [wrapper, depositAmount], customer),
    call(
      wrapper, 'deposit', [depositAmount, customer],
      customer, 3_000_000n,
    ),
  ];

  const checks = [
    [wrapper, 'name', [], identity.name],
    [wrapper, 'symbol', [], identity.symbol],
    [wrapper, 'owner', [], owner],
    [wrapper, 'curator', [], owner],
    [wrapper, 'isSentinel', [owner], true],
    [wrapper, 'performanceFeeRecipient', [], owner],
    [wrapper, 'decimals', [], 18],
    [wrapper, 'performanceFee', [], 100_000_000_000_000_000n],
    [wrapper, 'managementFee', [], 0n],
    [wrapper, 'forceDeallocatePenalty', [adapter], 0n],
    [
      wrapper,
      'abdicated',
      [toFunctionSelector('setForceDeallocatePenalty(address,uint256)')],
      false,
    ],
    [wrapper, 'isAdapter', [adapter], true],
    [wrapper, 'liquidityAdapter', [], adapter],
    [wrapper, 'balanceOf', [dead], protectionShares],
    [wrapper, 'abdicated', [toFunctionSelector('addAdapter(address)')], true],
    [wrapper, 'abdicated', [toFunctionSelector('removeAdapter(address)')], true],
  ];

  for (const [getter, setter] of gates) {
    checks.push(
      [wrapper, getter, [], zero],
      [wrapper, 'abdicated', [toFunctionSelector(setter)], true],
    );
  }

  for (const [signature, seconds] of administratorTimelocks) {
    checks.push([
      wrapper,
      'timelock',
      [toFunctionSelector(signature)],
      seconds,
    ]);
  }

  const depositOutputs = await simulate([
    ...prefix,
    ...checks.map(([address, name, args]) => call(address, name, args)),
    call(wrapper, 'balanceOf', [customer]),
    call(product.underlying, 'balanceOf', [adapter]),
  ]);

  for (const [index, [, name, , expected]] of checks.entries()) {
    const actual = decode(depositOutputs[prefix.length + index], name);
    requireCheck(same(actual, expected), `${name}: configuration check failed.`);
  }

  const shares = decode(depositOutputs[7], 'deposit');
  const positionIndex = prefix.length + checks.length;

  requireCheck(shares > 0n, 'Customer received no position shares.');
  requireCheck(
    decode(depositOutputs[positionIndex], 'balanceOf') === shares,
    'Customer position does not match deposited shares.',
  );
  requireCheck(
    decode(depositOutputs[positionIndex + 1], 'balanceOf') > 0n,
    'Adapter has no underlying-vault shares: routing not established.',
  );

  const redemptionOutputs = await simulate([
    ...prefix,
    call(
      wrapper, 'redeem', [shares, customer, customer],
      customer, 3_000_000n,
    ),
    call(wrapper, 'balanceOf', [customer]),
    call(product.asset, 'balanceOf', [customer]),
    call(wrapper, 'balanceOf', [dead]),
    call(product.asset, 'allowance', [customer, wrapper]),
  ]);

  const offset = prefix.length;
  const redeemed = decode(redemptionOutputs[offset], 'redeem');
  const remaining = decode(redemptionOutputs[offset + 1], 'balanceOf');
  const customerAfter = decode(redemptionOutputs[offset + 2], 'balanceOf');
  const protection = decode(redemptionOutputs[offset + 3], 'balanceOf');
  const allowance = decode(redemptionOutputs[offset + 4], 'allowance');

  requireCheck(redeemed > 0n, 'Redemption returned no assets.');
  requireCheck(remaining === 0n, 'Customer position was not fully redeemed.');
  requireCheck(protection === protectionShares, 'Protection shares changed.');
  requireCheck(allowance === 0n, 'Exact-amount allowance was not consumed.');
  requireCheck(
    customerAfter - customerBefore === redeemed,
    'Customer token balance does not match redeemed assets.',
  );

  const difference = depositAmount - redeemed;
  requireCheck(
    (difference < 0n ? -difference : difference) <= 10n,
    'Round-trip difference exceeds 10 atomic units.',
  );

  const gateRisk = await simulateArcGateRisk({
    client, product, owner, wrapper, adapter, blockNumber,
    prefix, shares, customer, dead, protectionShares, depositAmount,
  });

  const creation = decodeFunctionData({
    abi: parseAbi([
      'function createVaultV2(address owner,address asset,bytes32 salt) returns (address)',
    ]),
    data: createVault.data,
  });

  const deploymentSteps = [
    ['Create Tokenizer vault', 0],
    ['Create Tokenizer adapter', 1],
    ['Approve protection deposit only', 3],
    ['Configure Tokenizer, mint protection, install timelocks', 4],
  ];

  const plan = {
    schemaVersion: 1,
    status: 'review-only-not-authorized',
    productId: product.id,
    chainId: 5042,
    simulationBlockNumber: blockNumber.toString(),
    administrator: owner,
    feeRecipient: owner,
    sentinel: owner,
    sentinelPolicyConfirmed: true,
    childVault: product.underlying,
    asset: product.asset,
    assetDecimals: decimals,
    vaultFactory: createVault.to,
    adapterFactory: createAdapter.to,
    salt: creation.args[2],
    predictedTokenizerAddress: wrapper,
    predictedAdapterAddress: adapter,
    name: identity.name,
    symbol: identity.symbol,
    performanceFeeBps: 1000,
    managementFeeBps: 0,
    forceDeallocatePenaltyBps: 0,
    forceDeallocatePenaltySetterAbdicated: false,
    forceDeallocatePenaltyChangeTimelockSeconds: '172800',
    forceDeallocatePenaltyPolicyConfirmed: true,
    commercialSettingsConfirmed: true,
    protectionRecipient: dead,
    protectionSharesRaw: protectionShares.toString(),
    protectionAssetBudgetRaw: protectionBudget.toString(),
    administratorTimelocks: administratorTimelocks.map(
      ([signature, seconds]) => ({
        signature,
        seconds: seconds.toString(),
      }),
    ),
    transactions: deploymentSteps.map(([label, index], sequence) => {
      const request = prefix[index];
      return {
        sequence: sequence + 1,
        label,
        chainId: 5042,
        from: request.from,
        to: request.to,
        value: '0',
        data: request.data,
        calldataHash: keccak256(request.data),
        simulationGasCeiling: BigInt(request.gas).toString(),
        simulatedGasUsed: BigInt(depositOutputs[index].gasUsed).toString(),
        transactionGasLimitApproved: false,
      };
    }),
    requiredBeforeAnyBroadcast: [
      'Verify current factory provenance, bytecode and address availability.',
      'Test retained underlying Send Assets Gate risk and review disclosures.',
      'Review retained owner/curator/allocator powers and recovery procedures.',
      'Review the interval between creation and final configuration.',
      'Verify actual administrator funding and current native-USDC gas budget.',
      'For USDC, budget gas and protection from one shared USDC balance.',
      'For EURC, budget USDC gas separately from EURC protection assets.',
      'Finalize transaction gas limits and fees; simulation ceilings are not approved limits.',
      'Review exact calldata and obtain separate transaction approval.',
    ],
    excludedFromDeployment: [
      'Impersonated funding transfers.',
      'Customer funding, approvals, deposits and redemptions.',
      'Governance impersonation and test fixtures.',
    ],
    underlyingGateRiskSimulation: gateRisk,
    deploymentAuthorized: false,
    customerDepositsEnabled: false,
    transactionsSent: 0,
  };

  const directory = 'output/galaxy-arc-plans';
  await mkdir(directory, { recursive: true });

  const reviewPlanFile =
    directory + '/' + product.id + '.' +
    wrapper.toLowerCase() + '.review.json';

  await writeFile(
    reviewPlanFile,
    JSON.stringify(plan, null, 2) + '\n',
    { encoding: 'utf8', flag: 'wx' },
  );

  return {
    ...gateRisk,
    reviewPlanFile,
    deploymentPlanTransactions: plan.transactions.length,
    approvedNameAndSymbolVerified: true,
    sentinel: owner,
    sentinelAssignmentVerified: true,
    customerApprovalDepositRedemptionPassed: true,
    forceDeallocationPenaltyPercent: '0%',
    forceDeallocationPenaltySetterRetained: true,
    forceDeallocationPenaltyChangeDelaySeconds: '172800',
    depositedAtomic: depositAmount.toString(),
    redeemedAtomic: redeemed.toString(),
    differenceAtomic: difference.toString(),
    remainingCustomerShares: remaining.toString(),
    protectionSharesPreserved: true,
    administratorTimelocksVerified: administratorTimelocks.length,
    administratorTimelocksSimulationOnly: true,
    simulationFundingOnly: true,
    productionPolicyVerified: false,
    gasAffordabilityVerified: false,
  };
}