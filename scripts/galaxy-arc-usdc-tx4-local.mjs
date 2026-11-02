import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { config } from 'dotenv';
import {
  createPublicClient, http, parseAbi, getAddress,
  keccak256, decodeFunctionData, decodeFunctionResult, encodeFunctionData, toHex,
} from 'viem';

config({ path: '.env.local', quiet: true });

const rpc = process.env.ARC_SIMULATION_RPC_URL?.trim();
assert.ok(rpc, 'ARC_SIMULATION_RPC_URL missing.');

const PLAN_PATH =
  'output/galaxy-arc-plans/galaxy-usdc-arc.0xa6870d240db24ab2c626d52fb621241e8c86441e.review.json';
const PLAN_HASH =
  '5a1bb59c006dd2ad3cd1d6cc7e27dccfef6b4ec45769cdc16c35af0537c069ca';
const OPERATOR = '0x39bb4a10626b58430abfa8284b0f001f49734f70';
const FACTORY = '0xa6870d240db24ab2c626d52fb621241e8c86441e';
const VAULT = '0xa6870d240db24ab2c626d52fb621241e8c86441e';
const ADAPTER = '0xedb5d5691d143a7ce52c42d98495a781e91fbba5';
const USDC = '0x3600000000000000000000000000000000000000';
const CALLDATA_HASH =
  '0x15cdb888c7893995798843d07b05ef76c89adaa94aed7074888de4a2e03722ff';
const FACTORY_CODE_HASH =
  '0x4e1024d5bfd17914a3ca6ad49905eabdfd60122ccd5a577406e7a4a765bd49ad';
const ANCHOR_BLOCK = 29073000n;
const ANCHOR_HASH =
  '0x5537de370a81daded6b27ce3338ebc03a0402f9583d0cc6f434934741fab7f50';

const GAS = 5_000_000n;
const MAX_FEE = 42_000_000_000n;
const TIP = 1_000_000_000n;
const NONCE = 4;
const COMBINED_RESERVE =
  22_200_000n * MAX_FEE + 1_000_000_000_000_000_000n;

const same = (a, b) => getAddress(a) === getAddress(b);
const digest = raw => createHash('sha256').update(raw).digest('hex');

const raw = readFileSync(PLAN_PATH);
assert.equal(digest(raw), PLAN_HASH, 'Approved plan changed.');
const approvedPlan = JSON.parse(raw.toString());

const PAYLOAD = Object.freeze({
  from: OPERATOR,
  to: FACTORY,
  chainId: '0x13b2',
  nonce: '0x4',
  data: approvedPlan.transactions[3].data,
  value: '0x0',
  gas: '0x4c4b40',
  maxFeePerGas: '0x9c7652400',
  maxPriorityFeePerGas: '0x3b9aca00',
});

assert.equal(keccak256(PAYLOAD.data), CALLDATA_HASH);
assert.equal(BigInt(PAYLOAD.gas), GAS);
assert.equal(BigInt(PAYLOAD.maxFeePerGas), MAX_FEE);
assert.equal(BigInt(PAYLOAD.maxPriorityFeePerGas), TIP);

const factoryAbi = parseAbi([
  'function multicall(bytes[])',
]);
const vaultAbi = parseAbi([
  'function owner() view returns (address)',
  'function asset() view returns (address)',
]);

const client = createPublicClient({
  transport: http(rpc, { timeout: 90_000, retryCount: 0 }),
});
const port = 8787;
const origin = 'http://127.0.0.1:' + port;
const secret = randomBytes(24).toString('hex');
const root = '/' + secret + '/';
let verifying = false;

