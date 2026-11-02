import fs from 'node:fs';
import assert from 'node:assert/strict';
import { config } from 'dotenv';
import { createPublicClient, http, erc20Abi, formatUnits } from 'viem';

config({ path: '.env.local', quiet: true });

const rpc = process.env.ARC_SIMULATION_RPC_URL?.trim();
if (!rpc) throw new Error('ARC_SIMULATION_RPC_URL is missing.');

const client = createPublicClient({
  transport: http(rpc, { timeout: 30_000, retryCount: 0 }),
});

const owner = '0x39bb4a10626b58430abfa8284b0f001f49734f70';
const usdc = '0x3600000000000000000000000000000000000000';
const eurc = '0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1';

const files = process.argv.slice(2);
assert.equal(
  files.length,
  2,
  'Pass the exact USDC and EURC review-plan filenames as arguments.',
);

const pause = () => new Promise(resolve => setTimeout(resolve, 750));
const max = (...values) => values.reduce((a, b) => a > b ? a : b);
const shortfall = (required, available) =>
  required > available ? required - available : 0n;
const same = (a, b) => a?.toLowerCase() === b?.toLowerCase();

async function main() {
  const plans = files.map(file => JSON.parse(fs.readFileSync(file, 'utf8')));

  assert.equal(new Set(plans.map(plan => plan.productId)).size, 2);

  for (const plan of plans) {
    assert.equal(plan.chainId, 5042);
    assert.equal(plan.deploymentAuthorized, false);
    assert.equal(plan.transactions.length, 4);
    assert.equal(plan.commercialSettingsConfirmed, true);
    assert.equal(plan.forceDeallocatePenaltyPolicyConfirmed, true);
    assert.equal(plan.forceDeallocatePenaltyBps, 0);
    assert.equal(plan.forceDeallocatePenaltySetterAbdicated, false);
    assert.equal(
      plan.forceDeallocatePenaltyChangeTimelockSeconds,
      '172800',
    );
    assert.equal(
      plan.underlyingGateRiskSimulation?.underlyingGateScenarioTestPassed,
      true,
    );
    assert.ok(same(plan.administrator, owner));
    assert.ok(same(plan.feeRecipient, owner));
    assert.ok(same(plan.sentinel, owner));
    assert.equal(plan.sentinelPolicyConfirmed, true);
    assert.equal(plan.assetDecimals, 6);

    for (const tx of plan.transactions) {
      assert.ok(same(tx.from, owner));
      assert.equal(BigInt(tx.value), 0n);
      assert.ok(BigInt(tx.simulatedGasUsed) > 0n);
      assert.ok(
        BigInt(tx.simulatedGasUsed) <= BigInt(tx.simulationGasCeiling),
      );
    }
  }

  assert.equal(await client.getChainId(), 5042);
  await pause();

  const block = await client.getBlock({ blockTag: 'latest' });
  assert.ok(block.number != null);
  assert.ok(typeof block.baseFeePerGas === 'bigint');

  await pause();
  const gasPrice = await client.getGasPrice();

  await pause();
  const priorityFee = BigInt(await client.request({
    method: 'eth_maxPriorityFeePerGas',
  }));

  // Conservative planning quote, not an approved transaction fee.
  const maxFeePerGas = max(
    20_000_000_000n + priorityFee,
    block.baseFeePerGas * 2n + priorityFee,
    gasPrice * 2n,
  );

  await pause();
  const nativeBalance = await client.getBalance({
    address: owner,
    blockNumber: block.number,
  });

  async function readToken(address, functionName, args = []) {
    await pause();
    return client.readContract({
      address,
      abi: erc20Abi,
      functionName,
      args,
      blockNumber: block.number,
    });
  }

  assert.equal(await readToken(usdc, 'decimals'), 6);
  assert.equal(await readToken(eurc, 'decimals'), 6);

  const usdcBalance = await readToken(usdc, 'balanceOf', [owner]);
  const eurcBalance = await readToken(eurc, 'balanceOf', [owner]);

  assert.equal(
    nativeBalance / (10n ** 12n),
    usdcBalance,
    'Native/ERC-20 USDC balance mismatch; do not trust this budget.',
  );

  let totalGasReserve = 0n;
  let protectionUsdcNative = 0n;
  let protectionEurc = 0n;

  const products = plans.map(plan => {
    const gasCeiling = plan.transactions.reduce(
      (sum, tx) => sum + BigInt(tx.simulationGasCeiling),
      0n,
    );
    const simulatedGasUsed = plan.transactions.reduce(
      (sum, tx) => sum + BigInt(tx.simulatedGasUsed),
      0n,
    );
    const gasReserve = gasCeiling * maxFeePerGas;
    const protection = BigInt(plan.protectionAssetBudgetRaw);

    totalGasReserve += gasReserve;

    if (same(plan.asset, usdc)) {
      protectionUsdcNative += protection * (10n ** 12n);
    } else {
      assert.ok(same(plan.asset, eurc), 'Unexpected plan asset.');
      protectionEurc += protection;
    }

    return {
      product: plan.productId,
      simulatedGasUsed: simulatedGasUsed.toString(),
      simulationGasCeiling: gasCeiling.toString(),
      gasReserveUsdc: formatUnits(gasReserve, 18),
      protectionAssetReserve: formatUnits(protection, 6),
      protectionAsset: same(plan.asset, usdc) ? 'USDC' : 'EURC',
    };
  });

  const requiredNative = totalGasReserve + protectionUsdcNative;

  console.log(JSON.stringify({
    mode: 'read-only-planning-budget',
    blockNumber: block.number.toString(),
    observedAt: new Date().toISOString(),
    administrator: owner,
    proposedMaxFeePerGasGwei: formatUnits(maxFeePerGas, 9),
    products,
    combined: {
      gasReserveUsdc: formatUnits(totalGasReserve, 18),
      protectionReserveUsdc: formatUnits(protectionUsdcNative, 18),
      totalRequiredUsdc: formatUnits(requiredNative, 18),
      actualWalletUsdc: formatUnits(nativeBalance, 18),
      usdcShortfall: formatUnits(
        shortfall(requiredNative, nativeBalance), 18,
      ),
      protectionReserveEurc: formatUnits(protectionEurc, 6),
      actualWalletEurc: formatUnits(eurcBalance, 6),
      eurcShortfall: formatUnits(
        shortfall(protectionEurc, eurcBalance), 6,
      ),
    },
    gasLimitsAndFeesApproved: false,
    deploymentAuthorized: false,
    transactionsSent: 0,
  }, null, 2));
}

main().catch(error => {
  // Avoid transport errors that could disclose a credentialed URL.
  console.log(JSON.stringify({
    error: error.name,
    detail: error.name === 'AssertionError' ? error.message : undefined,
    transactionsSent: 0,
  }, null, 2));
  process.exitCode = 1;
});