'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  formatUnits,
  getAddress,
  parseAbi,
  parseUnits,
	encodeFunctionData,
  decodeEventLog,
  keccak256,
	toHex,
} from 'viem';
const arc = {
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [] } },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
};

import { GALAXY_ARC as CONFIG } from '../../../lib/tokenized-funds/galaxy-usdc-arc/config';

const vaultAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
  'function deposit(uint256 assets,address onBehalf) returns (uint256)',
  'function redeem(uint256 shares,address receiver,address onBehalf) returns (uint256)',
]);





const PUBLIC_DEPOSITS_ENABLED = CONFIG.depositsEnabled === true;

const PUBLIC_REDEMPTIONS_ENABLED = CONFIG.redemptionsEnabled === true;

const BUTTON =
  'rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40';

function sameAddress(a, b) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function writeAllowed(kind, account) {
  if (!account) return false;
  if (kind === 'deposit') return PUBLIC_DEPOSITS_ENABLED;
  if (kind === 'redeem') return PUBLIC_REDEMPTIONS_ENABLED;
  return false;
}

function message(error) {
  const code =
    error?.code ??
    error?.cause?.code ??
    error?.cause?.cause?.code;

  if (code === 4001) return 'Wallet request cancelled.';
  if (code === -32002) return 'Check the request already open in your wallet.';

  return error?.shortMessage || error?.message || 'Request failed.';
}

function clients(provider) {
  return {
    publicClient: createPublicClient({
      chain: arc,
      transport: custom(provider),
    }),
    walletClient: createWalletClient({
      chain: arc,
      transport: custom(provider),
    }),
  };
}

function displayUnits(value, decimals, places = 6) {
  const formatted = formatUnits(value, decimals);
  const [whole, fraction = ''] = formatted.split('.');
  const trimmed = fraction.slice(0, places).replace(/0+$/, '');

  return trimmed ? `${whole}.${trimmed}` : whole;
}


const EXPECTED_VAULT_OWNER = '0x39bb4a10626b58430abfa8284b0f001f49734f70';
const TRANSACTION_GAS_CEILING = 5_000_000n;
const TRANSACTION_MAX_FEE = 42_000_000_000n;
const TRANSACTION_PRIORITY_FEE = 1_000_000_000n;
const DEAD = '0x000000000000000000000000000000000000dead';

const VERIFIED_PRODUCTS = {
  'galaxy-usdc-arc': {
    symbol: 'USDC',
    asset: '0x3600000000000000000000000000000000000000',
    wrapper: '0xa6870d240db24ab2c626d52fb621241e8c86441e',
    codeHash: '0xac3d89c4bed30ede74f4e94e9c0e124a13ed24d0e011181515996362879bae57',
  },
  'galaxy-eurc-arc': {
    symbol: 'EURC',
    asset: '0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1',
    wrapper: '0x624fcccc862a71932f61e32e22eee3ac64252809',
    codeHash: '0x0d9a18645e4c23fd5698069edd84ca001b630b0aeff6dd64863debaa2f2dc511',
  },
};

function requireCondition(condition, text) {
  if (!condition) throw new Error(text);
}

function parseDepositAssets(value) {
  const normalized = String(value).trim().replace(/^\./, '0.');

  requireCondition(
    /^\d+(?:\.\d{1,6})?$/.test(normalized),
    'Enter an amount with at most six decimals.',
  );

  const assets = parseUnits(normalized, 6);
  requireCondition(assets > 0n, 'Enter an amount greater than zero.');
  requireCondition(
    assets <= (1n << 256n) - 1n,
    'The amount exceeds the supported contract range.',
  );
  return assets;
}

