import fs from 'node:fs';
import assert from 'node:assert/strict';
import { config } from 'dotenv';
import {
  createPublicClient,
  http,
  parseAbi,
  decodeFunctionData,
  decodeFunctionResult,
  keccak256,
  toHex,
} from 'viem';

config({ path: '.env.local', quiet: true });

const rpc = process.env.ARC_SIMULATION_RPC_URL?.trim();
if (!rpc) throw new Error('ARC_SIMULATION_RPC_URL is missing.');

const client = createPublicClient({
  transport: http(rpc, { timeout: 90_000, retryCount: 0 }),
});

const owner = '0x39bb4a10626b58430abfa8284b0f001f49734f70';
const vaultFactory = '0x3b0eefabfa22ec7cf2c73877ac16e78d76749f12';
const adapterFactory = '0x77788033b22ceab8d51ec8f9dfd4a40e54f380b0';

const abi = parseAbi([
  'function createVaultV2(address,address,bytes32) returns (address)',
  'function createMorphoVaultV1Adapter(address,address) returns (address)',
  'function approve(address,uint256) returns (bool)',
  'function multicall(bytes[])',
]);

const files = process.argv.slice(2);
assert.equal(
  files.length,
  2,
  'Pass the exact USDC and EURC review-plan filenames.',
);

const expected = [
  {
    id: 'galaxy-usdc-arc',
    asset: '0x3600000000000000000000000000000000000000',
    underlying: '0x8e357432cc12ff425c36432f312968aeb16112af',
  },
  {
    id: 'galaxy-eurc-arc',
    asset: '0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1',
    underlying: '0x389abdf4355e0cf4f19298179991705a98f21c18',
  },
];

const same = (a, b) => a?.toLowerCase() === b?.toLowerCase();
const pause = () => new Promise(resolve => setTimeout(resolve, 750));
const max = (...values) => values.reduce((a, b) => a > b ? a : b);