function safeMessage(error) {
  return String(error?.shortMessage || error?.message || error)
    .split(rpc).join('[REDACTED_RPC_URL]')
    .replace(/https?:\/\/[^\s"'<>]+/g, '[REDACTED_URL]')
    .slice(0, 1800);
}

function readPlan() {
  const raw = readFileSync(PLAN_PATH);
  assert.equal(digest(raw), PLAN_HASH, 'Approved plan changed.');
  const p = JSON.parse(raw.toString());

  assert.equal(p.productId, 'galaxy-usdc-arc');
  assert.equal(p.chainId, 5042);
  assert.equal(p.status, 'review-only-not-authorized');
  assert.equal(p.deploymentAuthorized, false);
  assert.equal(p.customerDepositsEnabled, false);
  assert.equal(p.transactionsSent, 0);
  assert.equal(p.transactions.length, 4);
  assert.ok(same(p.administrator, OPERATOR));
  assert.ok(same(p.feeRecipient, OPERATOR));
  assert.ok(same(p.sentinel, OPERATOR));
  assert.equal(p.sentinelPolicyConfirmed, true);
  assert.ok(same(p.asset, USDC));
  assert.ok(same(p.predictedTokenizerAddress, VAULT));
  assert.ok(same(p.predictedAdapterAddress, ADAPTER));
  assert.equal(p.performanceFeeBps, 1000);
  assert.equal(p.managementFeeBps, 0);
  assert.equal(p.forceDeallocatePenaltyBps, 0);
  assert.equal(p.forceDeallocatePenaltySetterAbdicated, false);
  assert.equal(p.administratorTimelocks.length, 9);

  for (const t of p.transactions) {
    assert.equal(keccak256(t.data), t.calldataHash);
  }

  const t = p.transactions[3];
  assert.equal(t.sequence, 4);
  assert.equal(t.chainId, 5042);
  assert.ok(same(t.from, OPERATOR));
  assert.ok(same(t.to, VAULT));
  assert.equal(BigInt(t.value), 0n);
  assert.equal(t.data, PAYLOAD.data);
  assert.equal(t.calldataHash, CALLDATA_HASH);
  assert.equal(
    decodeFunctionData({ abi: factoryAbi, data: t.data }).functionName,
    'multicall',
  );
  return p;
}

async function checkNonce() {
  assert.equal(await client.getTransactionCount({
    address: OPERATOR, blockTag: 'latest',
  }), NONCE, 'Confirmed nonce changed. Stop and inspect wallet history.');
  assert.equal(await client.getTransactionCount({
    address: OPERATOR, blockTag: 'pending',
  }), NONCE, 'Pending transaction or nonce change. Stop.');
}

async function checkExistingVault(blockNumber) {
  const receipt = await client.getTransactionReceipt({
    hash: '0xf2cc5c1129d06e7ae06227115205f242827f7dde98fc3d49a98a79d20d6ada3a',
  });
  assert.equal(receipt.status, 'success', 'TX1 is not successful.');
  assert.equal(receipt.blockNumber, 29074023n, 'TX1 receipt block changed.');
  assert.ok(same(receipt.from, OPERATOR));
  assert.ok(same(receipt.to,
    '0x3b0eefabfa22ec7cf2c73877ac16e78d76749f12'));
  assert.ok(blockNumber >= receipt.blockNumber + 1n,
    'Wait for at least two TX1 confirmations.');

  const canonical = await client.getBlock({
    blockNumber: receipt.blockNumber,
  });
  assert.equal(canonical.hash, receipt.blockHash,
    'TX1 receipt is no longer canonical.');

  const code = await client.getCode({
    address: VAULT, blockNumber,
  });
  assert.ok(code && code !== '0x', 'Created vault code missing.');
  assert.equal(keccak256(code),
    '0xac3d89c4bed30ede74f4e94e9c0e124a13ed24d0e011181515996362879bae57',
    'Created vault code changed.');

  assert.ok(same(await client.readContract({
    address: VAULT, abi: vaultAbi, functionName: 'owner', blockNumber,
  }), OPERATOR), 'Vault owner mismatch.');
  assert.ok(same(await client.readContract({
    address: VAULT, abi: vaultAbi, functionName: 'asset', blockNumber,
  }), USDC), 'Vault asset mismatch.');
}

const tokenAbi = parseAbi([
  'function allowance(address,address) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
]);

async function readAllowance(blockNumber) {
  return client.readContract({
    address: USDC, abi: tokenAbi, functionName: 'allowance',
    args: [OPERATOR, VAULT], blockNumber,
  });
}

async function checkExistingAdapter(blockNumber) {
  const receipt = await client.getTransactionReceipt({
    hash: '0x609611936981ff3bbdf8ea186288359284d23af7d3ced742850e6d259af792aa',
  });
  assert.equal(receipt.status, 'success', 'TX2 is not successful.');
  assert.equal(receipt.blockNumber, 29074422n, 'TX2 receipt block changed.');
  assert.ok(same(receipt.from, OPERATOR));
  assert.ok(same(receipt.to,
    '0x77788033b22ceab8d51ec8f9dfd4a40e54f380b0'));
  assert.ok(blockNumber >= receipt.blockNumber + 1n,
    'Wait for at least two TX2 confirmations.');

  const canonical = await client.getBlock({
    blockNumber: receipt.blockNumber,
  });
  assert.equal(canonical.hash, receipt.blockHash,
    'TX2 receipt is no longer canonical.');

  const adapterCode = await client.getCode({
    address: ADAPTER, blockNumber,
  });
  assert.ok(adapterCode && adapterCode !== '0x');
  assert.equal(keccak256(adapterCode),
    '0xc55662a9560f7fc218ab6d91d847540dadf72fbd8f4d15268309f60a5e5fd5b9',
    'Adapter code changed.');

  const abi = parseAbi([
    'function parentVault() view returns (address)',
    'function morphoVaultV1() view returns (address)',
    'function factory() view returns (address)',
  ]);
  const plan = readPlan();
  for (const [functionName, expected] of [
    ['parentVault', VAULT],
    ['morphoVaultV1', plan.childVault],
    ['factory', '0x77788033b22ceab8d51ec8f9dfd4a40e54f380b0'],
  ]) {
    assert.ok(same(await client.readContract({
      address: ADAPTER, abi, functionName, blockNumber,
    }), expected), 'Adapter connection mismatch: ' + functionName);
  }
}

const ZERO = '0x0000000000000000000000000000000000000000';

const configAbi = parseAbi([
  'function multicall(bytes[])',
  'function submit(bytes)',
  'function setCurator(address)',
  'function setIsSentinel(address,bool)',
  'function setName(string)',
  'function setSymbol(string)',
  'function setIsAllocator(address,bool)',
  'function setPerformanceFeeRecipient(address)',
  'function setManagementFeeRecipient(address)',
  'function setPerformanceFee(uint256)',
  'function setManagementFee(uint256)',
  'function setForceDeallocatePenalty(address,uint256)',
  'function setAdapterRegistry(address)',
  'function addAdapter(address)',
  'function setLiquidityAdapterAndData(address,bytes)',
  'function setMaxRate(uint256)',
  'function increaseAbsoluteCap(bytes,uint256)',
  'function increaseRelativeCap(bytes,uint256)',
  'function increaseTimelock(bytes4,uint256)',
  'function abdicate(bytes4)',
  'function allocate(address,bytes,uint256)',
  'function mint(uint256,address) returns (uint256)',
]);

const stateAbi = parseAbi([
  'function owner() view returns (address)',
  'function asset() view returns (address)',
  'function curator() view returns (address)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function isSentinel(address) view returns (bool)',
  'function isAllocator(address) view returns (bool)',
  'function performanceFeeRecipient() view returns (address)',
  'function managementFeeRecipient() view returns (address)',
  'function performanceFee() view returns (uint256)',
  'function managementFee() view returns (uint256)',
  'function forceDeallocatePenalty(address) view returns (uint256)',
  'function adapterRegistry() view returns (address)',
  'function isAdapter(address) view returns (bool)',
  'function adaptersLength() view returns (uint256)',
  'function liquidityAdapter() view returns (address)',
  'function liquidityData() view returns (bytes)',
  'function maxRate() view returns (uint256)',
  'function absoluteCap(bytes32) view returns (uint256)',
  'function relativeCap(bytes32) view returns (uint256)',
  'function timelock(bytes4) view returns (uint256)',
  'function abdicated(bytes4) view returns (bool)',
  'function executableAt(bytes) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function receiveSharesGate() view returns (address)',
  'function sendSharesGate() view returns (address)',
  'function receiveAssetsGate() view returns (address)',
  'function sendAssetsGate() view returns (address)',
]);

const selector = signature => keccak256(
  '0x' + Buffer.from(signature, 'utf8').toString('hex'),
).slice(0, 10);

function postChecks() {
  const p = readPlan();
  const checks = [];

  const add = (name, args, expected) => checks.push({
    address: VAULT,
    abi: stateAbi,
    functionName: name,
    args,
    expected,
  });

  add('owner', [], OPERATOR);
  add('asset', [], USDC);
  add('curator', [], OPERATOR);
  add('name', [], p.name);
  add('symbol', [], p.symbol);
  add('isSentinel', [OPERATOR], true);
  add('isAllocator', [OPERATOR], true);
  add('performanceFeeRecipient', [], OPERATOR);
  add('performanceFee', [], BigInt(p.performanceFeeBps) * 10n ** 14n);
  add('managementFee', [], 0n);
  add('forceDeallocatePenalty', [ADAPTER], 0n);
  add('isAdapter', [ADAPTER], true);
  add('adaptersLength', [], 1n);
  add('adapterRegistry', [], ZERO);

  for (const name of [
    'receiveSharesGate',
    'sendSharesGate',
    'receiveAssetsGate',
    'sendAssetsGate',
  ]) {
    add(name, [], ZERO);
  }

  add('totalSupply', [], BigInt(p.protectionSharesRaw));
  add(
    'balanceOf',
    [p.protectionRecipient],
    BigInt(p.protectionSharesRaw),
  );
  add('balanceOf', [OPERATOR], 0n);

  checks.push({
    address: USDC,
    abi: tokenAbi,
    functionName: 'allowance',
    args: [OPERATOR, VAULT],
    expected: 0n,
  });

  for (const policy of p.administratorTimelocks) {
    add(
      'timelock',
      [selector(policy.signature)],
      BigInt(policy.seconds),
    );
  }

  add(
    'abdicated',
    [selector('setForceDeallocatePenalty(address,uint256)')],
    false,
  );

  const inner = decodeFunctionData({
    abi: configAbi,
    data: PAYLOAD.data,
  }).args[0];

  const direct = new Set(inner.map(x => x.toLowerCase()));
  let minted = 0;
  let installed = 0;

  for (const data of inner) {
    const d = decodeFunctionData({ abi: configAbi, data });
    const a = d.args;

    switch (d.functionName) {
      case 'submit':
        assert.ok(
          direct.has(a[0].toLowerCase()),
          'Submitted action not executed.',
        );
        const submitted = decodeFunctionData({
          abi: configAbi,
          data: a[0],
        });
        add(
          'executableAt',
          [a[0]],
          submitted.functionName === 'setMaxRate'
            ? 'setup-block-timestamp'
            : 0n,
        );
        break;

      case 'setCurator':
        assert.ok(same(a[0], OPERATOR));
        break;

      case 'setIsSentinel':
      case 'setIsAllocator':
        assert.ok(same(a[0], OPERATOR));
        assert.equal(a[1], true);
        break;

      case 'setName':
        assert.equal(a[0], p.name);
        break;

      case 'setSymbol':
        assert.equal(a[0], p.symbol);
        break;

      case 'setPerformanceFeeRecipient':
        assert.ok(same(a[0], OPERATOR));
        break;

      case 'setManagementFeeRecipient':
        add('managementFeeRecipient', [], a[0]);
        break;

      case 'setPerformanceFee':
        assert.equal(
          a[0],
          BigInt(p.performanceFeeBps) * 10n ** 14n,
        );
        break;

      case 'setManagementFee':
        assert.equal(a[0], 0n);
        break;

      case 'setForceDeallocatePenalty':
        assert.ok(same(a[0], ADAPTER));
        assert.equal(a[1], 0n);
        break;

      case 'setAdapterRegistry':
        assert.ok(same(a[0], ZERO));
        break;

      case 'addAdapter':
        assert.ok(same(a[0], ADAPTER));
        break;

      case 'setLiquidityAdapterAndData':
        assert.ok(same(a[0], ADAPTER));
        add('liquidityAdapter', [], a[0]);
        add('liquidityData', [], a[1]);
        break;

      case 'setMaxRate':
        add('maxRate', [], a[0]);
        break;

      case 'increaseAbsoluteCap':
        add('absoluteCap', [keccak256(a[0])], a[1]);
        break;

      case 'increaseRelativeCap':
        add('relativeCap', [keccak256(a[0])], a[1]);
        break;

      case 'increaseTimelock': {
        const policy = p.administratorTimelocks.find(
          x => selector(x.signature) === a[0],
        );
        assert.ok(policy, 'Unexpected timelock selector.');
        assert.equal(a[1], BigInt(policy.seconds));
        installed++;
        break;
      }

      case 'abdicate':
        add('abdicated', [a[0]], true);
        break;

      case 'allocate':
        assert.ok(same(a[0], ADAPTER));
        assert.equal(a[2], 0n);
        break;

      case 'mint':
        assert.equal(a[0], BigInt(p.protectionSharesRaw));
        assert.ok(same(a[1], p.protectionRecipient));
        minted++;
        break;

      default:
        throw new Error(
          'Unreviewed configuration action: ' + d.functionName,
        );
    }
  }

  assert.equal(minted, 1);
  assert.equal(installed, 9);
  return checks;
}

function assertState(check, actual, setupTimestamp) {
  const expected = check.expected;

  if (expected === 'setup-block-timestamp') {
    assert.equal(
      typeof setupTimestamp,
      'bigint',
      'Missing setup block timestamp.',
    );
    assert.ok(setupTimestamp > 0n);
    assert.equal(
      actual,
      setupTimestamp,
      'setMaxRate submission must retain the setup block timestamp.',
    );
    return;
  }
  const label =
    check.functionName + '(' + check.args.map(String).join(',') + ')';

  if (typeof expected === 'string' && expected.startsWith('0x')) {
    assert.equal(
      String(actual).toLowerCase(),
      expected.toLowerCase(),
      label,
    );
  } else {
    assert.equal(actual, expected, label);
  }
}

async function readState(check, blockNumber) {
  const { expected, ...request } = check;
  return client.readContract({ ...request, blockNumber });
}

async function checkApprovalReceipt(blockNumber) {
  const r = await client.getTransactionReceipt({
    hash: '0xf5ac29a999cbddc49d7e3e93b11f3744fd49128f18c8fbe4fc0eec3af72f6a09',
  });

  assert.equal(r.status, 'success', 'TX3 not successful.');
  assert.equal(r.blockNumber, 29074716n, 'TX3 receipt changed.');
  assert.ok(same(r.from, OPERATOR));
  assert.ok(same(r.to, USDC));
  assert.ok(
    blockNumber >= r.blockNumber + 1n,
    'Wait for two TX3 confirmations.',
  );
  assert.equal(
    (await client.getBlock({ blockNumber: r.blockNumber })).hash,
    r.blockHash,
    'TX3 is no longer canonical.',
  );
}

async function prepare() {
  readPlan();
  const checks = postChecks();

  assert.equal(await client.getChainId(), 5042, 'Wrong RPC chain.');
  assert.equal(
    (await client.getBlock({ blockNumber: ANCHOR_BLOCK })).hash,
    ANCHOR_HASH,
    'Reviewed anchor changed.',
  );

  const block = await client.getBlock({ blockTag: 'latest' });
  assert.ok(block.number != null);
  assert.equal(typeof block.baseFeePerGas, 'bigint');

  await checkExistingVault(block.number);
  await checkExistingAdapter(block.number);
  await checkApprovalReceipt(block.number);
  await checkNonce();

  assert.equal(
    await readAllowance(block.number),
    1_000_000n,
    'Protection allowance is not exactly 1 USDC.',
  );

  assert.equal(
    await client.readContract({
      address: VAULT,
      abi: stateAbi,
      functionName: 'totalSupply',
      blockNumber: block.number,
    }),
    0n,
    'Vault already has shares. Stop; do not configure or retry blindly.',
  );

  assert.ok(
    await client.readContract({
      address: USDC,
      abi: tokenAbi,
      functionName: 'balanceOf',
      args: [OPERATOR],
      blockNumber: block.number,
    }) >= 1_000_000n,
    'Protection USDC unavailable.',
  );

  assert.ok(
    block.baseFeePerGas + TIP <= MAX_FEE,
    'Approved fee cap no longer covers base fee plus tip.',
  );

  assert.ok(
    await client.getBalance({
      address: OPERATOR,
      blockNumber: block.number,
    }) >= COMBINED_RESERVE,
    'Native USDC below remaining-plan reserve.',
  );

  const request = {
    account: OPERATOR,
    to: VAULT,
    data: PAYLOAD.data,
    value: 0n,
    gas: GAS,
    nonce: NONCE,
    maxFeePerGas: MAX_FEE,
    maxPriorityFeePerGas: TIP,
  };

  await client.call({ ...request, blockNumber: block.number });

  const estimatedGas = await client.estimateGas({
    ...request,
    blockNumber: block.number,
  });

  assert.ok(
    estimatedGas * 125n <= GAS * 100n,
    'Less than 25% gas headroom.',
  );

  const common = {
    from: OPERATOR,
    value: '0x0',
    type: '0x2',
    maxFeePerGas: toHex(MAX_FEE),
    maxPriorityFeePerGas: toHex(TIP),
  };

  const calls = [{
    ...common,
    to: VAULT,
    input: PAYLOAD.data,
    gas: toHex(GAS),
    nonce: toHex(NONCE),
  }];

  for (const [i, check] of checks.entries()) {
    calls.push({
      ...common,
      to: check.address,
      input: encodeFunctionData({
        abi: check.abi,
        functionName: check.functionName,
        args: check.args,
      }),
      gas: toHex(150_000n),
      nonce: toHex(NONCE + 1 + i),
    });
  }

  const result = await client.request({
    method: 'eth_simulateV1',
    params: [{
      blockStateCalls: [{ calls }],
      validation: true,
      traceTransfers: false,
    }, toHex(block.number)],
  });

  assert.equal(
    result?.length,
    1,
    'Incomplete final-state simulation.',
  );

  const outputs = result[0].calls;
  assert.equal(outputs?.length, calls.length);

  for (const [i, output] of outputs.entries()) {
    assert.equal(
      output.status,
      '0x1',
      'Simulation call ' + i + ': ' +
        (output.error?.message ?? 'failed'),
    );

    if (i > 0) {
      const check = checks[i - 1];
      assertState(
        check,
        decodeFunctionResult({
          abi: check.abi,
          functionName: check.functionName,
          data: output.returnData,
        }),
        BigInt(result[0].timestamp),
      );
    }
  }

  await checkNonce();
  readPlan();

  return {
    checkedAt: new Date().toISOString(),
    checkedAtMs: Date.now(),
    blockNumber: String(block.number),
    estimatedGas: String(estimatedGas),
    configurationAndPostStateSimulationPassed: true,
    postStateChecksPassed: checks.length,
    administratorTimelocksVerified: 9,
    payload: PAYLOAD,
    tx4ApprovalOnly: true,
    transactionsSentByServer: 0,
  };
}

async function verify(hash) {
  assert.match(hash, /^0x[0-9a-fA-F]{64}$/);

  const receipt = await client.waitForTransactionReceipt({
    hash,
    confirmations: 2,
    timeout: 180000,
  });
  const tx = await client.getTransaction({ hash });

  assert.ok(same(tx.from, OPERATOR), 'Mined sender mismatch.');
  assert.ok(same(tx.to, VAULT), 'Mined destination mismatch.');
  assert.equal(tx.chainId, 5042);
  assert.equal(tx.nonce, NONCE);
  assert.equal(tx.input.toLowerCase(), PAYLOAD.data.toLowerCase());
  assert.equal(tx.value, 0n);
  assert.equal(tx.gas, GAS, 'Wallet changed approved gas limit.');
  assert.equal(
    tx.maxFeePerGas,
    MAX_FEE,
    'Wallet changed approved max fee.',
  );
  assert.equal(
    tx.maxPriorityFeePerGas,
    TIP,
    'Wallet changed approved tip.',
  );
  assert.equal(
    receipt.status,
    'success',
    'TX4 reverted. Stop; do not resend.',
  );

  await checkExistingVault(receipt.blockNumber);
  await checkExistingAdapter(receipt.blockNumber);
  await checkApprovalReceipt(receipt.blockNumber);

  const checks = postChecks();
  const setupBlock = await client.getBlock({
    blockNumber: receipt.blockNumber,
  });

  for (const check of checks) {
    assertState(
      check,
      await readState(check, receipt.blockNumber),
      setupBlock.timestamp,
    );
  }

  const plan = readPlan();
  const report = {
    status: 'USDC ARC TX4 VERIFIED — USDC CONFIGURATION COMPLETE',
    hash,
    chainId: 5042,
    blockNumber: String(receipt.blockNumber),
    gasUsed: String(receipt.gasUsed),
    vault: VAULT,
    adapter: ADAPTER,
    name: plan.name,
    symbol: plan.symbol,
    administrator: OPERATOR,
    sentinel: OPERATOR,
    performanceFeeBps: 1000,
    managementFeeBps: 0,
    forceDeallocatePenaltyBps: 0,
    forceDeallocatePenaltySetterRetained: true,
    forceDeallocatePenaltyChangeTimelockSeconds: '172800',
    protectionRecipient: plan.protectionRecipient,
    protectionSharesRaw: plan.protectionSharesRaw,
    protectionAllowanceRemainingAtomic: '0',
    administratorTimelocksVerified: 9,
    postStateChecksPassed: checks.length,
    transactionsSentByThisTool: 1,
    completedUsdcDeploymentTransactions: 4,
    eurcDeploymentAuthorized: false,
    customerInterfaceEnablementAuthorized: false,
    underlyingGateRiskRemoved: false,
  };

  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv.includes('--check-only')) {
  try {
    console.log(JSON.stringify(await prepare(), null, 2));
  } catch (error) {
    console.error(safeMessage(error));
    process.exit(1);
  }
  process.exit(0);
}

function browser() {
  const status = document.getElementById("status");
  const details = document.getElementById("details");
  const connect = document.getElementById("connect");
  const send = document.getElementById("send");
  const phrase = document.getElementById("phrase");
  const storageKey = "mw-galaxy-arc-usdc-tx4-" + payload.data;
  let provider;
  let version = 0;
  let locked = Boolean(localStorage.getItem(storageKey));

  details.textContent = JSON.stringify(payload, null, 2);
  status.textContent = locked
    ? "An attempt is already recorded: " + localStorage.getItem(storageKey) +
      ". Do not send again; inspect it first."
    : "No transaction sent. Connect MetaMask to review tx4.";

  function update() {
    send.disabled = locked || !provider || phrase.value !== "SEND TX4";
  }

  async function session() {
    const accounts = await provider.request({ method: "eth_accounts" });
    const chain = await provider.request({ method: "eth_chainId" });
    if (!accounts[0] ||
        accounts[0].toLowerCase() !== payload.from.toLowerCase()) {
      throw new Error("Select the approved operator account in MetaMask.");
    }
    if (Number(chain) !== 5042) throw new Error("Select Arc chain 5042.");
  }

  async function api(path) {
    const response = await fetch(path, {
      cache: "no-store", credentials: "omit", redirect: "error",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Local check failed");
    return result;
  }

  connect.onclick = async () => {
    connect.disabled = true;
    try {
      const injected = window.ethereum;
      const candidates = injected && injected.providers
        ? injected.providers : [injected];
      provider = candidates.find((p) => p && p.isMetaMask && !p.isRabby);
      if (!provider) throw new Error("MetaMask provider not detected.");

      await provider.request({ method: "eth_requestAccounts" });
      await session();

      const changed = () => {
        version++;
        locked = true;
        status.textContent = "Wallet session changed. Stop and reload to review.";
        update();
      };
      provider.on?.("accountsChanged", changed);
      provider.on?.("chainChanged", changed);

      const checked = await api("prepare");
      if (JSON.stringify(checked.payload) !== JSON.stringify(payload)) {
        throw new Error("Prepared payload differs from approved payload");
      }
      status.textContent = "Checks passed at block " + checked.blockNumber +
        ". Type SEND TX4, then review the exact fields in MetaMask.";
      update();
    } catch (error) {
      provider = null;
      status.textContent = error.message;
      connect.disabled = false;
      update();
    }
  };

  phrase.oninput = update;

  send.onclick = async () => {
    if (locked || !provider || phrase.value !== "SEND TX4") return;
    locked = true;
    update();
    const startVersion = version;
    let attempted = false;
    try {
      await session();
      const checked = await api("prepare");
      if (version !== startVersion) throw new Error("Wallet session changed");
      if (JSON.stringify(checked.payload) !== JSON.stringify(payload)) {
        throw new Error("Payload changed");
      }
      if (Date.now() - checked.checkedAtMs > 30000) {
        throw new Error("Local checks expired; stop and reload");
      }
      await session();

      localStorage.setItem(storageKey, "ATTEMPT STARTED — inspect MetaMask/history");
      attempted = true;
      status.textContent =
        "Review tx4 in MetaMask. Do not edit gas, fees, destination or value.";

      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [payload],
      });
      localStorage.setItem(storageKey, hash);
      status.textContent = "Submitted tx4: " + hash +
        ". Waiting for receipt verification; do not retry.";

      const report = await api("verify?hash=" + encodeURIComponent(hash));
      status.textContent = JSON.stringify(report, null, 2);
    } catch (error) {
      status.textContent = error.message +
        (attempted
          ? "\nSTOP. An attempt was recorded. Inspect MetaMask/history before any retry."
          : "\nNo wallet send request was made. Stop and paste this error.");
    }
  };

  update();
}

function page() {
  return '<!doctype html><html><head><meta charset="utf-8">' +
    '<title>MetaWork — approved tx4 only</title>' +
    '</head><body><h1>Galaxy USDC on Arc — tx4 only</h1>' +
    '<p>Arc chain 5042. Configure vault and mint protection shares only. No further deployment transactions are authorized.</p>' +
    '<p>Do not edit the approved payload in MetaMask.</p>' +
    '<button id="connect">Connect MetaMask and check</button>' +
    '<pre id="details"></pre>' +
    '<label>Type SEND TX4: <input id="phrase" autocomplete="off"></label> ' +
    '<button id="send" disabled>Review approved tx4 in MetaMask</button>' +
    '<pre id="status"></pre><script>const payload=' +
    JSON.stringify(PAYLOAD).replace(/</g, "\\u003c") +
    ";(" + browser.toString() + ")();</script></body></html>";
}

const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy",
    "default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; " +
    "frame-ancestors 'none'; base-uri 'none'; form-action 'none'");

  try {
    assert.equal(req.headers.host, "127.0.0.1:" + port, "Invalid Host");
    assert.equal(req.method, "GET", "Only GET is allowed");
    if (req.headers.origin) assert.equal(req.headers.origin, origin);
    if (req.headers["sec-fetch-site"]) {
      assert.ok(["same-origin", "none"].includes(req.headers["sec-fetch-site"]),
        "Cross-site request blocked");
    }

    const url = new URL(req.url, origin);
    if (url.pathname === root) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(page());
      return;
    }

    res.setHeader("Content-Type", "application/json");
    if (url.pathname === root + "prepare") {
      res.end(JSON.stringify(await prepare()));
      return;
    }
    if (url.pathname === root + "verify") {
      assert.equal(verifying, false, "Verification already running");
      verifying = true;
      try {
        res.end(JSON.stringify(await verify(url.searchParams.get("hash") || "")));
      } finally {
        verifying = false;
      }
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (error) {
    const message = safeMessage(error);
    console.error(message);
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: message }));
  }
});

server.on("error", (error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});

readPlan();
server.listen(port, "127.0.0.1", () => {
  console.log("Open this local URL in the browser with MetaMask:");
  console.log(origin + root);
  console.log("Only tx4 is approved. Starting this server sends nothing.");
  console.log("Keep this terminal open. Ctrl+C stops the tool.");
});
