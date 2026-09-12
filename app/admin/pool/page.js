'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/lib/WalletContext';
import { useAuth } from '@/lib/AuthContext';
import algosdk from 'algosdk';
import { Buffer } from 'buffer';
import { toast } from 'sonner';
import {
    Loader2,
    Coins,
    ShieldCheck,
    Wallet,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    Search,
    Layers,
    FileCheck,
    ArrowRight
} from 'lucide-react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const ALGOD_NETWORK = (
  process.env.NEXT_PUBLIC_ALGORAND_NETWORK || 'testnet'
).toLowerCase();

const PUBLIC_ALGOD_SERVER =
  ALGOD_NETWORK === 'mainnet'
    ? 'https://mainnet-api.algonode.cloud'
    : 'https://testnet-api.algonode.cloud';

const PUBLIC_ALGOD_CLIENT = new algosdk.Algodv2(
  '',
  PUBLIC_ALGOD_SERVER,
  ''
);

const REVENUE_POOL_APP_ID = Number(
    process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID
);

const USDC_ASSET_ID = Number(process.env.NEXT_PUBLIC_USDC_ASSET_ID);

if (!USDC_ASSET_ID) {
    throw new Error('USDC_ASSET_ID is not configured');
}

if (!REVENUE_POOL_APP_ID) {
    throw new Error('REVENUE_POOL_APP_ID is not configured');
}

const revenuePoolAppAddress = algosdk
    .getApplicationAddress(REVENUE_POOL_APP_ID)
    .toString();

const resolvePoolIpId = (item) =>
    String(
        item?.resolvedPoolIpId ||
            item?.ipId ||
            item?.tokenizedIpId ||
            item?.assetId ||
            item?.id ||
            item?._id ||
            ''
    ).trim();

function decodePreparedTransactions(unsignedTransactionsBase64) {
    if (
        !Array.isArray(unsignedTransactionsBase64) ||
        unsignedTransactionsBase64.length !== 2
    ) {
        throw new Error('Expected exactly two unsigned transactions.');
    }

    return unsignedTransactionsBase64.map((encodedTransaction) =>
        algosdk.decodeUnsignedTransaction(
            new Uint8Array(Buffer.from(encodedTransaction, 'base64'))
        )
    );
}

function transactionAddress(publicKey) {
    if (!publicKey) {
        return null;
    }

    return algosdk.encodeAddress(publicKey);
}

const toAtomicUnitsString = (value) => {
    if (typeof value === 'bigint') return value.toString();

    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value).toString();
    }

    if (typeof value === 'string' && value.trim()) {
        return value;
    }

    return '0';
};

const toAtomicUnitsBigInt = (value) => {
    if (typeof value === 'bigint') return value;

    if (typeof value === 'number' && Number.isFinite(value)) {
        return BigInt(Math.trunc(value));
    }

    if (typeof value === 'string' && value.trim()) {
        return BigInt(value);
    }

    return 0n;
};

function validatePreparedUnallocatedUsdcDeposit({
    depositAttempt,
    batch,
    appId,
    usdcAssetId,
    appAddress,
    depositorAddress,
}) {
    const transactions = decodePreparedTransactions(
        depositAttempt?.unsignedTransactionsBase64
    );

    const [transferTxn, appCallTxn] = transactions;

    if (transferTxn.type !== 'axfer') {
        throw new Error('Deposit group transaction 0 must be a USDC asset transfer.');
    }

    if (appCallTxn.type !== 'appl') {
        throw new Error('Deposit group transaction 1 must be an application call.');
    }

    if (!transferTxn.assetTransfer?.receiver?.publicKey) {
        throw new Error(
            'Decoded USDC asset transfer does not expose a receiver address.'
        );
    }

    const decodedTransferReceiver = transactionAddress(
        transferTxn.assetTransfer.receiver.publicKey
    );

    console.warn('[V10 USDC] receiver comparison', {
        expectedRevenuePoolAppAddress: appAddress,
        decodedTransferReceiver,
        transferTransactionId: transferTxn.txID?.(),
    });

    if (decodedTransferReceiver !== appAddress) {
        throw new Error(
            'Deposit USDC transfer receiver is not the revenue-pool app address.'
        );
    }

    if (
        String(transferTxn.assetTransfer?.assetIndex) !==
        String(usdcAssetId)
    ) {
        throw new Error('Deposit transfer asset is not the configured TestNet USDC ASA.');
    }

    const decodedTransferAmount = String(
        transferTxn.assetTransfer?.amount ?? ''
    );

    const frozenBatchAmount = String(
        batch?.totalUsdcAtomicUnits ?? ''
    );

    console.warn('[V10 USDC] amount comparison', {
        decodedTransferAmount,
        frozenBatchAmount,
        batchId: batch?.batchId,
        transferTransactionId: transferTxn.txID?.(),
    });

    if (decodedTransferAmount !== frozenBatchAmount) {
        throw new Error(
            'Deposit transfer amount does not equal the frozen batch total.'
        );
    }

    if (
        transferTxn.assetTransfer?.closeRemainderTo ||
        transferTxn.assetTransfer?.assetSender
    ) {
        throw new Error('Deposit USDC transfer must not use close-out or clawback fields.');
    }

    if (
        String(appCallTxn.applicationCall?.appIndex) !== String(appId)
    ) {
        throw new Error(
            'Deposit app call targets the wrong revenue-pool application.'
        );
    }

    const action = Buffer.from(
        appCallTxn.applicationCall?.appArgs?.[0] ?? []
    ).toString('utf8');

    const poolKey = Buffer.from(
        appCallTxn.applicationCall?.appArgs?.[1] ?? []
    ).toString('utf8');

    if (action !== 'deposit_usdc') {
        throw new Error(
            'Deposit app call must use the deposit_usdc action.'
        );
    }

    if (poolKey !== batch.poolKey) {
        throw new Error(
            'Deposit app-call pool key does not match the frozen batch.'
        );
    }

    const transferGroup = Buffer.from(transferTxn.group || []).toString('base64');
    const appCallGroup = Buffer.from(appCallTxn.group || []).toString('base64');

    if (
        !transferGroup ||
        transferGroup !== appCallGroup ||
        transferGroup !== depositAttempt.groupId
    ) {
        throw new Error('Prepared deposit group ID does not match the persisted group.');
    }

    if (
        transferTxn.txID() !== depositAttempt.transactionIds?.usdcTransfer
    ) {
        throw new Error(
            'Prepared USDC transfer transaction ID does not match the persisted attempt.'
        );
    }

    if (
        appCallTxn.txID() !== depositAttempt.transactionIds?.appCall
    ) {
        throw new Error(
            'Prepared deposit app-call transaction ID does not match the persisted attempt.'
        );
    }

    return [
        {
            index: 0,
            type: 'axfer',
            sender: transactionAddress(transferTxn.sender.publicKey),
            receiver: transactionAddress(
                transferTxn.assetTransfer.receiver.publicKey
            ),
            assetId: String(transferTxn.assetTransfer.assetIndex),
            amountUsdcAtomicUnits: String(transferTxn.assetTransfer.amount),
            txId: transferTxn.txID(),
            groupId: transferGroup,
        },
        {
            index: 1,
            type: 'appl',
            sender: transactionAddress(appCallTxn.sender?.publicKey),
            appId: String(appCallTxn.applicationCall.appIndex),
            action,
            poolKey,
            txId: appCallTxn.txID(),
            groupId: appCallGroup,
        },
    ];
}

const formatAtomicUsdc = (atomicUnits) => {
    try {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
        }).format(Number(atomicUnits || 0) / 1_000_000);
    } catch {
        return '0.00';
    }
};

const formatUsdcLabel = (atomicUnits) => `$${formatAtomicUsdc(atomicUnits)} USDC`;

const shortenAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export default function PoolAdminPage() {
    const { accountAddress, isConnected, connect, signTransactionGroup } = useWallet();
    const { getAuthHeader } = useAuth();

    const [poolInfo, setPoolInfo] = useState(null);
    const [userInfo, setUserInfo] = useState({ algo: 0, usdc: 0 });
    const [ips, setIps] = useState([]);
    const [selectedIpId, setSelectedIpId] = useState('');
    const [settlementBatches, setSettlementBatches] = useState([]);
    const [selectedSettlementBatchId, setSelectedSettlementBatchId] =
        useState('');
    const [isLoadingSettlementBatches, setIsLoadingSettlementBatches] =
        useState(false);
    const [settlementBatchesError, setSettlementBatchesError] =
        useState(null);
    const [eligibleLedgerRows, setEligibleLedgerRows] = useState([]);
    const [isLoadingEligibleLedgerRows, setIsLoadingEligibleLedgerRows] =
        useState(false);
    const [eligibleLedgerRowsError, setEligibleLedgerRowsError] =
        useState(null);

    const [selectedEligibleLedgerRowId, setSelectedEligibleLedgerRowId] =
        useState('');

    // Global Queues & Search States
    const [globalEligibleRows, setGlobalEligibleRows] = useState([]);
    const [isLoadingGlobalEligible, setIsLoadingGlobalEligible] = useState(false);
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [ipSearchQuery, setIpSearchQuery] = useState('');

    const [isCreateBatchDialogOpen, setIsCreateBatchDialogOpen] =
        useState(false);
    const [isCreatingSettlementBatch, setIsCreatingSettlementBatch] =
        useState(false);
    
    const [
        isSubmittingPreparedUsdcDeposit,
        setIsSubmittingPreparedUsdcDeposit,
    ] = useState(false);

    const [
        isUsdcDepositSubmissionDialogOpen,
        setIsUsdcDepositSubmissionDialogOpen,
    ] = useState(false);

    const [
        isPayoutRoundSubmissionDialogOpen,
        setIsPayoutRoundSubmissionDialogOpen,
    ] = useState(false);

    const [
        isSubmittingPayoutRound,
        setIsSubmittingPayoutRound,
    ] = useState(false);

    const [
        isResettingPreparedUsdcDeposit,
        setIsResettingPreparedUsdcDeposit,
    ] = useState(false);

    const [
        isResetPreparedUsdcDepositDialogOpen,
        setIsResetPreparedUsdcDepositDialogOpen,
    ] = useState(false);
    const [
    isPreparingUnallocatedDeposit,
    setIsPreparingUnallocatedDeposit,
] = useState(false);

    const [isPreparingRecipientSnapshot, setIsPreparingRecipientSnapshot] =
        useState(false);
    const [isConfirmingDeposit, setIsConfirmingDeposit] = useState(false);
    const [isMaterializingDeposit, setIsMaterializingDeposit] = useState(false);
    const [isCreatingPayoutRound, setIsCreatingPayoutRound] = useState(false);
    const [isPreparingDistribution, setIsPreparingDistribution] = useState(false);
    const [preparedDistribution, setPreparedDistribution] = useState(null);
    const [isOptingIn, setIsOptingIn] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [secret, setSecret] = useState('');

    const appId = process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID;
    const selectedSettlementBatch = settlementBatches.find(
        (batch) => batch.batchId === selectedSettlementBatchId
    ) || null;
    const selectedEligibleLedgerRow =
        eligibleLedgerRows.find(
            (row) => row.ledgerRowId === selectedEligibleLedgerRowId
        ) || null;
    
    const getSafeAppAddress = (id) => {
        if (!id) return '';

        try {
            const addr = algosdk.getApplicationAddress(parseInt(id, 10));

            if (typeof addr === 'object' && addr.publicKey) {
                return algosdk.encodeAddress(addr.publicKey);
            }

            return String(addr);
        } catch (error) {
            return '';
        }
    };

    const appAddress = getSafeAppAddress(appId);

    const findAsset = (assets, targetId) => {
        if (!assets) return null;

        return assets.find((asset) => {
            const id =
                asset['asset-id'] ||
                asset.assetId ||
                asset.index ||
                asset.id;

            return Number(id) === targetId;
        });
    };

    const isPreparedUnallocatedUsdcDeposit = (depositAttempt) =>
        depositAttempt?.operation === 'v10_usdc_deposit';

    // Automatically scan and aggregate release-eligible rows across all IP assets globally
    const loadAllGlobalEligibleRows = async (ipList) => {
        setIsLoadingGlobalEligible(true);
        try {
            const combinedRows = [];
            for (const ip of ipList) {
                const poolKey = resolvePoolIpId(ip);
                if (!poolKey) continue;

                const response = await fetch(
                    `/api/admin/revenue-settlement/eligible?poolKey=${encodeURIComponent(poolKey)}`,
                    {
                        headers: getAuthHeader(),
                        cache: 'no-store',
                    }
                );
                const data = await response.json();
                if (response.ok && data.success && Array.isArray(data.rows)) {
                    for (const row of data.rows) {
                        combinedRows.push({
                            ...row,
                            poolKey,
                            ipName: ip.name || 'Unknown IP Asset'
                        });
                    }
                }
            }
            setGlobalEligibleRows(combinedRows);
        } catch (error) {
            console.error('Failed to load global eligible revenue rows:', error);
        } finally {
            setIsLoadingGlobalEligible(false);
        }
    };

    const fetchData = useCallback(async () => {
        if (!appId || !appAddress) return;

        const revenuePoolAppId = Number(appId);

        if (!Number.isSafeInteger(revenuePoolAppId) || revenuePoolAppId < 1) {
            console.error(
                'NEXT_PUBLIC_REVENUE_POOL_APP_ID must be a positive safe integer.'
            );
            return;
        }

        setIsRefreshing(true);

        try {
            const algod = PUBLIC_ALGOD_CLIENT;

            const poolAcct = await algod.accountInformation(appAddress).do();
            const poolUsdc = findAsset(poolAcct.assets, USDC_ASSET_ID);

            setPoolInfo({
                algoBalance: Number(poolAcct.amount) / 1_000_000,
                usdcBalance: poolUsdc
                    ? Number(poolUsdc.amount) / 1_000_000
                    : 0,
                isOptedIn: Boolean(poolUsdc),
            });

            if (accountAddress) {
                const userAcct = await algod
                    .accountInformation(accountAddress)
                    .do();

                const userUsdc = findAsset(userAcct.assets, USDC_ASSET_ID);

                setUserInfo({
                    algo: Number(userAcct.amount) / 1_000_000,
                    usdc: userUsdc
                        ? Number(userUsdc.amount) / 1_000_000
                        : 0,
                });
            } else {
                setUserInfo({ algo: 0, usdc: 0 });
            }

            const ipRes = await fetch('/api/admin/revenue-pool/ip-assets', {
                headers: getAuthHeader(),
                cache: 'no-store',
            });

            const ipData = await ipRes.json();

            if (!ipRes.ok) {
                throw new Error(
                    ipData.error ||
                        'Unable to load IP assets for pool administration.'
                );
            }

            const loadedIps = ipData.ipAssets || [];
            setIps(loadedIps);

            // Trigger global aggregation immediately upon loading IP assets
            if (loadedIps.length > 0) {
                loadAllGlobalEligibleRows(loadedIps);
            }
        } catch (error) {
            console.error('Admin Pool refresh failed:', error);

            toast.error(
                error?.message || 'Unable to refresh Admin Pool data.'
            );
        } finally {
            setIsRefreshing(false);
        }
    }, [
        appAddress,
        appId,
        accountAddress,
        getAuthHeader,
    ]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const loadEligibleLedgerRows = async (poolKey) => {
        if (!poolKey) {
            setEligibleLedgerRows([]);
            setSelectedEligibleLedgerRowId('');
            setEligibleLedgerRowsError(null);
            return;
        }

        setIsLoadingEligibleLedgerRows(true);
        setEligibleLedgerRowsError(null);

        try {
            const response = await fetch(
                `/api/admin/revenue-settlement/eligible?poolKey=${encodeURIComponent(
                    poolKey
                )}`,
                {
                    headers: getAuthHeader(),
                    cache: 'no-store',
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || 'Unable to load eligible revenue rows.'
                );
            }

            const rows = Array.isArray(data.rows) ? data.rows : [];

            setEligibleLedgerRows(rows);

            setSelectedEligibleLedgerRowId((previousLedgerRowId) =>
                rows.some(
                    (row) => row.ledgerRowId === previousLedgerRowId
                )
                    ? previousLedgerRowId
                    : ''
            );
        } catch (error) {
            console.error('Eligible ledger row load error:', error);

            setEligibleLedgerRows([]);
            setSelectedEligibleLedgerRowId('');

            setEligibleLedgerRowsError(
                error.message || 'Unable to load eligible revenue rows.'
            );
        } finally {
            setIsLoadingEligibleLedgerRows(false);
        }
    };

    const loadSettlementBatches = async (poolKey) => {
        if (!poolKey) {
            setSettlementBatches([]);
            setSelectedSettlementBatchId('');
            setSettlementBatchesError(null);
            return;
        }

        setIsLoadingSettlementBatches(true);
        setSettlementBatchesError(null);

        try {
            const response = await fetch(
                `/api/admin/revenue-settlement/batches?poolKey=${encodeURIComponent(
                    poolKey
                )}`,
                {
                    headers: getAuthHeader(),
                    cache: 'no-store',
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || 'Unable to load settlement batches.'
                );
            }

            const batches = data.batches || [];

            setSettlementBatches(batches);
            setSelectedSettlementBatchId((previousBatchId) =>
                batches.some((batch) => batch.batchId === previousBatchId)
                    ? previousBatchId
                    : ''
            );
        } catch (error) {
            console.error('Settlement batch load error:', error);
            setSettlementBatches([]);
            setSelectedSettlementBatchId('');
            setSettlementBatchesError(
                error.message || 'Unable to load settlement batches.'
            );
        } finally {
            setIsLoadingSettlementBatches(false);
        }
    };

    const handleCreateSettlementBatch = async () => {
        if (!selectedEligibleLedgerRow) {
            return toast.error(
                'Select one eligible revenue row before creating a settlement batch.'
            );
        }

        setIsCreatingSettlementBatch(true);

        try {
            const response = await fetch(
                '/api/admin/revenue-settlement/batches',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeader(),
                    },
                    body: JSON.stringify({
                        orderId: selectedEligibleLedgerRow.orderId,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || 'Unable to create settlement batch.'
                );
            }

            toast.success(
                `Settlement batch created for ${data.batch.rowCount} ledger row(s).`
            );

            setIsCreateBatchDialogOpen(false);
            setSelectedEligibleLedgerRowId('');

            await Promise.all([
                loadEligibleLedgerRows(selectedIpId),
                loadSettlementBatches(selectedIpId),
                loadAllGlobalEligibleRows(ips)
            ]);

            setSelectedSettlementBatchId(data.batch.batchId);
        } catch (error) {
            console.error('Settlement batch creation failed:', error);

            toast.error(
                error.message || 'Unable to create settlement batch.'
            );
        } finally {
            setIsCreatingSettlementBatch(false);
        }
    };

    const handleOptIn = async () => {
        if (!secret) {
            return toast.error('Enter Admin Secret');
        }

        setIsOptingIn(true);

        try {
            const res = await fetch('/api/admin/pool/optin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error);
            }

            toast.success('Pool Opted-In successfully!');
            fetchData();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsOptingIn(false);
        }
    };

    const handlePrepareRecipientSnapshot = async () => {
        if (!selectedSettlementBatch) {
            return toast.error(
                'Select a settlement batch before preparing its recipient snapshot.'
            );
        }

        if (selectedSettlementBatch.status !== 'created') {
            return toast.error(
                'Recipient snapshots can only be prepared for batches with status "created".'
            );
        }

        setIsPreparingRecipientSnapshot(true);

        try {
            const response = await fetch('/api/admin/revenue-settlement', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({
                    action: 'prepare_recipient_snapshot',
                    batchId: selectedSettlementBatch.batchId,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || 'Unable to prepare the recipient snapshot.'
                );
            }

            toast.success('Recipient snapshot prepared.');

            await loadSettlementBatches(selectedIpId);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsPreparingRecipientSnapshot(false);
        }
    };

    const handleConfirmDeposit = async () => {
        if (!selectedSettlementBatch) {
            return toast.error('Select a settlement batch before confirming its unallocated usdc.');
        }

        if (selectedSettlementBatch.status !== 'deposit_submitted') {
            return toast.error('The unallocated USDC deposit can only be confirmed for batches with status "deposit_submitted".');
        }

        setIsConfirmingDeposit(true);

        try {
            const response = await fetch('/api/admin/revenue-settlement', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({
                    action: 'confirm_deposit',
                    batchId: selectedSettlementBatch.batchId,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Unable to confirm the unallocated USDC deposit.');
            }

            toast.success('Unallocated USDC deposit confirmed.');
            await loadSettlementBatches(selectedIpId);
        } catch (error) {
            console.error('V10 deposit confirmation failed', error);
            toast.error(
                error.message || 'Unable to confirm the unallocated USDC deposit.'
            );
            } finally {
            setIsConfirmingDeposit(false);
        }
    };

    const handleMaterializeDeposit = async () => {
        if (!selectedSettlementBatch) {
            return toast.error('Select a settlement batch before materializing its deposit.');
        }

        if (selectedSettlementBatch.status !== 'deposit_confirmed_pending_ledger') {
            return toast.error('Materialization only applies to batches with status "deposit_confirmed_pending_ledger".');
        }

        setIsMaterializingDeposit(true);

        try {
            const response = await fetch('/api/admin/revenue-settlement', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({
                    action: 'materialize_deposit',
                    batchId: selectedSettlementBatch.batchId,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Unable to materialize the confirmed deposit.');
            }

            toast.success('Confirmed deposit materialized to the ledger.');
            await loadSettlementBatches(selectedIpId);
        } catch (error) {
            console.error('V10 deposit materialization failed', error);
            toast.error(error.message || 'Unable to materialize the confirmed deposit.');
        } finally {
            setIsMaterializingDeposit(false);
        }
    };

    const handleCreatePayoutRound = async () => {
        if (!selectedSettlementBatch) {
            return toast.error('Select a deposited settlement batch before creating its payout round.');
        }

        if (selectedSettlementBatch.status !== 'deposited') {
            return toast.error('Payout rounds can only be created for batches with status "deposited".');
        }

        setIsCreatingPayoutRound(true);

        try {
            const response = await fetch('/api/admin/revenue-settlement', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({
                    action: 'create_payout_round',
                    batchId: selectedSettlementBatch.batchId,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Unable to create the payout round.');
            }

            toast.success('Payout round created.');
            setPreparedDistribution(null);
            await loadSettlementBatches(selectedIpId);
        } catch (error) {
            console.error('V10 payout-round creation failed', error);
            toast.error(error.message || 'Unable to create the payout round.');
        } finally {
            setIsCreatingPayoutRound(false);
        }
    };

    const handleReleaseUsdcForClaim = async () => {
        if (!isConnected || !accountAddress) {
            return toast.error(
                'Connect the administrator wallet before releasing USDC for claim.'
            );
        }

        if (!selectedSettlementBatch) {
            return toast.error(
                'Select a payout round before releasing USDC for claim.'
            );
        }

        if (
            selectedSettlementBatch.status !== 'round_created' &&
            selectedSettlementBatch.status !== 'payout_prepared'
        ) {
            return toast.error(
                'USDC can only be released from a created or prepared payout round.'
            );
        }

        setIsSubmittingPayoutRound(true);

        try {
            let payoutSubmissionAttempt =
                selectedSettlementBatch.payoutSubmissionAttempt;

            if (
                selectedSettlementBatch.status === 'round_created' ||
                !payoutSubmissionAttempt ||
                payoutSubmissionAttempt.status !== 'prepared' ||
                !Array.isArray(
                    payoutSubmissionAttempt.unsignedTransactionsBase64
                )
            ) {
                const prepareResponse = await fetch(
                    '/api/admin/revenue-settlement',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...getAuthHeader(),
                        },
                        body: JSON.stringify({
                            action: 'prepare_payout_round_submission',
                            batchId: selectedSettlementBatch.batchId,
                            depositorAddress: accountAddress,
                        }),
                    }
                );

                const prepareData = await prepareResponse.json();

                if (!prepareResponse.ok || !prepareData.success) {
                    throw new Error(
                        prepareData.error ||
                            'Unable to prepare the payout-round release.'
                    );
                }

                payoutSubmissionAttempt =
                    prepareData.payoutSubmissionAttempt;
            }

            if (
                !payoutSubmissionAttempt ||
                payoutSubmissionAttempt.status !== 'prepared' ||
                !Array.isArray(
                    payoutSubmissionAttempt.unsignedTransactionsBase64
                ) ||
                payoutSubmissionAttempt.unsignedTransactionsBase64.length !==
                    2 ||
                !payoutSubmissionAttempt.groupId ||
                !payoutSubmissionAttempt.transactionIds?.appCall
            ) {
                throw new Error(
                    'Prepared payout-round metadata is incomplete or inconsistent.'
                );
            }

            setIsPayoutRoundSubmissionDialogOpen(true);

            await loadSettlementBatches(selectedIpId);
        } catch (error) {
            console.error(
                'V10 payout-round release preparation failed:',
                error
            );

            toast.error(
                error?.message ||
                    'Unable to prepare USDC release for claim.'
            );
        } finally {
            setIsSubmittingPayoutRound(false);
        }
    };

    const handleSignAndSubmitPayoutRound = async () => {
        if (!isConnected || !accountAddress || !selectedSettlementBatch) {
            return toast.error(
                'Connect the administrator wallet and select a payout round.'
            );
        }

        const payoutSubmissionAttempt =
            selectedSettlementBatch.payoutSubmissionAttempt;

        if (
            selectedSettlementBatch.status !== 'payout_prepared' ||
            !payoutSubmissionAttempt ||
            payoutSubmissionAttempt.status !== 'prepared' ||
            !Array.isArray(
                payoutSubmissionAttempt.unsignedTransactionsBase64
            ) ||
            payoutSubmissionAttempt.unsignedTransactionsBase64.length !== 2 ||
            !payoutSubmissionAttempt.groupId ||
            !payoutSubmissionAttempt.transactionIds?.appCall
        ) {
            return toast.error(
                'Refresh the settlement batch before signing the payout release.'
            );
        }

        setIsSubmittingPayoutRound(true);

        try {
            const signedTransactions = await signTransactionGroup(
                payoutSubmissionAttempt.unsignedTransactionsBase64.map(
                    (encodedTransaction) =>
                        new Uint8Array(
                            Buffer.from(encodedTransaction, 'base64')
                        )
                )
            );

            if (!signedTransactions || signedTransactions.length !== 2) {
                throw new Error(
                    'Payout-round signing was cancelled or incomplete.'
                );
            }

            const algod = PUBLIC_ALGOD_CLIENT;

            await algod.sendRawTransaction(signedTransactions).do();

            const submittedResponse = await fetch(
                '/api/admin/revenue-settlement',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeader(),
                    },
                    body: JSON.stringify({
                        action: 'mark_payout_round_submitted',
                        batchId: selectedSettlementBatch.batchId,
                    }),
                }
            );

            const submittedData = await submittedResponse.json();

            if (!submittedResponse.ok || !submittedData.success) {
                throw new Error(
                    submittedData.error ||
                        'The payout group broadcast, but submitted state could not be recorded.'
                );
            }

            setIsPayoutRoundSubmissionDialogOpen(false);

            toast.success(
                'USDC release submitted. Recipients can claim after the payout round confirms.'
            );

            await loadSettlementBatches(selectedIpId);
            await fetchData();
        } catch (error) {
            console.error(
                'Prepared V10 payout-round submission failed:',
                error
            );

            toast.error(
                error?.message ||
                    'Unable to submit the USDC release for claim.'
            );
        } finally {
            setIsSubmittingPayoutRound(false);
        }
    };

    const handlePrepareDistribution = async () => {
        if (!selectedSettlementBatch) {
            return toast.error('Select a settlement batch before previewing its distribution.');
        }

        if (selectedSettlementBatch.status !== 'round_created') {
            return toast.error('Distribution can only be previewed for batches with status "round_created".');
        }

        setIsPreparingDistribution(true);

        try {
            const response = await fetch('/api/admin/revenue-settlement', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({
                    action: 'prepare_distribution',
                    batchId: selectedSettlementBatch.batchId,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Unable to prepare a distribution preview.');
            }

            setPreparedDistribution(data.distribution || null);
            toast.success('Distribution preview prepared. Nothing was persisted or broadcast.');
        } catch (error) {
            console.error('V10 distribution preview failed', error);
            toast.error(error.message || 'Unable to prepare a distribution preview.');
        } finally {
            setIsPreparingDistribution(false);
        }
    };

    const handlePrepareUnallocatedUsdcDeposit = async () => {
        if (!isConnected || !accountAddress) {
            return toast.error(
                'Connect the authorized pool-proxy or administrator wallet before preparing an unallocated USDC deposit.'
            );
        }

        if (!selectedSettlementBatch) {
            return toast.error(
                'Select a frozen settlement batch before preparing an unallocated USDC deposit.'
            );
        }

        if (
            selectedSettlementBatch.status !==
            'recipient_snapshot_prepared'
        ) {
            return toast.error(
                'Unallocated USDC deposits can only be prepared for batches with status "recipient_snapshot_prepared".'
            );
        }

        setIsPreparingUnallocatedDeposit(true);

        try {
            const response = await fetch(
                '/api/admin/revenue-settlement',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeader(),
                    },
                    body: JSON.stringify({
                        action: 'prepare_unallocated_usdc_deposit',
                        batchId: selectedSettlementBatch.batchId,
                        depositorAddress: accountAddress,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error ||
                        'Unable to prepare the unallocated USDC deposit.'
                );
            }

            const depositAttempt = data.depositAttempt;

            if (
                !depositAttempt ||
                depositAttempt.status !== 'prepared' ||
                !Array.isArray(
                    depositAttempt.unsignedTransactionsBase64
                ) ||
                depositAttempt.unsignedTransactionsBase64.length !== 2 ||
                depositAttempt.usdcTransferTransactionIndex !== 0 ||
                depositAttempt.appCallTransactionIndex !== 1 ||
                !depositAttempt.transactionIds?.appCall ||
                !depositAttempt.transactionIds?.usdcTransfer
            ) {
                throw new Error(
                    'Prepared unallocated-USDC deposit metadata is incomplete or inconsistent.'
                );
            }

            toast.success(
                'Unallocated USDC deposit proposal prepared. Review the unsigned two-transaction group before signing or submitting it.'
            );

            await loadSettlementBatches(selectedIpId);
            await fetchData();
        } catch (error) {
            console.error(
                'V10 unallocated USDC deposit preparation failed:',
                error
            );

            toast.error(
                error?.message ||
                    'Unable to prepare the unallocated USDC deposit.'
            );
        } finally {
            setIsPreparingUnallocatedDeposit(false);
        }
    };

    const handleSignAndSubmitPreparedUsdcDeposit = async () => {
        console.log('[V10 USDC] submit clicked', {
            batchId: selectedSettlementBatch?.batchId,
            status: selectedSettlementBatch?.status,
            accountAddress,
        });

        console.log('[V10 USDC] connection state', {
            isConnected,
            accountAddress,
        });

        console.log('[V10 USDC] batch state', {
            batchId: selectedSettlementBatch?.batchId,
            status: selectedSettlementBatch?.status,
            depositAttempt: selectedSettlementBatch?.depositAttempt,
            isPreparedUnallocatedUsdcDeposit:
                isPreparedUnallocatedUsdcDeposit(
                    selectedSettlementBatch?.depositAttempt
                ),
        });

        toast.info('V10 USDC deposit submission handler started.');

        if (!isConnected || !accountAddress) {
            return toast.error(
                'Connect the authorized administrator or pool-proxy wallet before submitting the prepared USDC deposit.'
            );
        }

        if (!selectedSettlementBatch) {
            return toast.error(
                'Select a prepared settlement batch before submitting its USDC deposit.'
            );
        }

        if (selectedSettlementBatch.status !== 'deposit_prepared') {
            return toast.error(
                'Only a batch with status "deposit_prepared" can be submitted.'
            );
        }

        const depositAttempt = selectedSettlementBatch.depositAttempt;
        const hasPreparedUnallocatedUsdcDeposit =
            isPreparedUnallocatedUsdcDeposit(depositAttempt);

        console.log('[V10 USDC] deposit attempt validation fields', {
            attemptStatus: depositAttempt?.status,
            hasPreparedUnallocatedUsdcDeposit,
            hasUnsignedTransactions: Array.isArray(
                depositAttempt?.unsignedTransactionsBase64
            ),
            unsignedTransactionCount:
                depositAttempt?.unsignedTransactionsBase64?.length,
            usdcTransferTransactionIndex:
                depositAttempt?.usdcTransferTransactionIndex,
            appCallTransactionIndex:
                depositAttempt?.appCallTransactionIndex,
            hasGroupId: Boolean(depositAttempt?.groupId),
            hasUsdcTransferTransactionId: Boolean(
                depositAttempt?.transactionIds?.usdcTransfer
            ),
            hasAppCallTransactionId: Boolean(
                depositAttempt?.transactionIds?.appCall
            ),
        });

        if (
            !depositAttempt ||
            depositAttempt.status !== 'prepared' ||
            !hasPreparedUnallocatedUsdcDeposit ||
            !Array.isArray(depositAttempt.unsignedTransactionsBase64) ||
            depositAttempt.unsignedTransactionsBase64.length !== 2 ||
            depositAttempt.usdcTransferTransactionIndex !== 0 ||
            depositAttempt.appCallTransactionIndex !== 1 ||
            !depositAttempt.groupId ||
            !depositAttempt.transactionIds?.usdcTransfer ||
            !depositAttempt.transactionIds?.appCall
        ) {
            console.error('[V10 USDC] local deposit proposal validation failed', {
                batchId: selectedSettlementBatch?.batchId,
                attemptStatus: depositAttempt?.status,
                operation: depositAttempt?.operation,
                groupId: depositAttempt?.groupId,
                usdcTransferTransactionIndex:
                    depositAttempt?.usdcTransferTransactionIndex,
                appCallTransactionIndex:
                    depositAttempt?.appCallTransactionIndex,
                transactionIds: depositAttempt?.transactionIds,
            });

            alert(
                'Blocked before wallet signing. Open DevTools Console and copy the [V10 USDC] deposit attempt validation fields object.'
            );
            toast.error('Local deposit proposal validation failed. Prepared metadata is incomplete.');
            return;
        }

        let reviewedDepositTransactions;

        try {
            reviewedDepositTransactions =
                validatePreparedUnallocatedUsdcDeposit({
                    depositAttempt,
                    batch: selectedSettlementBatch,
                    appId: REVENUE_POOL_APP_ID,
                    usdcAssetId: USDC_ASSET_ID,
                    appAddress: revenuePoolAppAddress,
                    depositorAddress: accountAddress,
                });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            console.error(
                `[V10 USDC] blocked before signing: decoded group mismatch: ${message}`
            );

            return toast.error(
                message || 'Prepared USDC deposit failed pre-sign transaction validation.'
            );
        }

        setIsSubmittingPreparedUsdcDeposit(true);

        try {
            console.log(
                '[V10 USDC] local validation passed; calling signTransactionGroup',
                {
                    groupId: depositAttempt.groupId,
                    transactionCount:
                        depositAttempt.unsignedTransactionsBase64.length,
                    amountUsdcAtomicUnits:
                        depositAttempt.amountUsdcAtomicUnits,
                }
            );

            const signedTransactions = await signTransactionGroup(
                depositAttempt.unsignedTransactionsBase64.map(
                    (encodedTransaction) =>
                        new Uint8Array(
                            Buffer.from(encodedTransaction, 'base64')
                        )
                )
            );

            if (!signedTransactions || signedTransactions.length !== 2) {
                throw new Error(
                    'USDC deposit signing was cancelled or incomplete.'
                );
            }

            const algod = PUBLIC_ALGOD_CLIENT;

            await algod.sendRawTransaction(signedTransactions).do();

            const submittedResponse = await fetch(
                '/api/admin/revenue-settlement',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeader(),
                    },
                    body: JSON.stringify({
                        action: 'mark_submitted',
                        batchId: selectedSettlementBatch.batchId,
                    }),
                }
            );

            const submittedData = await submittedResponse.json();

            if (!submittedResponse.ok || !submittedData.success) {
                throw new Error(
                    submittedData.error ||
                        'The USDC group broadcast, but submitted state could not be recorded. Do not prepare a new deposit; recover using the existing app-call transaction ID.'
                );
            }

            setIsUsdcDepositSubmissionDialogOpen(false);

            toast.success(
                'Prepared USDC deposit submitted. Wait for confirmation before materializing it.'
            );

            await loadSettlementBatches(selectedIpId);
            await fetchData();
        } catch (error) {
            console.error('Prepared V10 USDC deposit submission failed:', error);

            toast.error(
                error?.message ||
                    'Unable to submit the prepared USDC deposit.'
            );
        } finally {
            setIsSubmittingPreparedUsdcDeposit(false);
        }
    };

    const handleResetExpiredPreparedUsdcDeposit = async () => {
        if (!selectedSettlementBatch) {
            return toast.error(
                'Select a prepared settlement batch before rebuilding its USDC proposal.'
            );
        }

        if (selectedSettlementBatch.status !== 'deposit_prepared') {
            return toast.error(
                'Only a prepared deposit can be rebuilt with fresh network parameters.'
            );
        }

        const depositAttempt = selectedSettlementBatch.depositAttempt;

        if (
            !depositAttempt ||
            depositAttempt.status !== 'prepared' ||
            !depositAttempt.groupId ||
            !depositAttempt.unsignedTransactionHash
        ) {
            return toast.error(
                'The prepared deposit metadata is incomplete. Refresh before retrying.'
            );
        }

        setIsResettingPreparedUsdcDeposit(true);

        try {
            const response = await fetch(
                '/api/admin/revenue-settlement',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeader(),
                    },
                    body: JSON.stringify({
                        action: 'reset_expired_deposit_preparation',
                        batchId: selectedSettlementBatch.batchId,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error ||
                        'Unable to clear the expired prepared USDC deposit.'
                );
            }

            setIsResetPreparedUsdcDepositDialogOpen(false);
            setIsUsdcDepositSubmissionDialogOpen(false);

            toast.success(
                'Expired USDC proposal cleared. Prepare a fresh USDC proposal and sign it promptly.'
            );

            await loadSettlementBatches(selectedIpId);
            await fetchData();
        } catch (error) {
            console.error(
                'Expired prepared V10 USDC deposit reset failed:',
                error
            );

            toast.error(
                error?.message ||
                    'Unable to clear the expired prepared USDC deposit.'
            );
        } finally {
            setIsResettingPreparedUsdcDeposit(false);
        }
    };

    const getNextSettlementAction = () => {
        if (!selectedSettlementBatch) {
            return null;
        }

        const amount = formatUsdcLabel(selectedSettlementBatch.totalUsdcAtomicUnits);
        const status = selectedSettlementBatch.status;

        switch (status) {
            case 'created':
                return {
                    title: 'Freeze recipient snapshot',
                    description: `Capture the current REV-holder balances for this ${amount} settlement. This does not move funds.`,
                    label: 'Freeze recipient snapshot',
                    onClick: handlePrepareRecipientSnapshot,
                    disabled: isPreparingRecipientSnapshot,
                    loading: isPreparingRecipientSnapshot,
                    variant: 'default',
                    actionType: 'database',
                };
            case 'recipient_snapshot_prepared':
                return {
                    title: 'Prepare USDC pool funding',
                    description: `Build a wallet-reviewable transaction group to fund the pool with ${amount}. No funds move until you sign and broadcast it.`,
                    label: 'Prepare USDC pool funding',
                    onClick: handlePrepareUnallocatedUsdcDeposit,
                    disabled: isPreparingUnallocatedDeposit || !isConnected || !poolInfo?.isOptedIn,
                    loading: isPreparingUnallocatedDeposit,
                    variant: 'default',
                    actionType: 'preparation',
                };
            case 'deposit_prepared':
                return {
                    title: 'Review and sign pool funding',
                    description: `Your wallet will sign and broadcast a ${amount} deposit to the revenue-pool contract.`,
                    label: 'Review and sign pool funding',
                    onClick: () => setIsUsdcDepositSubmissionDialogOpen(true),
                    disabled: isSubmittingPreparedUsdcDeposit || !isConnected,
                    loading: isSubmittingPreparedUsdcDeposit,
                    variant: 'destructive',
                    actionType: 'blockchain',
                };
            case 'deposit_submitted':
                return {
                    title: 'Verify on-chain deposit',
                    description: 'Check that the submitted USDC transaction has confirmed on Algorand before continuing.',
                    label: 'Verify on-chain deposit',
                    onClick: handleConfirmDeposit,
                    disabled: isConfirmingDeposit,
                    loading: isConfirmingDeposit,
                    variant: 'default',
                    actionType: 'verification',
                };
            case 'deposit_confirmed_pending_ledger':
                return {
                    title: 'Record confirmed deposit',
                    description: 'Record the verified on-chain deposit in the settlement ledger. This does not move additional funds.',
                    label: 'Record confirmed deposit',
                    onClick: handleMaterializeDeposit,
                    disabled: isMaterializingDeposit,
                    loading: isMaterializingDeposit,
                    variant: 'default',
                    actionType: 'database',
                };
            case 'deposited':
                return {
                    title: 'Create claim round',
                    description: 'Create the payout round from the frozen recipients and confirmed deposit.',
                    label: 'Create claim round',
                    onClick: handleCreatePayoutRound,
                    disabled: isCreatingPayoutRound,
                    loading: isCreatingPayoutRound,
                    variant: 'default',
                    actionType: 'database',
                };
            case 'round_created':
            case 'payout_prepared':
                return {
                    title: 'Release claims',
                    description: `Broadcast the ${amount} payout round. Eligible recipients will then be able to claim their allocation.`,
                    label: 'Review and release claims',
                    onClick: handleReleaseUsdcForClaim,
                    disabled: isSubmittingPayoutRound || !isConnected,
                    loading: isSubmittingPayoutRound,
                    variant: 'destructive',
                    actionType: 'blockchain',
                };
            case 'payout_submitted':
                return {
                    title: 'Claims are available',
                    description: 'The payout round has been submitted. Monitor confirmations and recipient claims.',
                    label: 'Payout round submitted',
                    disabled: true,
                    variant: 'outline',
                    actionType: 'complete',
                };
            default:
                return {
                    title: 'Settlement needs review',
                    description: `This batch is in the "${status}" state, which is not mapped to an operator action.`,
                    label: 'Refresh status',
                    onClick: fetchData,
                    disabled: isRefreshing,
                    loading: isRefreshing,
                    variant: 'outline',
                    actionType: 'verification'
                };
        }
    };

    const settlementSteps = [
        { key: 'batch', label: 'Create batch', complete: Boolean(selectedSettlementBatch), active: !selectedSettlementBatch },
        { key: 'snapshot', label: 'Freeze recipients', complete: ['recipient_snapshot_prepared', 'deposit_prepared', 'deposit_submitted', 'deposit_confirmed_pending_ledger', 'deposited', 'round_created', 'payout_prepared', 'payout_submitted'].includes(selectedSettlementBatch?.status), active: selectedSettlementBatch?.status === 'created' },
        { key: 'deposit', label: 'Fund pool', complete: ['deposit_submitted', 'deposit_confirmed_pending_ledger', 'deposited', 'round_created', 'payout_prepared', 'payout_submitted'].includes(selectedSettlementBatch?.status), active: ['recipient_snapshot_prepared', 'deposit_prepared'].includes(selectedSettlementBatch?.status) },
        { key: 'confirm', label: 'Confirm deposit', complete: ['deposited', 'round_created', 'payout_prepared', 'payout_submitted'].includes(selectedSettlementBatch?.status), active: ['deposit_submitted', 'deposit_confirmed_pending_ledger'].includes(selectedSettlementBatch?.status) },
        { key: 'round', label: 'Create round', complete: ['round_created', 'payout_prepared', 'payout_submitted'].includes(selectedSettlementBatch?.status), active: selectedSettlementBatch?.status === 'deposited' },
        { key: 'release', label: 'Release claims', complete: selectedSettlementBatch?.status === 'payout_submitted', active: ['round_created', 'payout_prepared'].includes(selectedSettlementBatch?.status) },
    ];

    if (!appId) {
        return (
            <div className="p-8">
                Error: NEXT_PUBLIC_REVENUE_POOL_APP_ID not set
            </div>
        );
    }

    const nextAction = getNextSettlementAction();

    // Filtered global eligible rows
    const filteredGlobalEligibleRows = globalEligibleRows.filter((row) => {
        const query = globalSearchQuery.toLowerCase();
        const orderId = String(row.orderNumber || row.orderId || '').toLowerCase();
        const ipName = String(row.ipName || '').toLowerCase();
        const rowId = String(row.ledgerRowId || '').toLowerCase();
        return orderId.includes(query) || ipName.includes(query) || rowId.includes(query);
    });

    const filteredIps = ips.filter((ip) => {
        const query = ipSearchQuery.toLowerCase();
        const name = (ip.name || '').toLowerCase();
        const key = resolvePoolIpId(ip).toLowerCase();
        return name.includes(query) || key.includes(query);
    });

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-10 space-y-8">
            
            {/* FULL SCREEN DASHBOARD HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-800 pb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl">
                        <ShieldCheck className="h-8 w-8 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">Revenue Settlement Command Center</h1>
                        <p className="text-sm text-slate-400 mt-1">
                            Enterprise protocol governance and active REV-holder distribution matrix.
                        </p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-lg">
                    <div className="flex items-center gap-3">
                        <Wallet className="h-5 w-5 text-slate-400" />
                        <div className="flex flex-col text-xs">
                            <span className="font-semibold text-slate-400">Operator Wallet</span>
                            {isConnected ? (
                                <span className="font-mono text-emerald-400 font-bold">{shortenAddress(accountAddress)}</span>
                            ) : (
                                <span className="text-amber-400 font-semibold">Disconnected</span>
                            )}
                        </div>
                    </div>
                    <div className="w-px h-8 bg-slate-800 mx-1"></div>
                    {!isConnected ? (
                        <Button size="sm" onClick={connect} className="bg-blue-600 hover:bg-blue-500 text-white font-medium">Connect Wallet</Button>
                    ) : (
                        <Button variant="outline" size="sm" onClick={fetchData} disabled={isRefreshing} className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700">
                            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Sync Node
                        </Button>
                    )}
                </div>
            </div>

            {/* TOP STATS & CONTRACT BAR */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pool Contract Address</span>
                        <span className="text-xs font-mono text-blue-400 bg-blue-950/60 border border-blue-900/50 px-2 py-0.5 rounded">TestNet V10</span>
                    </div>
                    <p className="font-mono text-xs text-slate-300 break-all mt-3 bg-slate-950 p-2.5 rounded border border-slate-800/80">{appAddress}</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-lg">
                    <div className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Coins className="h-4 w-4 text-emerald-400" /> Pool Total Liquidity
                        </span>
                        <p className="text-2xl font-bold font-mono text-emerald-400">${poolInfo?.usdcBalance.toFixed(2) || '0.00'} <span className="text-xs text-slate-500 font-normal">USDC</span></p>
                    </div>
                    <div className="flex flex-col items-end text-xs">
                        <span className="text-slate-400">USDC Opt-In Status</span>
                        {poolInfo?.isOptedIn ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1 mt-1"><CheckCircle2 className="h-3.5 w-3.5" /> Active</span>
                        ) : (
                            <span className="text-rose-400 font-bold mt-1">Inactive</span>
                        )}
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Operator Wallet Assets</span>
                        <span className="text-xs font-mono text-slate-400">{userInfo.algo.toFixed(2)} ALGO</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-medium text-slate-300">Wallet USDC Balance:</span>
                        <span className={`font-mono font-bold ${userInfo.usdc > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {userInfo.usdc.toFixed(2)} USDC
                        </span>
                    </div>
                </div>
            </div>

            {!poolInfo?.isOptedIn && (
                <div className="bg-amber-950/30 border border-amber-900/60 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h3 className="font-bold text-amber-200 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-400" /> Contract Initialization Required
                        </h3>
                        <p className="text-xs text-amber-300/80 max-w-2xl">
                            The revenue pool smart contract must opt-in to the USDC asset before any unallocated deposits can be accepted. Enter the admin secret to execute opt-in.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Input
                            type="password"
                            placeholder="Admin Secret"
                            value={secret}
                            onChange={(event) => setSecret(event.target.value)}
                            className="bg-slate-900 border-slate-700 text-slate-100 max-w-[200px]"
                        />
                        <Button onClick={handleOptIn} disabled={isOptingIn} className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold">
                            {isOptingIn ? <Loader2 className="animate-spin h-4 w-4" /> : 'Opt-In USDC'}
                        </Button>
                    </div>
                </div>
            )}

            {/* FULL SCREEN 3-COLUMN DASHBOARD LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* COLUMN 1: GLOBAL ELIGIBLE REVENUE QUEUE (Width: 4 Cols - FIRST SO YOU NEVER HAVE TO DIG) */}
                <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl flex flex-col h-[700px]">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                <FileCheck className="h-4 w-4" /> Global Eligible Revenue Queue
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">All unbatched, hold-complete revenue ready across pools</p>
                        </div>
                        <span className="text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-900 px-2 py-0.5 rounded-full">
                            {globalEligibleRows.length} Ready
                        </span>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                        <Input
                            type="text"
                            placeholder="Search order ID or IP name..."
                            value={globalSearchQuery}
                            onChange={(e) => setGlobalSearchQuery(e.target.value)}
                            className="pl-9 h-9 text-xs bg-slate-950 border-slate-800 text-slate-200 focus-visible:ring-emerald-500"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                        {isLoadingGlobalEligible ? (
                            <div className="flex flex-col items-center justify-center p-12 text-xs text-slate-400 gap-2">
                                <Loader2 className="h-5 w-5 animate-spin text-emerald-400" /> Scanning all IP pools for eligible revenue...
                            </div>
                        ) : filteredGlobalEligibleRows.length === 0 ? (
                            <div className="p-8 text-center text-xs text-slate-500 italic bg-slate-950 rounded-lg border border-slate-800">
                                No release-eligible revenue currently available across any pools.
                            </div>
                        ) : (
                            filteredGlobalEligibleRows.map((row) => {
                                const isSelected = selectedEligibleLedgerRowId === row.ledgerRowId && selectedIpId === row.poolKey;
                                return (
                                    <div
                                        key={row.ledgerRowId}
                                        onClick={async () => {
                                            // Automatically select the IP pool context and load its batches/rows
                                            setSelectedIpId(row.poolKey);
                                            await Promise.all([
                                                loadSettlementBatches(row.poolKey),
                                                loadEligibleLedgerRows(row.poolKey)
                                            ]);
                                            setSelectedEligibleLedgerRowId(row.ledgerRowId);
                                        }}
                                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                                            isSelected 
                                                ? 'bg-emerald-950/40 border-emerald-500/60 text-white shadow-md ring-1 ring-emerald-500/50' 
                                                : 'bg-slate-950 border-slate-800/80 hover:border-slate-700 text-slate-300'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center font-medium">
                                            <span className="font-semibold text-slate-200">Order #{row.orderNumber || row.orderId}</span>
                                            <span className="font-bold font-mono text-emerald-400">{formatUsdcLabel(row.usdcAtomicUnits)}</span>
                                        </div>
                                        <p className="text-[11px] text-blue-300 font-medium mt-1 truncate">IP: {row.ipName}</p>
                                        <p className="text-[9px] font-mono text-slate-500 mt-0.5 truncate">Row ID: {row.ledgerRowId}</p>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <Button
                        type="button"
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs h-10 shadow-lg"
                        onClick={() => setIsCreateBatchDialogOpen(true)}
                        disabled={!selectedEligibleLedgerRow || isCreatingSettlementBatch}
                    >
                        {isCreatingSettlementBatch ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : 'Create Batch from Selected Row'}
                    </Button>
                </div>

                {/* COLUMN 2: IP ASSETS & ACTIVE BATCHES QUEUE (Width: 3 Cols) */}
                <div className="lg:col-span-3 space-y-4 flex flex-col h-[700px]">
                    
                    {/* IP Explorer */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 flex-1 flex flex-col shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Layers className="h-4 w-4 text-blue-400" /> Tokenized IP Pools
                            </h3>
                            <span className="text-[10px] font-mono text-slate-500">{filteredIps.length}</span>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-500" />
                            <Input
                                type="text"
                                placeholder="Filter IP assets..."
                                value={ipSearchQuery}
                                onChange={(e) => setIpSearchQuery(e.target.value)}
                                className="pl-8 h-8 text-xs bg-slate-950 border-slate-800 text-slate-200"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                            {filteredIps.map((ip) => {
                                const resolvedPoolIpId = resolvePoolIpId(ip);
                                if (!resolvedPoolIpId) return null;
                                const isSelected = selectedIpId === resolvedPoolIpId;
                                return (
                                    <div
                                        key={ip.id}
                                        onClick={() => {
                                            setSelectedIpId(resolvedPoolIpId);
                                            loadSettlementBatches(resolvedPoolIpId);
                                            loadEligibleLedgerRows(resolvedPoolIpId);
                                        }}
                                        className={`p-2.5 rounded-lg cursor-pointer transition-all ${
                                            isSelected 
                                                ? 'bg-blue-600/20 border border-blue-500/50 text-white font-semibold' 
                                                : 'bg-slate-950 border border-transparent hover:bg-slate-800/60 text-slate-400 text-xs'
                                        }`}
                                    >
                                        <p className="text-xs truncate">{ip.name}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Active Batches Queue */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 flex-1 flex flex-col shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">Active Batches</h3>
                            <span className="text-[10px] font-bold bg-blue-950 text-blue-400 px-2 py-0.5 rounded-full">{settlementBatches.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {!selectedIpId ? (
                                <div className="p-6 text-center text-xs text-slate-500 italic">Select an IP pool or global row above.</div>
                            ) : isLoadingSettlementBatches ? (
                                <div className="flex items-center justify-center p-6 text-xs text-slate-400 gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
                            ) : settlementBatches.length === 0 ? (
                                <div className="p-6 text-center text-xs text-slate-500 italic bg-slate-950 rounded border border-slate-800">No active batches for this pool.</div>
                            ) : (
                                settlementBatches.map((batch) => {
                                    const isBatchSelected = selectedSettlementBatchId === batch.batchId;
                                    return (
                                        <div
                                            key={batch.batchId}
                                            onClick={() => setSelectedSettlementBatchId(batch.batchId)}
                                            className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                                                isBatchSelected ? 'bg-blue-600/20 border-blue-500/60 text-white' : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                                            }`}
                                        >
                                            <div className="flex justify-between items-center font-semibold">
                                                <span>{formatUsdcLabel(batch.totalUsdcAtomicUnits)}</span>
                                                <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono">{batch.status}</span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                </div>

                {/* COLUMN 3: WORKFLOW COMMAND & ACTION CENTER (Width: 5 Cols) */}
                <div className="lg:col-span-5 space-y-6">
                    {!selectedSettlementBatch ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center flex flex-col items-center justify-center h-[700px] shadow-xl text-slate-400 space-y-4">
                            <div className="p-4 bg-slate-950 rounded-full border border-slate-800">
                                <FileCheck className="h-10 w-10 text-slate-600" />
                            </div>
                            <div className="space-y-1 max-w-sm">
                                <h3 className="font-bold text-slate-200 text-base">No Settlement Batch Selected</h3>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    Click any item in the <b>Global Eligible Revenue Queue</b> on the left, or select an active batch from the queue to manage its execution pipeline here.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl h-[700px] overflow-y-auto">
                            
                            {/* Workflow Header & Progress */}
                            <div className="space-y-3 border-b border-slate-800 pb-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Settlement Pipeline</span>
                                    <span className="font-mono text-xs text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                        {formatUsdcLabel(selectedSettlementBatch.totalUsdcAtomicUnits)}
                                    </span>
                                </div>
                                <div className="grid grid-cols-6 gap-1.5 pt-2">
                                    {settlementSteps.map((step, index) => (
                                        <div key={step.key} className="flex flex-col items-center text-center group">
                                            <div className={`w-full h-2 rounded-full mb-1 transition-colors ${
                                                step.complete ? 'bg-emerald-500' : step.active ? 'bg-blue-500 animate-pulse' : 'bg-slate-800'
                                            }`} />
                                            <span className={`text-[9px] font-medium truncate w-full ${step.active ? 'text-blue-400 font-bold' : 'text-slate-500'}`}>
                                                {step.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* NEXT ACTION PROMPT CARD */}
                            {nextAction && (
                                <div className="bg-gradient-to-br from-blue-950/40 to-slate-950 border border-blue-500/30 rounded-xl p-5 space-y-4 shadow-lg">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700/50">
                                            {nextAction.actionType === 'blockchain' ? 'Wallet Signature Required' : 
                                             nextAction.actionType === 'database' ? 'Database State Transition' : 
                                             nextAction.actionType === 'verification' ? 'On-Chain Verification' : 'Standard Operation'}
                                        </span>
                                    </div>

                                    <div className="space-y-1.5">
                                        <h3 className="text-lg font-bold text-white">{nextAction.title}</h3>
                                        <p className="text-xs text-slate-300 leading-relaxed">{nextAction.description}</p>
                                    </div>

                                    <Button 
                                        size="lg" 
                                        className={`w-full font-bold shadow-lg ${
                                            nextAction.variant === 'destructive' 
                                                ? 'bg-rose-600 hover:bg-rose-500 text-white' 
                                                : 'bg-blue-600 hover:bg-blue-500 text-white'
                                        }`}
                                        onClick={nextAction.onClick} 
                                        disabled={nextAction.disabled}
                                    >
                                        {nextAction.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {nextAction.label}
                                    </Button>
                                </div>
                            )}

                            {/* TECHNICAL METADATA ACCORDION */}
                            <details className="group border border-slate-800 rounded-xl bg-slate-950 p-4 [&_summary::-webkit-details-marker]:hidden">
                                <summary className="flex items-center justify-between cursor-pointer text-xs font-semibold text-slate-300">
                                    <span className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-slate-500" /> Technical Audit Data & IDs
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-slate-500 group-open:rotate-180 transition-transform" />
                                </summary>
                                <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 space-y-2">
                                    <div className="flex justify-between"><span>Batch ID:</span> <span className="text-slate-200 truncate max-w-[200px]">{selectedSettlementBatch.batchId}</span></div>
                                    <div className="flex justify-between"><span>Status:</span> <span className="text-blue-400">{selectedSettlementBatch.status}</span></div>
                                    <div className="flex justify-between"><span>Atomic Units:</span> <span className="text-slate-200">{selectedSettlementBatch.totalUsdcAtomicUnits}</span></div>
                                    {selectedSettlementBatch.depositAttempt && (
                                        <div className="flex justify-between"><span>Deposit Group ID:</span> <span className="text-slate-200 truncate max-w-[200px]">{selectedSettlementBatch.depositAttempt.groupId}</span></div>
                                    )}
                                </div>
                            </details>

                            {/* ADVANCED RECOVERY ACTIONS */}
                            <div className="border border-rose-950/60 rounded-xl bg-rose-950/10 p-4 space-y-3">
                                <p className="text-xs font-bold text-rose-400">Advanced Recovery & Preview</p>
                                {preparedDistribution && (
                                    <div className="rounded border border-amber-900/50 bg-slate-950 p-3 text-xs space-y-2">
                                        <p className="font-bold text-amber-300">Distribution Preview (Read-Only)</p>
                                        <p className="font-mono text-[10px] text-slate-400">Recipients Count: {preparedDistribution.payoutInstructions?.length ?? 'unknown'}</p>
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs"
                                        onClick={handlePrepareDistribution}
                                        disabled={isPreparingDistribution || selectedSettlementBatch.status !== 'round_created'}
                                    >
                                        {isPreparingDistribution ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : 'Preview Allocations'}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="border-rose-900/60 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 text-xs"
                                        onClick={() => setIsResetPreparedUsdcDepositDialogOpen(true)}
                                        disabled={isResettingPreparedUsdcDeposit || selectedSettlementBatch.status !== 'deposit_prepared'}
                                    >
                                        Replace Expired Signing Request
                                    </Button>
                                </div>
                            </div>

                        </div>
                    )}
                </div>

            </div>

            {/* MODALS */}
            <Dialog open={isCreateBatchDialogOpen} onOpenChange={(open) => { if (!isCreatingSettlementBatch) setIsCreateBatchDialogOpen(open); }}>
                <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100">
                    <DialogHeader>
                        <DialogTitle>Create Settlement Batch?</DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            This creates a database settlement batch and locks the selected revenue ledger row. It does not transfer USDC or submit any blockchain transaction.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedEligibleLedgerRow && (
                        <div className="space-y-2 rounded border border-slate-800 bg-slate-950 p-3 text-xs font-mono text-slate-300">
                            <p>Order: {selectedEligibleLedgerRow.orderNumber || selectedEligibleLedgerRow.orderId}</p>
                            <p>Row ID: {selectedEligibleLedgerRow.ledgerRowId}</p>
                            <p className="text-emerald-400 font-bold mt-2 pt-2 border-t border-slate-800">{formatUsdcLabel(selectedEligibleLedgerRow.usdcAtomicUnits)}</p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsCreateBatchDialogOpen(false)} disabled={isCreatingSettlementBatch} className="border-slate-700 bg-slate-800 text-slate-200">Cancel</Button>
                        <Button type="button" onClick={handleCreateSettlementBatch} disabled={!selectedEligibleLedgerRow || isCreatingSettlementBatch} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                            {isCreatingSettlementBatch ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Confirm Batch Creation'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isUsdcDepositSubmissionDialogOpen} onOpenChange={(open) => { if (!isSubmittingPreparedUsdcDeposit) setIsUsdcDepositSubmissionDialogOpen(open); }}>
                <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Submit Prepared USDC Deposit</DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            Sign and broadcast the prepared two-transaction group to fund the pool via <code>deposit_usdc</code>.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedSettlementBatch?.depositAttempt && (
                        <div className="space-y-3 rounded border border-slate-800 bg-slate-950 p-4 text-xs font-mono text-slate-300">
                            <div className="text-center pb-3 border-b border-slate-800">
                                <span className="text-[10px] uppercase text-slate-500 font-sans font-bold">Funding Amount</span>
                                <p className="text-xl font-bold text-emerald-400 mt-1">{formatUsdcLabel(selectedSettlementBatch.depositAttempt.amountUsdcAtomicUnits)}</p>
                            </div>
                            <p>Signer: {accountAddress}</p>
                            <p>Group ID: {selectedSettlementBatch.depositAttempt.groupId}</p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsUsdcDepositSubmissionDialogOpen(false)} disabled={isSubmittingPreparedUsdcDeposit} className="border-slate-700 bg-slate-800 text-slate-200">Cancel</Button>
                        <Button type="button" variant="destructive" onClick={handleSignAndSubmitPreparedUsdcDeposit} disabled={isSubmittingPreparedUsdcDeposit || !selectedSettlementBatch?.depositAttempt} className="bg-rose-600 hover:bg-rose-500 text-white font-bold">
                            {isSubmittingPreparedUsdcDeposit ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing...</> : 'Sign and Broadcast'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isPayoutRoundSubmissionDialogOpen} onOpenChange={(open) => { if (!isSubmittingPayoutRound) setIsPayoutRoundSubmissionDialogOpen(open); }}>
                <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Release USDC for Claim</DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            Sign and broadcast the payout round group to make funds claimable by recipients.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedSettlementBatch?.payoutSubmissionAttempt && (
                        <div className="space-y-3 rounded border border-slate-800 bg-slate-950 p-4 text-xs font-mono text-slate-300">
                            <div className="text-center pb-3 border-b border-slate-800">
                                <span className="text-[10px] uppercase text-slate-500 font-sans font-bold">Release Amount</span>
                                <p className="text-xl font-bold text-emerald-400 mt-1">{formatUsdcLabel(selectedSettlementBatch.payoutSubmissionAttempt.totalUsdcAtomicUnits)}</p>
                            </div>
                            <p>Payout Key: {selectedSettlementBatch.payoutSubmissionAttempt.payoutRoundKey}</p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsPayoutRoundSubmissionDialogOpen(false)} disabled={isSubmittingPayoutRound} className="border-slate-700 bg-slate-800 text-slate-200">Cancel</Button>
                        <Button type="button" variant="destructive" onClick={handleSignAndSubmitPayoutRound} disabled={isSubmittingPayoutRound || !selectedSettlementBatch?.payoutSubmissionAttempt} className="bg-rose-600 hover:bg-rose-500 text-white font-bold">
                            {isSubmittingPayoutRound ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing...</> : 'Sign and Broadcast Release'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isResetPreparedUsdcDepositDialogOpen} onOpenChange={(open) => { if (!isResettingPreparedUsdcDeposit) setIsResetPreparedUsdcDepositDialogOpen(open); }}>
                <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Rebuild Expired USDC Proposal?</DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            Clears the expired unsigned proposal parameters. The frozen batch amount remains unchanged.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsResetPreparedUsdcDepositDialogOpen(false)} disabled={isResettingPreparedUsdcDeposit} className="border-slate-700 bg-slate-800 text-slate-200">Cancel</Button>
                        <Button type="button" variant="destructive" onClick={handleResetExpiredPreparedUsdcDeposit} disabled={isResettingPreparedUsdcDeposit} className="bg-rose-600 hover:bg-rose-500 text-white font-bold">
                            {isResettingPreparedUsdcDeposit ? <Loader2 className="animate-spin h-4 w-4" /> : 'Confirm Reset'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}