async function main() {
  assert.equal(await client.getChainId(), 5042, 'Wrong chain.');

  const plans = files.map(file => JSON.parse(fs.readFileSync(file, 'utf8')));
  const block = await client.getBlock({ blockTag: 'latest' });
  assert.ok(block.number != null);
  assert.ok(typeof block.baseFeePerGas === 'bigint');

  for (const [address, expectedHash] of [
    [
      vaultFactory,
      '0xba55eb73d42937607d7e3c77f68353c2517c4fad4df02f0c9bbd2e4248475503',
    ],
    [
      adapterFactory,
      '0x4e1024d5bfd17914a3ca6ad49905eabdfd60122ccd5a577406e7a4a765bd49ad',
    ],
  ]) {
    await pause();
    const code = await client.getCode({ address, blockNumber: block.number });
    assert.ok(code && code !== '0x', 'Factory bytecode missing.');
    assert.equal(keccak256(code), expectedHash, 'Factory bytecode changed.');
  }

  for (const [index, plan] of plans.entries()) {
    const product = expected[index];

    assert.equal(plan.productId, product.id);
    assert.equal(plan.chainId, 5042);
    assert.equal(plan.deploymentAuthorized, false);
    assert.equal(plan.transactions.length, 4);
    assert.equal(plan.performanceFeeBps, 1000);
    assert.equal(plan.managementFeeBps, 0);
    assert.equal(plan.forceDeallocatePenaltyBps, 0);
    assert.equal(plan.forceDeallocatePenaltySetterAbdicated, false);
    assert.equal(plan.forceDeallocatePenaltyChangeTimelockSeconds, '172800');
    assert.ok(same(plan.administrator, owner));
    assert.ok(same(plan.feeRecipient, owner));
    assert.ok(same(plan.sentinel, owner));
    assert.equal(plan.sentinelPolicyConfirmed, true);
    assert.ok(same(plan.asset, product.asset));
    assert.ok(same(plan.childVault, product.underlying));

    const targets = [
      vaultFactory,
      adapterFactory,
      product.asset,
      plan.predictedTokenizerAddress,
    ];
    const names = [
      'createVaultV2',
      'createMorphoVaultV1Adapter',
      'approve',
      'multicall',
    ];

    for (const [step, tx] of plan.transactions.entries()) {
      assert.ok(same(tx.from, owner));
      assert.ok(same(tx.to, targets[step]), 'Unexpected transaction target.');
      assert.equal(BigInt(tx.value), 0n);
      assert.equal(keccak256(tx.data), tx.calldataHash);

      const decoded = decodeFunctionData({ abi, data: tx.data });
      assert.equal(decoded.functionName, names[step]);

      if (step === 0) {
        assert.ok(same(decoded.args[0], owner));
        assert.ok(same(decoded.args[1], product.asset));
        assert.equal(decoded.args[2], plan.salt);
      } else if (step === 1) {
        assert.ok(same(decoded.args[0], plan.predictedTokenizerAddress));
        assert.ok(same(decoded.args[1], product.underlying));
      } else if (step === 2) {
        assert.ok(same(decoded.args[0], plan.predictedTokenizerAddress));
        assert.equal(decoded.args[1], 1_000_000n);
      }
    }

    for (const address of [
      plan.predictedTokenizerAddress,
      plan.predictedAdapterAddress,
    ]) {
      await pause();
      const code = await client.getCode({
        address, blockNumber: block.number,
      });
      assert.ok(!code || code === '0x', 'A planned address already has code.');
    }
  }

  await pause();
  const startingNonce = await client.getTransactionCount({
    address: owner, blockNumber: block.number,
  });

  await pause();
  const pendingNonce = await client.getTransactionCount({
    address: owner, blockTag: 'pending',
  });
  assert.equal(pendingNonce, startingNonce, 'Administrator has pending transactions.');

  await pause();
  const gasPrice = await client.getGasPrice();

  await pause();
  const priorityFee = BigInt(await client.request({
    method: 'eth_maxPriorityFeePerGas',
  }));

  const maxFee = max(
    20_000_000_000n + priorityFee,
    2n * block.baseFeePerGas + priorityFee,
    2n * gasPrice,
  );

  let nonce = BigInt(startingNonce);

  const blockStateCalls = plans.map(plan => ({
    calls: plan.transactions.map(tx => ({
      from: owner,
      to: tx.to,
      input: tx.data,
      value: '0x0',
      gas: toHex(BigInt(tx.simulationGasCeiling)),
      nonce: toHex(nonce++),
      type: '0x2',
      maxFeePerGas: toHex(maxFee),
      maxPriorityFeePerGas: toHex(priorityFee),
    })),
  }));

  await pause();

  const results = await client.request({
    method: 'eth_simulateV1',
    params: [{
      blockStateCalls,
      validation: true,
      traceTransfers: false,
    }, toHex(block.number)],
  });

  assert.equal(results?.length, 2, 'Incomplete simulation blocks.');

  for (const [index, plan] of plans.entries()) {
    const outputs = results[index]?.calls;
    assert.equal(outputs?.length, 4, 'Incomplete deployment calls.');

    for (const [step, output] of outputs.entries()) {
      assert.equal(
        output.status,
        '0x1',
        plan.productId + ', step ' + (step + 1) + ': ' +
          (output.error?.message ?? 'simulation failed'),
      );
    }

    const wrapper = decodeFunctionResult({
      abi, functionName: 'createVaultV2',
      data: outputs[0].returnData,
    });
    const adapter = decodeFunctionResult({
      abi, functionName: 'createMorphoVaultV1Adapter',
      data: outputs[1].returnData,
    });

    assert.ok(same(wrapper, plan.predictedTokenizerAddress));
    assert.ok(same(adapter, plan.predictedAdapterAddress));
  }

  console.log(JSON.stringify({
    exactPlansSimulationPassed: true,
    validationRequested: true,
    fictionalFundingUsed: false,
    stateOverridesUsed: false,
    simulatedDeploymentTransactions: 8,
    startingNonce,
    simulationAnchorBlock: block.number.toString(),
    products: plans.map(plan => ({
      product: plan.productId,
      wrapper: plan.predictedTokenizerAddress,
      adapter: plan.predictedAdapterAddress,
      stepsPassed: 4,
    })),
    deploymentAuthorized: false,
    transactionsSent: 0,
  }, null, 2));
}

main().catch(error => {
  const causes = [];
  let current = error;

  for (let depth = 0; current && depth < 8; depth += 1) {
    causes.push({
      name: current.name ?? null,
      code: current.code ?? null,
      detail: String(
        current.details ??
        current.shortMessage ??
        (current.name === 'AssertionError' ? current.message : ''),
      )
        .replaceAll(rpc, '[RPC URL]')
        .replace(/https?:\/\/[^\s"'<>]+/g, '[URL]')
        .slice(0, 400),
    });
    current = current.cause;
  }

  console.log(JSON.stringify({ causes, transactionsSent: 0 }, null, 2));
  process.exitCode = 1;
});