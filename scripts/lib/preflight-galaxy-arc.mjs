import { config } from 'dotenv';
import {
  createPublicClient,
  custom,
  http,
  keccak256,
  parseAbi,
  toFunctionSelector,
  zeroAddress,
} from 'viem';

config({ path: '.env.local', quiet: true });

const CHAIN_ID = 5042;
const USDC = '0x3600000000000000000000000000000000000000';
const ADMIN = '0x39bb4a10626b58430abfa8284b0f001f49734f70';

const abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function asset() view returns (address)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function owner() view returns (address)',
  'function curator() view returns (address)',
  'function receiveSharesGate() view returns (address)',
  'function sendSharesGate() view returns (address)',
  'function receiveAssetsGate() view returns (address)',
  'function sendAssetsGate() view returns (address)',
  'function adapterRegistry() view returns (address)',
  'function liquidityAdapter() view returns (address)',
  'function adaptersLength() view returns (uint256)',
  'function adapters(uint256) view returns (address)',
  'function performanceFee() view returns (uint96)',
  'function managementFee() view returns (uint96)',
  'function performanceFeeRecipient() view returns (address)',
  'function managementFeeRecipient() view returns (address)',
  'function timelock(bytes4) view returns (uint256)',
  'function abdicated(bytes4) view returns (bool)',
  'function isSentinel(address) view returns (bool)',
  'function isAllocator(address) view returns (bool)',
  'function canSendShares(address) view returns (bool)',
  'function canReceiveShares(address) view returns (bool)',
  'function canSendAssets(address) view returns (bool)',
  'function canReceiveAssets(address) view returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function realAssets() view returns (uint256)',
  'function morpho() view returns (address)',
  'function marketIdsLength() view returns (uint256)',
  'function morphoVaultV1() view returns (address)',
]);

const setters = [
  'setIsAllocator(address,bool)',
  'setReceiveSharesGate(address)',
  'setSendSharesGate(address)',
  'setReceiveAssetsGate(address)',
  'setSendAssetsGate(address)',
  'setAdapterRegistry(address)',
  'addAdapter(address)',
  'removeAdapter(address)',
  'increaseTimelock(bytes4,uint256)',
  'decreaseTimelock(bytes4,uint256)',
  'abdicate(bytes4)',
  'setPerformanceFee(uint256)',
  'setManagementFee(uint256)',
  'setPerformanceFeeRecipient(address)',
  'setManagementFeeRecipient(address)',
  'increaseAbsoluteCap(bytes,uint256)',
  'decreaseAbsoluteCap(bytes,uint256)',
  'increaseRelativeCap(bytes,uint256)',
  'decreaseRelativeCap(bytes,uint256)',
  'setMaxRate(uint256)',
  'setForceDeallocatePenalty(address,uint256)',
];

function safeError(error) {
  let current = error;
  let code = null;

  for (let i = 0; current && i < 8; i += 1) {
    if (typeof current.code === 'number') code = current.code;
    current = current.cause;
  }

  // Do not print transport URLs, headers, or RPC credentials.
  return { name: error?.name ?? 'Error', code };
}

async function probe(operation) {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return { ok: false, error: safeError(error) };
  }
}


function throttledReadTransport() {
  const upstream = http(
    process.env.ARC_RPC_URL?.trim() || 'https://rpc.mainnet.arc.io',
    { timeout: 20_000, retryCount: 0 },
  )({});

  const allowed = new Set([
    'eth_chainId',
    'eth_getBlockByNumber',
    'eth_getCode',
    'eth_call',
    'eth_getBalance',
    'eth_gasPrice',
    'eth_maxPriorityFeePerGas',
    'eth_simulateV1',
  ]);

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let queue = Promise.resolve();

  return custom({
    request(args) {
      if (!allowed.has(args.method)) {
        return Promise.reject(
          new Error('Non-allowlisted RPC method blocked: ' + args.method),
        );
      }

      const operation = queue.then(async () => {
        await sleep(750);

        for (let attempt = 0; ; attempt += 1) {
          try {
            return await upstream.request(args);
          } catch (error) {
            let current = error;
            let limited = false;

            for (let depth = 0; current && depth < 8; depth += 1) {
              if (
                current.code === -32005 ||
                current.code === 429 ||
                current.status === 429
              ) {
                limited = true;
              }
              current = current.cause;
            }

            if (!limited || attempt >= 3) throw error;
            await sleep(2000 * (2 ** attempt));
          }
        }
      });

      queue = operation.then(
        () => undefined,
        () => undefined,
      );

      return operation;
    },
  }, { retryCount: 0 });
}

