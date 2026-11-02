import {
  parseAbi,
  encodeFunctionData,
  decodeFunctionResult,
  toFunctionSelector,
  toHex,
} from 'viem';

const abi = parseAbi([
  'function curator() view returns (address)',
  'function timelock(bytes4) view returns (uint256)',
  'function abdicated(bytes4) view returns (bool)',
  'function submit(bytes)',
  'function setSendAssetsGate(address)',
  'function sendAssetsGate() view returns (address)',
  'function canSendAssets(address) view returns (bool)',
  'function transfer(address,uint256) returns (bool)',
  'function approve(address,uint256) returns (bool)',
  'function deposit(uint256,address) returns (uint256)',
  'function redeem(uint256,address,address) returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
]);

export async function simulateArcGateRisk({
  client, product, owner, wrapper, adapter, blockNumber,
  prefix, shares, customer, dead, protectionShares, depositAmount,
}) {
  const gate = '0x000000000000000000000000000000000000fee1';
  const selector = toFunctionSelector('setSendAssetsGate(address)');
  const pause = () => new Promise(resolve => setTimeout(resolve, 750));
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  const read = async (name, args = []) => {
    await pause();
    return client.readContract({
      address: product.underlying,
      abi,
      functionName: name,
      args,
      blockNumber,
    });
  };

  const curator = await read('curator');
  check(
    curator.toLowerCase() !== '0x0000000000000000000000000000000000000000',
    'Underlying curator is zero; fixture needs review.',
  );
  check(
    await read('abdicated', [selector]) === false,
    'Underlying setter state changed; review the gate scenario.',
  );
  check(
    await read('timelock', [selector]) === 0n,
    'Underlying setter is no longer instant; fixture needs time advancement.',
  );

  await pause();
  const existingCode = await client.getCode({ address: gate, blockNumber });
  check(!existingCode || existingCode === '0x', 'Gate fixture address has code.');

  const encode = (name, args = []) =>
    encodeFunctionData({ abi, functionName: name, args });

  const decode = (output, name) => decodeFunctionResult({
    abi, functionName: name, data: output.returnData,
  });

  const call = (to, name, args = [], from = owner, gas = 200_000n) => ({
    from, to, data: encode(name, args), gas: toHex(gas),
  });

  const calls = [];

  function append(request) {
    const index = calls.length;
    calls.push(request);
    return index;
  }

  // Extra simulated customer funds for the two deposit probes.
  append(call(product.asset, 'transfer', [customer, depositAmount]));
  append(call(product.asset, 'approve', [wrapper, depositAmount], customer));
  append(call(
    product.asset, 'approve', [product.underlying, depositAmount], customer,
  ));

  // Governance impersonation is simulation-only.
  const gateData = encode('setSendAssetsGate', [gate]);
  append(call(product.underlying, 'submit', [gateData], curator));
  append(call(product.underlying, 'setSendAssetsGate', [gate], curator));

  const gateIndex = append(call(product.underlying, 'sendAssetsGate'));
  const allowedIndex = append(call(
    product.underlying, 'canSendAssets', [adapter],
  ));

  const wrapperDepositIndex = append(call(
    wrapper, 'deposit', [depositAmount, customer], customer, 3_000_000n,
  ));
  const underlyingDepositIndex = append(call(
    product.underlying, 'deposit',
    [depositAmount, customer], customer, 3_000_000n,
  ));

  const beforeIndex = append(call(product.asset, 'balanceOf', [customer]));
  const redeemIndex = append(call(
    wrapper, 'redeem', [shares, customer, customer], customer, 3_000_000n,
  ));
  const afterIndex = append(call(product.asset, 'balanceOf', [customer]));
  const positionIndex = append(call(wrapper, 'balanceOf', [customer]));
  const protectionIndex = append(call(wrapper, 'balanceOf', [dead]));

  await pause();

  const result = await client.request({
    method: 'eth_simulateV1',
    params: [{
      blockStateCalls: [{
        calls: prefix,
      }, {
        stateOverrides: {
          [gate]: {
            // Fixture runtime: return ABI-encoded false.
            code: '0x600060005260206000f3',
          },
        },
        calls,
      }],
      validation: false,
      traceTransfers: false,
    }, toHex(blockNumber)],
  });

  const setupOutputs = result?.[0]?.calls;

  check(
    setupOutputs?.length === prefix.length,
    'Incomplete gate-risk setup block.',
  );

  for (const [index, output] of setupOutputs.entries()) {
    check(
      output.status === '0x1',
      'Gate-risk setup call ' + index + ' failed: ' +
        (output.error?.message ?? 'revert'),
    );
  }

  check(
    decode(setupOutputs[setupOutputs.length - 1], 'deposit') === shares,
    'Gate-risk setup produced a different customer position.',
  );

  const outputs = result?.[1]?.calls;
  check(
    outputs?.length === calls.length,
    'Incomplete gate-risk test block.',
  );

  const expectedFailures = new Set([
    wrapperDepositIndex, underlyingDepositIndex,
  ]);
  const gateError = toFunctionSelector('CannotSendAssets()').toLowerCase();

  for (const [index, output] of outputs.entries()) {
    if (expectedFailures.has(index)) {
      const data = output.error?.data ?? output.returnData;
      check(
        output.status === '0x0' &&
        typeof data === 'string' &&
        data.slice(0, 10).toLowerCase() === gateError,
        `Gate probe ${index}: expected CannotSendAssets(), not another failure.`,
      );
    } else {
      check(
        output.status === '0x1',
        `Gate-risk call ${index} failed: ${output.error?.message ?? 'revert'}`,
      );
    }
  }

  check(
    decode(outputs[gateIndex], 'sendAssetsGate').toLowerCase() === gate,
    'Reject-all gate was not installed in simulation.',
  );
  check(
    decode(outputs[allowedIndex], 'canSendAssets') === false,
    'Simulated gate did not deny the wrapper adapter.',
  );

  const redeemed = decode(outputs[redeemIndex], 'redeem');
  const before = decode(outputs[beforeIndex], 'balanceOf');
  const after = decode(outputs[afterIndex], 'balanceOf');

  check(redeemed > 0n, 'Existing-position redemption returned zero.');
  check(after - before === redeemed, 'Redemption balance delta mismatch.');
  check(
    decode(outputs[positionIndex], 'balanceOf') === 0n,
    'Customer position was not fully redeemed.',
  );
  check(
    decode(outputs[protectionIndex], 'balanceOf') === protectionShares,
    'Protection shares changed during gate-risk scenario.',
  );

  return {
    underlyingGateScenarioTestPassed: true,
    newDepositWithRejectAllGate: 'blocked-as-expected',
    inKindUnderlyingDepositLeg: 'blocked-as-expected',
    existingAssetRedemptionWithLiquidity: 'passed',
    underlyingGateRiskRemoved: false,
    governanceImpersonationSimulationOnly: true,
  };
}