export default function ArcWalletPanel() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balances, setBalances] = useState(null);
  const [amount, setAmount] = useState('0.5');
  const [tab, setTab] = useState('deposit');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState([]);

  const pending = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);

  async function readBalances(selectedProvider, selectedAccount) {
    const version = generation.current;
    const { publicClient } = clients(selectedProvider);

    if (await publicClient.getChainId() !== arc.id) {
      throw new Error('Switch your wallet to Arc.');
    }

    const blockNumber = await publicClient.getBlockNumber();
    const [eth, usdc, shares] = await Promise.all([
      publicClient.getBalance({
        address: selectedAccount,
        blockNumber,
      }),
      publicClient.readContract({
        address: CONFIG.assetAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [selectedAccount],
        blockNumber,
      }),
      publicClient.readContract({
        address: CONFIG.wrapperAddress,
        abi: vaultAbi,
        functionName: 'balanceOf',
        args: [selectedAccount],
        blockNumber,
      }),
    ]);

    const allowance = await publicClient.readContract({
      address: CONFIG.assetAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [selectedAccount, CONFIG.wrapperAddress],
      blockNumber,
    });

    const assets = await publicClient.readContract({
      address: CONFIG.wrapperAddress,
      abi: vaultAbi,
      functionName: 'convertToAssets',
      args: [shares],
      blockNumber,
    });

    if (
      mounted.current &&
      version === generation.current &&
      await publicClient.getChainId() === arc.id
    ) {
      setBalances({ eth, usdc, shares, assets, allowance });
    }
  }

  useEffect(() => {
    if (!provider) return;

    function accountsChanged(accounts) {
      generation.current++;
      setAccount(accounts?.[0] ? getAddress(accounts[0]) : null);
      setBalances(null);
      setStatus('');
      setError('');
    }

    function chainChanged(chain) {
      generation.current++;
      setChainId(Number(chain));
      setBalances(null);
      setStatus('');
      setError('');
    }

    function disconnected() {
      generation.current++;
      setAccount(null);
      setChainId(null);
      setBalances(null);
    }

    provider.on?.('accountsChanged', accountsChanged);
    provider.on?.('chainChanged', chainChanged);
    provider.on?.('disconnect', disconnected);

    return () => {
      provider.removeListener?.('accountsChanged', accountsChanged);
      provider.removeListener?.('chainChanged', chainChanged);
      provider.removeListener?.('disconnect', disconnected);
    };
  }, [provider]);

  useEffect(() => {
    if (!provider || !account || chainId !== arc.id) return;

    void readBalances(provider, account).catch((cause) => {
      if (mounted.current) setError(message(cause));
    });
  }, [provider, account, chainId]);

  async function connect() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');

    try {
      const root = window.ethereum;
      const candidates = root?.providers ?? [root];
      const injected =
        candidates.find(item => item?.isMetaMask && !item?.isRabby) ||
        root;
      if (!injected?.request) {
        throw new Error('Install or open an EVM wallet.');
      }

      const accounts = await injected.request({
        method: 'eth_requestAccounts',
      });
      if (!accounts?.[0]) throw new Error('No wallet account returned.');

      const chain = await injected.request({ method: 'eth_chainId' });
      generation.current++;
      setProvider(injected);
      setAccount(getAddress(accounts[0]));
      setChainId(Number(chain));
      setBalances(null);
    } catch (cause) {
      setError(message(cause));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function switchToArc() {
    if (!provider || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x13b2' }],
      });
      setChainId(Number(await provider.request({
        method: 'eth_chainId',
      })));
    } catch (cause) {
      const code = cause?.code ?? cause?.cause?.code;
      setError(
        Number(code) === 4902
          ? 'Add Arc chain 5042 to your wallet, then reconnect.'
          : message(cause),
      );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function transact(kind) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setStatus('');

    let hash = null;
    let attempted = false;
    let lockKey = null;

    try {
      requireCondition(
        writeAllowed(kind, account),
        'This action is currently disabled in this interface.',
      );
      requireCondition(provider, 'Connect a wallet first.');

      const selectedAccount = account;
      const version = generation.current;
      const { publicClient } = clients(provider);
      const product = VERIFIED_PRODUCTS[CONFIG.id];

      requireCondition(product, 'Unsupported Arc product.');
      requireCondition(CONFIG.chainId === 5042, 'Unexpected configured chain.');
      requireCondition(CONFIG.assetDecimals === 6, 'Unexpected asset decimals.');
      requireCondition(CONFIG.shareDecimals === 18, 'Unexpected share decimals.');
      requireCondition(
        sameAddress(CONFIG.assetAddress, product.asset) &&
        sameAddress(CONFIG.wrapperAddress, product.wrapper) &&
        CONFIG.assetSymbol === product.symbol,
        'Product configuration differs from the verified deployment.',
      );

      async function assertSession() {
        const [accounts, chain] = await Promise.all([
          provider.request({ method: 'eth_accounts' }),
          provider.request({ method: 'eth_chainId' }),
        ]);

        requireCondition(
          mounted.current &&
          version === generation.current &&
          sameAddress(accounts?.[0], selectedAccount),
          'Wallet session changed. Stop and inspect any submitted transaction.',
        );
        requireCondition(Number(chain) === 5042, 'Select Arc chain 5042.');
        requireCondition(
          writeAllowed(kind, selectedAccount),
          'This action was disabled while preparing the transaction.',
        );
      }

      await assertSession();

      lockKey =
        'mw-arc-operator-5042-' +
        CONFIG.wrapperAddress.toLowerCase() + '-' +
        selectedAccount.toLowerCase();

      const prior = window.localStorage.getItem(lockKey);
      requireCondition(
        !prior,
        'An earlier transaction attempt is recorded. Inspect it before retrying: ' +
          prior,
      );

      setStatus('Checking the deployed Tokenizer and wallet…');

      const blockNumber = await publicClient.getBlockNumber();
      const code = await publicClient.getCode({
        address: CONFIG.wrapperAddress,
        blockNumber,
      });
      requireCondition(
        code && code !== '0x' && keccak256(code) === product.codeHash,
        'Tokenizer bytecode does not match the verified deployment.',
      );

      const identityAbi = parseAbi([
        'function asset() view returns (address)',
        'function owner() view returns (address)',
        'function performanceFee() view returns (uint256)',
        'function managementFee() view returns (uint256)',
      ]);

      const read = (address, abi, functionName, args = []) =>
        publicClient.readContract({
          address, abi, functionName, args, blockNumber,
        });

      const [
        asset,
        owner,
        performanceFee,
        managementFee,
        tokenBalance,
        allowance,
        sharesBefore,
        protectionBefore,
      ] = await Promise.all([
        read(CONFIG.wrapperAddress, identityAbi, 'asset'),
        read(CONFIG.wrapperAddress, identityAbi, 'owner'),
        read(CONFIG.wrapperAddress, identityAbi, 'performanceFee'),
        read(CONFIG.wrapperAddress, identityAbi, 'managementFee'),
        read(CONFIG.assetAddress, erc20Abi, 'balanceOf', [selectedAccount]),
        read(CONFIG.assetAddress, erc20Abi, 'allowance', [
          selectedAccount, CONFIG.wrapperAddress,
        ]),
        read(CONFIG.wrapperAddress, vaultAbi, 'balanceOf', [selectedAccount]),
        read(CONFIG.wrapperAddress, vaultAbi, 'balanceOf', [DEAD]),
      ]);

      requireCondition(sameAddress(asset, CONFIG.assetAddress), 'Vault asset mismatch.');
      requireCondition(sameAddress(owner, EXPECTED_VAULT_OWNER), 'Vault owner changed.');
      requireCondition(
        performanceFee === 100_000_000_000_000_000n &&
        managementFee === 0n,
        'Tokenizer fee settings changed; review before transacting.',
      );
      requireCondition(
        protectionBefore >= 1_000_000_000_000_000_000n,
        'Expected protection shares are missing.',
      );

      let assets = 0n;
      let action;
      let contract;

      if (kind === 'deposit') {
        assets = parseDepositAssets(amount);
        requireCondition(
          tokenBalance >= assets,
          'Insufficient ' + CONFIG.assetSymbol + ' for this deposit.',
        );

        if (allowance < assets) {
          action = 'approve';
          contract = {
            address: CONFIG.assetAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [CONFIG.wrapperAddress, assets],
          };
        } else {
          action = 'deposit';
          contract = {
            address: CONFIG.wrapperAddress,
            abi: vaultAbi,
            functionName: 'deposit',
            args: [assets, selectedAccount],
          };
        }
      } else if (kind === 'redeem') {
        requireCondition(sharesBefore > 0n, 'No wallet-owned shares to redeem.');
        action = 'redeem';
        contract = {
          address: CONFIG.wrapperAddress,
          abi: vaultAbi,
          functionName: 'redeem',
          args: [sharesBefore, selectedAccount, selectedAccount],
        };
      } else {
        throw new Error('Unknown action.');
      }

      const label = action === 'approve'
        ? CONFIG.assetSymbol + ' approval'
        : action === 'deposit' ? 'deposit' : 'redemption';

      setStatus('Simulating ' + label + '…');

      const simulation = await publicClient.simulateContract({
        ...contract,
        account: selectedAccount,
      });

      if (action === 'approve') {
        requireCondition(simulation.result === true, 'Approval simulation failed.');
      } else {
        requireCondition(
          typeof simulation.result === 'bigint' && simulation.result > 0n,
          'Simulation returned no shares or assets.',
        );
      }

      const estimate = await publicClient.estimateContractGas({
        ...contract,
        account: selectedAccount,
      });

      const gas = (estimate * 150n + 99n) / 100n;
      requireCondition(
        gas <= TRANSACTION_GAS_CEILING,
        'Estimated gas exceeds the interface gas limit. Do not submit.',
      );

      await publicClient.simulateContract({
        ...contract,
        account: selectedAccount,
        gas,
      });

      const latestBlock = await publicClient.getBlock();
      requireCondition(
        typeof latestBlock.baseFeePerGas === 'bigint' &&
        latestBlock.baseFeePerGas + TRANSACTION_PRIORITY_FEE <= TRANSACTION_MAX_FEE,
        'Current fees exceed this interface fee cap. No transaction request was sent.',
      );

      const nativeBalance = await publicClient.getBalance({
        address: selectedAccount,
      });

      const futureOperations = action === 'approve'
        ? 2n
        : action === 'deposit' ? 1n : 0n;

      const futureGasReserve =
        futureOperations * TRANSACTION_GAS_CEILING * TRANSACTION_MAX_FEE;

      const nativeAssetSpending =
        kind === 'deposit' && CONFIG.assetSymbol === 'USDC'
          ? assets * 1_000_000_000_000n
          : 0n;

      requireCondition(
        nativeBalance >=
          gas * TRANSACTION_MAX_FEE + futureGasReserve + nativeAssetSpending,
        'Insufficient native USDC for the asset spending and reserved gas budgets.',
      );

      const [latestNonce, pendingNonce] = await Promise.all([
        publicClient.getTransactionCount({
          address: selectedAccount, blockTag: 'latest',
        }),
        publicClient.getTransactionCount({
          address: selectedAccount, blockTag: 'pending',
        }),
      ]);

      requireCondition(
        latestNonce === pendingNonce,
        'This wallet has a pending Arc transaction. Inspect it first.',
      );

      const data = encodeFunctionData({
        abi: contract.abi,
        functionName: contract.functionName,
        args: contract.args,
      });

      const payload = {
        from: selectedAccount,
        to: contract.address,
        chainId: '0x13b2',
        nonce: toHex(latestNonce),
        data,
        value: '0x0',
        gas: toHex(gas),
        maxFeePerGas: toHex(TRANSACTION_MAX_FEE),
        maxPriorityFeePerGas: toHex(TRANSACTION_PRIORITY_FEE),
      };

      await assertSession();
      requireCondition(
        await publicClient.getTransactionCount({
          address: selectedAccount, blockTag: 'pending',
        }) === latestNonce,
        'Nonce changed during preparation. Stop and refresh.',
      );

      setStatus(
        'Review ' + label + ' in MetaMask. Gas budget: ' + gas.toString() +
        '; max fee: 42 gwei; priority fee: 1 gwei. ' +
        (action === 'approve'
          ? 'Approve exactly ' + formatUnits(assets, 6) + ' ' +
            CONFIG.assetSymbol + '. This will not also deposit.'
          : 'Review the Tokenizer destination and amount before signing.'),
      );

      window.localStorage.setItem(lockKey, JSON.stringify({
        stage: 'attempt-started',
        action,
        nonce: latestNonce,
        calldataHash: keccak256(data),
        at: new Date().toISOString(),
      }));
      attempted = true;

      hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [payload],
      });

      requireCondition(
        /^0x[0-9a-fA-F]{64}$/.test(hash),
        'Wallet returned an invalid transaction hash. Inspect wallet history.',
      );

      window.localStorage.setItem(lockKey, JSON.stringify({
        stage: 'submitted', action, hash,
      }));

      setTransactions(previous => [
        ...previous,
        { label, hash, status: 'pending' },
      ]);
      setStatus('Waiting for ' + label + ' confirmation. Do not retry.');

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 2,
        timeout: 180_000,
      });

      requireCondition(
        receipt.status === 'success',
        'Transaction reverted: ' + hash + '. Inspect it before retrying.',
      );

      await assertSession();

      const mined = await publicClient.getTransaction({ hash });
      requireCondition(
        sameAddress(mined.from, selectedAccount) &&
        sameAddress(mined.to, contract.address) &&
        mined.chainId === 5042 &&
        mined.nonce === latestNonce &&
        mined.input.toLowerCase() === data.toLowerCase() &&
        mined.value === 0n,
        'Mined transaction does not match the requested action.',
      );

      requireCondition(
        mined.gas <= gas &&
        typeof mined.maxFeePerGas === 'bigint' &&
        mined.maxFeePerGas <= TRANSACTION_MAX_FEE &&
        typeof mined.maxPriorityFeePerGas === 'bigint' &&
        mined.maxPriorityFeePerGas <= TRANSACTION_PRIORITY_FEE,
        'Wallet exceeded the displayed transaction budget. Inspect the receipt.',
      );

      const atReceipt = (address, abi, functionName, args = []) =>
        publicClient.readContract({
          address, abi, functionName, args,
          blockNumber: receipt.blockNumber,
        });

      const protectionAfter = await atReceipt(
        CONFIG.wrapperAddress, vaultAbi, 'balanceOf', [DEAD],
      );
      requireCondition(
        protectionAfter >= protectionBefore,
        'Protection share check failed.',
      );

      if (action === 'approve') {
        const actualAllowance = await atReceipt(
          CONFIG.assetAddress, erc20Abi, 'allowance',
          [selectedAccount, CONFIG.wrapperAddress],
        );
        requireCondition(
          actualAllowance === assets,
          'Confirmed allowance does not match the exact requested amount.',
        );
      } else {
        let depositedAssets = 0n;
        let returnedAssets = 0n;
        let mintedShares = 0n;
        let burnedShares = 0n;

        for (const log of receipt.logs) {
          if (
            !sameAddress(log.address, CONFIG.assetAddress) &&
            !sameAddress(log.address, CONFIG.wrapperAddress)
          ) continue;

          let event;
          try {
            event = decodeEventLog({
              abi: erc20Abi,
              data: log.data,
              topics: log.topics,
            });
          } catch {
            continue;
          }
          if (event.eventName !== 'Transfer') continue;

          const { from, to, value } = event.args;
          const zero = '0x0000000000000000000000000000000000000000';

          if (sameAddress(log.address, CONFIG.assetAddress)) {
            if (
              sameAddress(from, selectedAccount) &&
              sameAddress(to, CONFIG.wrapperAddress)
            ) depositedAssets += value;

            if (
              sameAddress(from, CONFIG.wrapperAddress) &&
              sameAddress(to, selectedAccount)
            ) returnedAssets += value;
          } else {
            if (sameAddress(from, zero) && sameAddress(to, selectedAccount)) {
              mintedShares += value;
            }
            if (sameAddress(from, selectedAccount) && sameAddress(to, zero)) {
              burnedShares += value;
            }
          }
        }

        if (action === 'deposit') {
          requireCondition(
            depositedAssets === assets && mintedShares > 0n,
            'Deposit transfer or wallet share-mint verification failed.',
          );
        } else {
          requireCondition(
            burnedShares === sharesBefore && returnedAssets > 0n,
            'Redemption share-burn or asset-return verification failed.',
          );
        }
      }

      window.localStorage.removeItem(lockKey);

      setTransactions(previous => previous.map(item =>
        item.hash === hash ? { ...item, status: 'success' } : item
      ));

      const gasNotice = mined.gas !== gas
        ? ' The wallet used a lower gas limit within the displayed budget.'
        : '';

      setStatus(
        (action === 'approve'
          ? 'Approval confirmed. No deposit was sent. Click Deposit separately when ready.'
          : action === 'deposit'
            ? 'Deposit confirmed; wallet share mint and protection shares verified.'
            : 'Redemption confirmed; wallet share burn, asset return, and protection shares verified.') +
        gasNotice,
      );

      try {
        await readBalances(provider, selectedAccount);
      } catch {
        setStatus(
          'Transaction verified. Balance refresh failed; click Refresh balances. ' +
          'Do not repeat the transaction.',
        );
      }
    } catch (cause) {
      const code = cause?.code ?? cause?.cause?.code ?? cause?.cause?.cause?.code;

      if (Number(code) === 4001 && !hash && lockKey) {
        window.localStorage.removeItem(lockKey);
        attempted = false;
      }

      setError(message(cause));
      if (hash || attempted) {
        setStatus(
          'STOP: inspect the transaction hash or wallet history before retrying. ' +
          (hash ? 'Transaction: ' + hash : 'A wallet send request was attempted.'),
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }


  async function refresh() {
    if (!provider || !account || busy) return;
    setError('');
    try {
      await readBalances(provider, account);
    } catch (cause) {
      setError(message(cause));
    }
  }

  let requestedAssets = 0n;
  try {
    requestedAssets = parseDepositAssets(amount);
  } catch {}

  const needsApproval =
    balances &&
    requestedAssets > 0n &&
    balances.allowance < requestedAssets;

  const depositLabel = needsApproval
    ? 'Approve ' + formatUnits(requestedAssets, 6) + ' ' + CONFIG.assetSymbol
    : 'Deposit ' + CONFIG.assetSymbol;

  const onArc = chainId === arc.id;
  const canDeposit =
		onArc && writeAllowed('deposit', account);

	const canRedeem =
		onArc && writeAllowed('redeem', account);

  return (
	<div className="space-y-5">
			{!account ? (
			<button
					type="button"
					className={`${BUTTON} w-full`}
					onClick={connect}
					disabled={busy}
			>
					{busy ? 'Connecting…' : 'Connect wallet'}
			</button>
			) : (
			<>
					<div className="flex items-center justify-between gap-3">
					<a
							href={`https://explorer.arc.io/address/${account}`}
							target="_blank"
							rel="noopener noreferrer"
							title={account}
							className="font-mono text-xs text-slate-400 transition hover:text-white"
					>
							{account.slice(0, 6)}…{account.slice(-4)}
					</a>

					<span
							className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
							onArc
									? 'bg-emerald-400/10 text-emerald-300'
									: 'bg-amber-400/10 text-amber-300'
							}`}
					>
							{onArc ? 'Arc connected' : 'Wrong network'}
					</span>
					</div>

					{!onArc ? (
					<button
							type="button"
							className={`${BUTTON} w-full`}
							onClick={switchToArc}
							disabled={busy}
					>
							{busy ? 'Check your wallet…' : 'Switch to Arc'}
					</button>
					) : (
					<>
							<div>
							<p className="text-xs text-slate-400">
									Position balance
							</p>

							<p className="mt-3 break-words text-3xl font-semibold tracking-tight text-white">
									{balances ? displayUnits(balances.assets, 6) : '—'}
									<span className="ml-2 text-base font-medium text-slate-400">
									USDC
									</span>
							</p>

							<p className="mt-2 break-words text-xs text-slate-500">
									{balances
									? `${formatUnits(balances.shares, 18)} ${CONFIG.wrapperSymbol}`
									: 'Reading wrapper shares…'}
							</p>
							</div>

							<dl className="space-y-2 border-y border-white/[0.06] py-4 text-xs">
							<div className="flex justify-between gap-3">
									<dt className="text-slate-400">Wallet USDC</dt>
									<dd className="break-all text-right tabular-nums text-slate-200">
									{balances ? displayUnits(balances.usdc, 6) : '—'}
									</dd>
							</div>

							<div className="flex justify-between gap-3">
									<dt className="text-slate-400">Native USDC for gas</dt>
									<dd className="break-all text-right tabular-nums text-slate-200">
									{balances ? displayUnits(balances.eth, 18, 8) : '—'}
									</dd>
							</div>
							</dl>

							<div
							role="group"
							aria-label="Position action"
							className="flex gap-1 rounded-xl bg-black/20 p-1"
							>
							{[
									['deposit', 'Deposit'],
									['withdraw', 'Withdraw'],
							].map(([value, label]) => (
									<button
									key={value}
									type="button"
									aria-pressed={tab === value}
									disabled={busy}
									onClick={() => setTab(value)}
									className={`flex-1 rounded-lg px-3 py-2.5 text-sm transition disabled:opacity-50 ${
											tab === value
											? 'bg-white/[0.08] font-medium text-white'
											: 'text-slate-500 hover:text-slate-200'
									}`}
									>
									{label}
									</button>
							))}
							</div>

							{tab === 'deposit' ? (
							<div>
									<label
									htmlFor="galaxy-usdc-arc-deposit-amount"
									className="block text-xs text-slate-400"
									>
									Deposit amount
									</label>

									<div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-4">
									<input
											id="galaxy-usdc-arc-deposit-amount"
											type="text"
											inputMode="decimal"
											autoComplete="off"
											value={amount}
											onChange={(event) => setAmount(event.target.value)}
											placeholder="0.00"
											disabled={busy || !canDeposit}
											className="min-w-0 flex-1 bg-transparent text-2xl text-white outline-none placeholder:text-slate-600 disabled:opacity-50"
									/>

									<span className="rounded-lg bg-sky-400/10 px-2.5 py-1.5 text-xs font-medium text-sky-300">
											USDC
									</span>
									</div>

									<button
									type="button"
									className={`${BUTTON} mt-4 w-full`}
									disabled={busy || !canDeposit || !balances}
									onClick={() => void transact('deposit')}
									>
									{busy ? 'Processing…' : depositLabel}
									</button>

									<p className="mt-2 text-[11px] leading-5 text-slate-500">
									Allowance: {balances ? displayUnits(balances.allowance, 6) : '—'} {CONFIG.assetSymbol}.
                  Approval and deposit require separate clicks.
									Shares are sent to your connected wallet.
									</p>
							</div>
							) : (
							<div>
									<div className="rounded-2xl border border-white/10 bg-black/10 p-4">
									<p className="text-xs text-slate-400">
											Full-position redemption
									</p>

									<p className="mt-2 text-xl font-medium text-white">
											{balances ? displayUnits(balances.assets, 6) : '—'}
											<span className="ml-2 text-sm text-slate-400">
											USDC position value
											</span>
									</p>

									<p className="mt-2 text-xs leading-5 text-slate-500">
											Redeems all wrapper shares owned by this wallet.
											Actual USDC returned is determined at execution
											and depends on available liquidity.
									</p>
									</div>

									<button
									type="button"
									className={`${BUTTON} mt-4 w-full`}
									disabled={
											busy ||
											!canRedeem ||
											!balances ||
											balances.shares === 0n
									}
									onClick={() => void transact('redeem')}
									>
									{busy
											? 'Processing…'
											: balances?.shares === 0n
											? 'No position to withdraw'
											: 'Withdraw entire position'}
									</button>

									<p className="mt-2 text-[11px] leading-5 text-slate-500">
									This interface supports full-position redemption.
									Protection shares are not included.
									</p>
							</div>
							)}

							<button
							type="button"
							onClick={refresh}
							disabled={busy}
							className="text-xs text-sky-300 underline underline-offset-4 transition hover:text-sky-200 disabled:opacity-40"
							>
							Refresh balances
							</button>
					</>
					)}
			</>
			)}

			<p className="rounded-xl border border-amber-400/10 bg-amber-400/5 px-3 py-2 text-[11px] leading-5 text-amber-300">
				{PUBLIC_DEPOSITS_ENABLED
          ? PUBLIC_REDEMPTIONS_ENABLED
            ? 'Deposits and full-position redemptions are enabled on Arc. Gas is paid in native USDC. Capital is at risk.'
            : 'Deposits are enabled. Redemptions are currently paused in this interface.'
          : PUBLIC_REDEMPTIONS_ENABLED
            ? 'New deposits are paused. Existing positions can be redeemed, subject to liquidity.'
            : 'Public deposits and redemptions are currently disabled.'}
        </p>

			{status && (
			<p role="status" className="text-sm leading-6 text-slate-300">
					{status}
			</p>
			)}

			{error && (
			<p
					role="alert"
					className="break-words rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-xs leading-6 text-red-300"
			>
					{error}
			</p>
			)}

			{transactions.length > 0 && (
			<div className="space-y-3 border-t border-white/[0.06] pt-4">
					<p className="text-xs font-medium text-slate-400">
					Session transactions
					</p>

					{transactions.map((transaction) => (
					<a
							key={transaction.hash}
							href={`https://explorer.arc.io/tx/${transaction.hash}`}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/10 px-3 py-3 transition hover:border-sky-400/30"
					>
							<span className="min-w-0">
							<span className="block text-xs capitalize text-slate-200">
									{transaction.label}
							</span>
							<span className="mt-1 block font-mono text-[10px] text-slate-500">
									{transaction.hash.slice(0, 10)}…
									{transaction.hash.slice(-6)}
							</span>
							</span>

							<span
							className={`text-[11px] ${
									transaction.status === 'success'
									? 'text-emerald-300'
									: transaction.status === 'pending'
											? 'text-amber-300'
											: 'text-red-300'
							}`}
							>
							{transaction.status === 'success'
									? 'Confirmed ↗'
									: transaction.status === 'pending'
									? 'Pending ↗'
									: 'Reverted ↗'}
							</span>
					</a>
					))}
			</div>
			)}
	</div>
	);
}