export async function preflightGalaxyArc(product) {
  const report = {
    mode: 'read-only-preflight',
    product,
    fetchedAt: new Date().toISOString(),
    network: {
      expectedChainId: CHAIN_ID,
      chainId: null,
      nativeGasCurrency: 'USDC',
      nativeDecimals: 18,
      currencyBasis: 'Arc documentation; RPC chain ID checked separately',
    },
    vault: null,
    asset: null,
    permissions: null,
    adapters: [],
    administratorCandidate: null,
    fees: null,
    simulation: null,
    deploymentCompatibility: {
      status: 'unverified',
      wrapperAddress: null,
      wrapperAdapter: null,
      factories: 'Arc-specific factory provenance, code and ABI not established',
    },
    blockers: [],
    transactionsSent: 0,
  };

  const block = message => {
    if (!report.blockers.includes(message)) report.blockers.push(message);
  };

  const required = (result, label) => {
    if (!result.ok) block(`${label}: read failed.`);
    return result;
  };

  try {
    const client = createPublicClient({
      transport: throttledReadTransport(),
    });

    report.network.chainId = await client.getChainId();

    if (report.network.chainId !== CHAIN_ID) {
      throw new Error('WrongChain');
    }

    const snapshot = await client.getBlock({ blockTag: 'latest' });
    const blockNumber = snapshot.number;

    if (blockNumber == null) throw new Error('MissingBlockNumber');

    report.network.blockNumber = blockNumber;
    report.network.blockHash = snapshot.hash;

    const read = (address, functionName, args = []) =>
      client.readContract({
        address, abi, functionName, args, blockNumber,
      });

    const code = async address => {
      const bytecode = await client.getCode({ address, blockNumber });
      const exists = Boolean(bytecode && bytecode !== '0x');

      return {
        exists,
        bytes: exists ? (bytecode.length - 2) / 2 : 0,
        hash: exists ? keccak256(bytecode) : null,
      };
    };

    const readFields = async (address, fields) =>
      Object.fromEntries(await Promise.all(fields.map(async name => [
        name,
        required(
          await probe(() => read(address, name)),
          `${address}.${name}()`,
        ),
      ])));

    const vaultCode = await code(product.underlyingVault);

    if (!vaultCode.exists) throw new Error('NoVaultBytecode');

    const state = await readFields(product.underlyingVault, [
      'name', 'symbol', 'decimals', 'asset', 'totalAssets', 'totalSupply',
      'owner', 'curator',
      'receiveSharesGate', 'sendSharesGate',
      'receiveAssetsGate', 'sendAssetsGate',
      'adapterRegistry', 'liquidityAdapter', 'adaptersLength',
      'performanceFee', 'managementFee',
      'performanceFeeRecipient', 'managementFeeRecipient',
    ]);

    report.vault = {
      address: product.underlyingVault,
      code: vaultCode,
      reads: state,
      versionStatus: 'V2 read probes only; implementation audit pending',
    };

    const asset = state.asset.ok ? state.asset.value : null;
    let assetDecimals = null;

    if (asset) {
      const identity = await readFields(asset, ['symbol', 'decimals']);
      assetDecimals = identity.decimals.ok ? identity.decimals.value : null;

      report.asset = {
        address: asset,
        code: await code(asset),
        ...identity,
      };

      if (!report.asset.code.exists) block('Deposit asset has no bytecode.');

      if (
        !identity.symbol.ok ||
        identity.symbol.value !== product.assetSymbol
      ) {
        block(`Deposit asset symbol is not confirmed as ${product.assetSymbol}.`);
      }

      if (
        product.assetSymbol === 'USDC' &&
        (asset.toLowerCase() !== USDC || assetDecimals !== 6)
      ) {
        block('USDC asset address/6-decimal precision mismatch.');
      }

      if (product.assetSymbol === 'EURC') {
        block(
          'EURC asset address must be independently matched to the official Arc deployment; symbol alone is insufficient.',
        );
      }
    }

    report.permissions = {
      timelocks: [],
      administratorChecks: {},
      roleEnumeration: 'Not performed; known-account checks are not all roles.',
      gateImplementationAudit: 'Pending',
    };

    for (const signature of setters) {
      const selector = toFunctionSelector(signature);

      const [timelock, abdicated] = await Promise.all([
        probe(() => read(product.underlyingVault, 'timelock', [selector])),
        probe(() => read(product.underlyingVault, 'abdicated', [selector])),
      ]);

      report.permissions.timelocks.push({
        signature,
        selector,
        seconds: required(timelock, `${signature} timelock`),
        abdicated: required(abdicated, `${signature} abdication`),
      });
    }

    const sendGateSetter = report.permissions.timelocks.find(
      item => item.signature === 'setSendAssetsGate(address)',
    );

    const gateRead = state.sendAssetsGate;
    const abdicationRead = sendGateSetter?.abdicated;

    report.underlyingSendAssetsGateReview = {
      currentGate: gateRead.ok ? gateRead.value : null,
      setterAbdicated: abdicationRead?.ok ? abdicationRead.value : null,
      setterTimelockSeconds: sendGateSetter?.seconds.ok
        ? sendGateSetter.seconds.value
        : null,
      status: 'unverified',
    };

    if (!gateRead.ok || !abdicationRead?.ok) {
      block('FEE-WRAPPER BLOCKER: underlying Send Assets Gate safety is unverified.');
    } else if (!abdicationRead.value) {
      report.underlyingSendAssetsGateReview.status =
        'blocked-pending-underlying-gate-resolution';
      block(
        'FEE-WRAPPER BLOCKER: underlying Send Assets Gate setter remains active; future gating can block in-kind exits. Resolve with underlying governance before deployment.',
      );
    } else if (gateRead.value.toLowerCase() !== zeroAddress) {
      report.underlyingSendAssetsGateReview.status =
        'installed-gate-requires-audit';
      block(
        'FEE-WRAPPER BLOCKER: underlying Send Assets Gate is installed; verify it can never block the wrapper adapter or its users.',
      );
    } else {
      report.underlyingSendAssetsGateReview.status =
        'zero-gate-and-setter-abdicated; other compatibility checks still required';
    }

    for (const name of [
      'isSentinel', 'isAllocator',
      'canSendShares', 'canReceiveShares',
      'canSendAssets', 'canReceiveAssets',
    ]) {
      report.permissions.administratorChecks[name] = required(
        await probe(() => read(product.underlyingVault, name, [ADMIN])),
        `${name}(administrator candidate)`,
      );
    }

    if (state.adaptersLength.ok) {
      const count = state.adaptersLength.value;

      if (count > 100n) {
        block(`Adapter count ${count} exceeds inspection bound; none omitted silently.`);
      } else {
        for (let index = 0n; index < count; index += 1n) {
          const address = await read(
            product.underlyingVault, 'adapters', [index],
          );

          const [adapterCode, assets, morpho, marketCount, childVault] =
            await Promise.all([
              probe(() => code(address)),
              probe(() => read(address, 'realAssets')),
              probe(() => read(address, 'morpho')),
              probe(() => read(address, 'marketIdsLength')),
              probe(() => read(address, 'morphoVaultV1')),
            ]);

          const market =
            morpho.ok &&
            morpho.value.toLowerCase() !== zeroAddress &&
            marketCount.ok;

          const child =
            childVault.ok &&
            childVault.value.toLowerCase() !== zeroAddress;

          const typeCandidate = market && child
            ? 'ambiguous'
            : market
              ? 'MorphoMarketV1-family'
              : child
                ? 'MorphoVaultV1-family'
                : 'unknown';

          report.adapters.push({
            address,
            code: adapterCode,
            assets,
            typeCandidate,
            probes: { morpho, marketCount, childVault },
            compatibilityVerified: false,
          });

          if (!assets.ok) block(`Adapter ${address}: assets unavailable.`);

          if (
            (!assets.ok || assets.value > 0n) &&
            ['unknown', 'ambiguous'].includes(typeCandidate)
          ) {
            block(`Active/unvalued adapter ${address} requires explicit support.`);
          }
        }
      }
    }

    const [nativeBalance, nativeUsdcDecimals, usdcBalance, depositBalance] =
      await Promise.all([
        probe(() => client.getBalance({ address: ADMIN, blockNumber })),
        probe(() => read(USDC, 'decimals')),
        probe(() => read(USDC, 'balanceOf', [ADMIN])),
        asset
          ? probe(() => read(asset, 'balanceOf', [ADMIN]))
          : Promise.resolve({ ok: false, error: { name: 'NoAsset' } }),
      ]);

    const sharedBalanceComparable =
      nativeBalance.ok &&
      usdcBalance.ok &&
      nativeUsdcDecimals.ok &&
      nativeUsdcDecimals.value === 6;

    report.administratorCandidate = {
      address: ADMIN,
      rolesApproved: false,
      nativeUsdcAtomic18: nativeBalance,
      erc20UsdcDecimals: nativeUsdcDecimals,
      erc20UsdcAtomic: usdcBalance,
      depositAssetBalanceAtomic: depositBalance,
      depositAssetDecimals: assetDecimals,
      sharedUsdcBalanceConsistent: sharedBalanceComparable
        ? nativeBalance.value / (10n ** 12n) === usdcBalance.value
        : null,
      balancesMustNotBeAdded: true,
      fundingSufficient: 'Not established without deployment/transaction estimates',
    };

    if (!nativeBalance.ok || nativeBalance.value === 0n) {
      block('Administrator candidate has no verified native-USDC funding.');
    }

    if (report.administratorCandidate.sharedUsdcBalanceConsistent === false) {
      block('Native/ERC-20 USDC balances do not reconcile.');
    }

    const [gasPrice, priorityFee] = await Promise.all([
      probe(() => client.request({ method: 'eth_gasPrice' })),
      probe(() => client.request({ method: 'eth_maxPriorityFeePerGas' })),
    ]);

    report.fees = {
      baseFeePerGas: snapshot.baseFeePerGas ?? null,
      gasPrice: required(gasPrice, 'Gas price'),
      priorityFee,
      depositGasBudget: 'Not estimated; no verified wrapper exists',
    };

    const simulation = await probe(() => client.request({
      method: 'eth_simulateV1',
      params: [{
        blockStateCalls: [{
          calls: [{
            to: product.underlyingVault,
            data: toFunctionSelector('asset()'),
          }],
        }],
        validation: false,
        traceTransfers: false,
      }, 'latest'],
    }));

    report.simulation = {
      status: simulation.ok
        ? 'RPC responded; inspect call status in result'
        : simulation.error.code === -32601
          ? 'Method unsupported by selected RPC'
          : 'Probe failed; support unverified',
      probe: simulation,
      roundTripVerified: false,
    };

    block('Verify full deployed implementation, gates, role events and pending governance actions.');
    block('Verify Arc factories, factory bytecode/ABI and Tokenizer adapter compatibility.');
    block('Confirm administrator/fee recipient, token symbol and commercial fee settings.');
    block('Review seed/protection deposit, retained powers and recovery procedures.');
    block('Deployments are not established; wrapperAddress/wrapperAdapter remain unset.');
    block('Verify Arc API coverage and reconcile live allocations.');
    block('Verify ordinary-wallet round trip using simulation or an explicit fork path.');
    block('Gas affordability and wallet fee behavior require transaction-specific verification.');
  } catch (error) {
    report.fatal = safeError(error);
    block(
      report.network.chainId !== null &&
      report.network.chainId !== CHAIN_ID
        ? `Wrong chain: expected ${CHAIN_ID}, got ${report.network.chainId}.`
        : 'Preflight incomplete; missing results are not zero or unrestricted.',
    );
  }

  const value = result => result?.ok ? result.value : null;

  const summary = {
    product: product.id,
    chainId: report.network.chainId,
    asset: report.asset ? {
      address: report.asset.address,
      symbol: value(report.asset.symbol),
      decimals: value(report.asset.decimals),
    } : null,
    underlyingShareDecimals: value(report.vault?.reads?.decimals),
    adapters: report.adapters.map(adapter => ({
      address: adapter.address,
      typeCandidate: adapter.typeCandidate,
      marketCount: value(adapter.probes.marketCount),
      morpho: value(adapter.probes.morpho),
      compatibilityVerified: adapter.compatibilityVerified,
    })),
    failedPermissionReads: [
      ...(
        report.permissions?.timelocks ?? []
      ).flatMap(item => [
        ...(!item.seconds.ok ? [item.signature + ': timelock'] : []),
        ...(!item.abdicated.ok ? [item.signature + ': abdication'] : []),
      ]),
      ...Object.entries(
        report.permissions?.administratorChecks ?? {},
      ).filter(([, result]) => !result.ok).map(([name]) => name),
    ],
    administratorNativeUsdcAtomic18:
      value(report.administratorCandidate?.nativeUsdcAtomic18),
    simulation: report.simulation?.status ?? null,
    underlyingSendAssetsGateReview:
      report.underlyingSendAssetsGateReview ?? null,
    deploymentCompatibility: report.deploymentCompatibility.status,
    blockers: report.blockers,
    fatal: report.fatal ?? null,
    transactionsSent: report.transactionsSent,
  };

  console.log(JSON.stringify(
    process.env.ARC_PREFLIGHT_VERBOSE === 'true' ? report : summary,
    (_key, value) => typeof value === 'bigint' ? value.toString() : value,
    2,
  ));

  if (report.blockers.length) process.exitCode = 1;
}