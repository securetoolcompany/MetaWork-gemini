import { config } from 'dotenv';
import { simulateArcRoundTrip } from './lib/simulate-galaxy-arc-roundtrip.mjs';
import { randomBytes } from 'node:crypto';
import {
  createPublicClient,
  http,
  parseAbi,
  encodeFunctionData,
  decodeFunctionResult,
  toHex,
} from 'viem';

config({ path: '.env.local', quiet: true });

const rpc = process.env.ARC_SIMULATION_RPC_URL?.trim();
if (!rpc) throw new Error('ARC_SIMULATION_RPC_URL is missing.');

const client = createPublicClient({
  transport: http(rpc, { timeout: 60_000, retryCount: 0 }),
});

// Simulation fixture only; these are not approved deployment roles.
const owner = '0x39bb4a10626b58430abfa8284b0f001f49734f70';
const vaultFactory = '0x3b0eefabfa22ec7cf2c73877ac16e78d76749f12';
const adapterFactory = '0x77788033b22ceab8d51ec8f9dfd4a40e54f380b0';

const abi = parseAbi([
  'function createVaultV2(address owner,address asset,bytes32 salt) returns (address)',
  'function createMorphoVaultV1Adapter(address parentVault,address morphoVaultV1) returns (address)',
  'function owner() view returns (address)',
  'function asset() view returns (address)',
  'function factory() view returns (address)',
  'function parentVault() view returns (address)',
  'function morphoVaultV1() view returns (address)',
]);

const products = [
  {
    id: 'galaxy-usdc-arc',
    underlying: '0x8e357432cc12ff425c36432f312968aeb16112af',
    asset: '0x3600000000000000000000000000000000000000',
  },
  {
    id: 'galaxy-eurc-arc',
    underlying: '0x389abdf4355e0cf4f19298179991705a98f21c18',
    asset: '0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1',
  },
];

const same = (a, b) => a.toLowerCase() === b.toLowerCase();

function call(to, functionName, args = [], gas = 100_000n) {
  return {
    from: owner,
    to,
    data: encodeFunctionData({ abi, functionName, args }),
    // Simulation ceilings only—not transaction gas recommendations.
    gas: toHex(gas),
  };
}

function decode(output, functionName) {
  return decodeFunctionResult({
    abi,
    functionName,
    data: output.returnData,
  });
}

function safeError(error) {
  const message = String(error.shortMessage ?? error.message ?? 'Failed')
    .replaceAll(rpc, '[RPC URL]')
    .replace(/https?:\/\/[^\s"'<>]+/g, '[URL]')
    .split('\n')[0]
    .slice(0, 300);

  const secret = new URL(rpc).pathname.split('/').filter(Boolean).at(-1);

  function scrub(value) {
    if (value == null) return null;
    let text = String(value).replaceAll(rpc, '[RPC URL]');
    if (secret) text = text.replaceAll(secret, '[API KEY]');
    return text
      .replace(/https?:\/\/[^\s"'<>]+/g, '[URL]')
      .slice(0, 600);
  }

  const causes = [];
  const seen = new Set();
  let current = error;

  for (let depth = 0; current && depth < 8; depth += 1) {
    if (seen.has(current)) break;
    seen.add(current);

    causes.push({
      name: current.name ?? null,
      code: current.code ?? null,
      httpStatus: current.status ?? null,
      details: scrub(current.details),
      shortMessage: scrub(current.shortMessage),
    });

    current = current.cause;
  }

  return { name: error.name, message, causes };
}

async function main() {
  const chainId = await client.getChainId();
  if (chainId !== 5042) throw new Error('Wrong chain: ' + chainId);

  const blockNumber = await client.getBlockNumber();

  async function simulate(calls) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const result = await client.request({
      method: 'eth_simulateV1',
      params: [{
        blockStateCalls: [{ calls }],
        validation: false,
        traceTransfers: false,
      }, toHex(blockNumber)],
    });

    const outputs = result?.[0]?.calls;

    if (!outputs || outputs.length !== calls.length) {
      throw new Error('Incomplete simulation response.');
    }

    for (const [index, output] of outputs.entries()) {
      if (output.status !== '0x1') {
        const reason = output.error?.message ?? 'Simulated call reverted';
        throw new Error(`Call ${index}: ${reason}`);
      }
    }

    return outputs;
  }

  const selectedProduct = process.env.ARC_SIMULATION_PRODUCT?.trim();
  const selectedProducts = selectedProduct
    ? products.filter(product => product.id === selectedProduct)
    : products;

  if (!selectedProducts.length) throw new Error('Unknown ARC_SIMULATION_PRODUCT');

  for (const product of selectedProducts) {
    let stage = 'vault-creation';

    try {
      const salt = toHex(randomBytes(32));

      const createVault = call(
        vaultFactory,
        'createVaultV2',
        [owner, product.asset, salt],
        8_000_000n,
      );

      const first = await simulate([createVault]);
      const wrapper = decode(first[0], 'createVaultV2');

      stage = 'adapter-creation';

      const createAdapter = call(
        adapterFactory,
        'createMorphoVaultV1Adapter',
        [wrapper, product.underlying],
        4_000_000n,
      );

      // Every simulation starts fresh: replay creation.
      const second = await simulate([createVault, createAdapter]);
      const adapter = decode(second[1], 'createMorphoVaultV1Adapter');

      stage = 'connection-verification';

      const outputs = await simulate([
        createVault,
        createAdapter,
        call(wrapper, 'owner'),
        call(wrapper, 'asset'),
        call(adapter, 'parentVault'),
        call(adapter, 'morphoVaultV1'),
        call(adapter, 'factory'),
      ]);

      const checks = [
        same(decode(outputs[0], 'createVaultV2'), wrapper),
        same(decode(outputs[1], 'createMorphoVaultV1Adapter'), adapter),
        same(decode(outputs[2], 'owner'), owner),
        same(decode(outputs[3], 'asset'), product.asset),
        same(decode(outputs[4], 'parentVault'), wrapper),
        same(decode(outputs[5], 'morphoVaultV1'), product.underlying),
        same(decode(outputs[6], 'factory'), adapterFactory),
      ];

      if (!checks.every(Boolean)) {
        throw new Error('Wrapper/adapter connection mismatch.');
      }

      stage = 'configured-customer-round-trip';

      const roundTrip = await simulateArcRoundTrip({
        client, simulate, product, owner, wrapper, adapter,
        createVault, createAdapter, blockNumber,
      });

      console.log(JSON.stringify({
        product: product.id,
        blockNumber: blockNumber.toString(),
        wrapperAndAdapterCreationPassed: true,
        connectionsVerified: true,
        configured: true,
        roundTripVerified: true,
        ...roundTrip,
        deployed: false,
        transactionsSent: 0,
      }, null, 2));
    } catch (error) {
      console.log(JSON.stringify({
        product: product.id,
        stage,
        error: safeError(error),
        transactionsSent: 0,
      }, null, 2));
      process.exitCode = 1;
    }
  }
}

main().catch(error => {
  console.log(JSON.stringify({
    error: safeError(error),
    transactionsSent: 0,
  }, null, 2));
  process.exitCode = 1;
});