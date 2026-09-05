'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/lib/WalletContext';
import { useAuth } from '@/lib/AuthContext';
import algosdk from 'algosdk';
import { toast } from 'sonner';
import {
    Loader2,
    Coins,
    ArrowRight,
    ShieldCheck,
    Wallet,
    RefreshCw,
    AlertCircle,
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const USDC_ASSET_ID = Number(process.env.NEXT_PUBLIC_USDC_ASSET_ID);

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

if (!USDC_ASSET_ID) {
    throw new Error('USDC_ASSET_ID is not configured');
}

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

    const isPreparedUnallocatedUsdcDeposit = (depositAttempt) =>
    depositAttempt?.operation === 'prepare_unallocated_usdc_deposit';

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
        const algod = new algosdk.Algodv2(
            '',
            'https://testnet-api.algonode.cloud',
            ''
        );

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

        setIps(ipData.ipAssets || []);
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

            const algod = new algosdk.Algodv2(
                '',
                'https://testnet-api.algonode.cloud',
                ''
            );

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

    // Read-only preview: preparePayoutRoundDistribution() does not persist,
    // sign, submit, or broadcast anything. Nothing here is a stored "next
    // stage" -- it is recomputed on every call and shown for review only.
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
            console.log(
                '[V10 USDC] submit clicked',
                selectedSettlementBatch,
                accountAddress
            );

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
            console.error(
                '[V10 USDC] local deposit proposal validation failed',
                depositAttempt
            );

            alert(
                'Blocked before wallet signing. Open DevTools Console and copy the [V10 USDC] deposit attempt validation fields object.'
            );

            return;
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

            const algod = new algosdk.Algodv2(
                '',
                'https://testnet-api.algonode.cloud',
                ''
            );

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

    if (!appId) {
        return (
            <div className="p-8">
                Error: NEXT_PUBLIC_REVENUE_POOL_APP_ID not set
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-8 p-8">
            <h1 className="flex items-center gap-3 text-3xl font-bold">
                <ShieldCheck className="h-8 w-8 text-blue-600" />
                Pool Admin
            </h1>

            <Card className="border-slate-200 bg-slate-50">
                <CardContent className="flex flex-col items-center justify-between gap-4 p-4 md:flex-row">
                    <div className="flex items-center gap-4">
                        <div className="rounded-full border bg-white p-3 shadow-sm">
                            <Wallet className="h-6 w-6 text-slate-500" />
                        </div>

                        <div>
                            <p className="text-sm font-medium text-slate-500">
                                Your Wallet Balance
                            </p>

                            <div className="flex items-center gap-4 text-lg font-bold">
                                <span>{userInfo.algo.toFixed(2)} ALGO</span>

                                <span
                                    className={
                                        userInfo.usdc > 0
                                            ? 'text-green-600'
                                            : 'text-red-500'
                                    }
                                >
                                    {userInfo.usdc.toFixed(2)} USDC
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex w-full gap-2 md:w-auto">
                        {!isConnected ? (
                            <Button onClick={connect}>Connect Wallet</Button>
                        ) : (
                            <Button
                                variant="outline"
                                onClick={fetchData}
                                disabled={isRefreshing}
                            >
                                {isRefreshing ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                )}
                                Refresh
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Pool Contract</CardTitle>

                        <CardDescription className="mt-2 break-all rounded bg-muted p-2 font-mono text-xs">
                            {appAddress}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between rounded border border-green-100 bg-green-50 p-3 text-green-800">
                            <span className="flex items-center gap-2">
                                <Coins className="h-4 w-4" />
                                Pool Total USDC
                            </span>

                            <span className="font-mono text-xl font-bold">
                                ${poolInfo?.usdcBalance.toFixed(2) || '0.00'}
                            </span>
                        </div>

                        <div className="flex items-center justify-between rounded bg-muted p-3">
                            <span className="text-muted-foreground">
                                USDC Opt-In
                            </span>

                            {poolInfo?.isOptedIn ? (
                                <span className="flex items-center gap-1 font-bold text-green-600">
                                    <ShieldCheck className="h-4 w-4" />
                                    Active
                                </span>
                            ) : (
                                <span className="font-bold text-red-500">
                                    Inactive
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Actions</CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {!poolInfo?.isOptedIn && (
                            <div className="space-y-2 border-b pb-6">
                                <h3 className="flex items-center gap-2 font-medium text-yellow-600">
                                    <ShieldCheck className="h-4 w-4" />
                                    Step 1: Initialize Pool
                                </h3>

                                <div className="flex gap-2">
                                    <p className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                                        Current-holder snapshot payouts use unallocated USDC only.
                                        Legacy chain operations are intentionally unavailable here
                                        because they allocate to the original pool stakeholders rather than current REV holders.
                                    </p>
                                    <Input
                                        type="password"
                                        placeholder="Admin Secret"
                                        value={secret}
                                        onChange={(event) =>
                                            setSecret(event.target.value)
                                        }
                                    />

                                    <Button
                                        onClick={handleOptIn}
                                        disabled={isOptingIn}
                                    >
                                        {isOptingIn ? (
                                            <Loader2 className="animate-spin" />
                                        ) : (
                                            'Opt-In USDC'
                                        )}
                                    </Button>
                                </div>

                                <p className="text-xs text-muted-foreground">
                                    This enables the pool to hold USDC.
                                </p>
                            </div>
                        )}

                        <div className="space-y-3">
                            <h3 className="flex items-center gap-2 font-medium text-green-600">
                                <Coins className="h-4 w-4" />
                                Step 1: Freeze current REV-holder snapshot and Step 2: Prepare unallocated USDC deposit
                            </h3>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">
                                    Select revenue-pool IP
                                </label>

                                <Select
                                    onValueChange={(poolKey) => {
                                        setSelectedIpId(poolKey);
                                        loadSettlementBatches(poolKey);
                                        loadEligibleLedgerRows(poolKey);
                                    }}
                                    value={selectedIpId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select IP Asset..." />
                                    </SelectTrigger>

                                    <SelectContent>
                                        {ips.map((ip) => {
                                            const resolvedPoolIpId = resolvePoolIpId(ip);

                                            if (!resolvedPoolIpId) {
                                                return null;
                                            }

                                            return (
                                                <SelectItem
                                                    key={ip.id}
                                                    value={resolvedPoolIpId}
                                                >
                                                    {ip.name} — V7 Key: {resolvedPoolIpId}
                                                    {ip.revenueTokenAssetId
                                                        ? ` — REV ASA: ${ip.revenueTokenAssetId}`
                                                        : ''}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                                <div className="space-y-2">
                                    <div className="space-y-3 rounded border border-amber-200 bg-amber-50 p-3">
                                        <div>
                                            <p className="font-medium text-amber-950">
                                                Eligible revenue awaiting batching
                                            </p>

                                            <p className="mt-1 text-xs text-amber-900">
                                                These rows completed their return hold. Creating a settlement
                                                batch is a database-only step: it freezes the selected row(s)
                                                for settlement but does not deposit USDC, create a payout
                                                round, sign, or submit a transaction.
                                            </p>
                                        </div>

                                        {isLoadingEligibleLedgerRows ? (
                                            <div className="flex items-center gap-2 text-sm text-amber-900">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Loading eligible revenue…
                                            </div>
                                        ) : eligibleLedgerRows.length === 0 ? (
                                            <p className="text-sm text-amber-900">
                                                No release-eligible, unbatched revenue is available for this
                                                selected pool.
                                            </p>
                                        ) : (
                                            <>
                                                <Select
                                                    value={selectedEligibleLedgerRowId}
                                                    onValueChange={setSelectedEligibleLedgerRowId}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select eligible revenue row..." />
                                                    </SelectTrigger>

                                                    <SelectContent>
                                                        {eligibleLedgerRows.map((row) => (
                                                            <SelectItem
                                                                key={row.ledgerRowId}
                                                                value={row.ledgerRowId}
                                                            >
                                                                Order {row.orderNumber || row.orderId} — $
                                                                {(Number(row.allocationCents) / 100).toFixed(2)}
                                                                {' '}— {row.usdcAtomicUnits} atomic USDC
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>

                                                {selectedEligibleLedgerRow && (
                                                    <div className="grid gap-1 rounded border border-amber-200 bg-white/70 p-3 text-xs text-amber-950">
                                                        <p>
                                                            Order:{' '}
                                                            <span className="font-mono">
                                                                {selectedEligibleLedgerRow.orderNumber ||
                                                                    selectedEligibleLedgerRow.orderId}
                                                            </span>
                                                        </p>

                                                        <p>
                                                            Ledger row:{' '}
                                                            <span className="break-all font-mono">
                                                                {selectedEligibleLedgerRow.ledgerRowId}
                                                            </span>
                                                        </p>

                                                        <p>
                                                            Allocation: $
                                                            {(
                                                                Number(
                                                                    selectedEligibleLedgerRow.allocationCents
                                                                ) / 100
                                                            ).toFixed(2)}
                                                        </p>

                                                        <p>
                                                            USDC atomic units:{' '}
                                                            <span className="font-mono">
                                                                {selectedEligibleLedgerRow.usdcAtomicUnits}
                                                            </span>
                                                        </p>
                                                    </div>
                                                )}

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => setIsCreateBatchDialogOpen(true)}
                                                    disabled={
                                                        !selectedEligibleLedgerRow ||
                                                        isCreatingSettlementBatch
                                                    }
                                                >
                                                    Create settlement batch
                                                </Button>
                                            </>
                                        )}

                                        {eligibleLedgerRowsError && (
                                            <p className="text-xs text-red-600">
                                                {eligibleLedgerRowsError}
                                            </p>
                                        )}
                                    </div>
                                    <label className="text-xs font-medium text-muted-foreground">
                                        Select settlement batch
                                    </label>

                                    <Select
                                        onValueChange={setSelectedSettlementBatchId}
                                        value={selectedSettlementBatchId}
                                        disabled={
                                            !selectedIpId ||
                                            isLoadingSettlementBatches ||
                                            settlementBatches.length === 0
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue
                                                placeholder={
                                                    isLoadingSettlementBatches
                                                        ? 'Loading settlement batches...'
                                                        : 'Select settlement batch...'
                                                }
                                            />
                                        </SelectTrigger>

                                        <SelectContent>
                                            {settlementBatches.map((batch) => (
                                                <SelectItem
                                                    key={batch.batchId}
                                                    value={batch.batchId}
                                                >
                                                    {batch.status} — {batch.totalUsdcAtomicUnits} atomic USDC
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {settlementBatchesError && (
                                        <p className="text-xs text-red-600">
                                            {settlementBatchesError}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {selectedSettlementBatch && (
                                <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                                    <p className="font-medium">
                                        Frozen settlement batch
                                    </p>

                                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                                        <p>
                                            Status:{' '}
                                            <span className="font-mono">
                                                {selectedSettlementBatch.status}
                                            </span>
                                        </p>

                                        <p>
                                            Settlement amount:{' '}
                                            <span className="font-mono">
                                                {selectedSettlementBatch.totalUsdcAtomicUnits}
                                            </span>{' '}
                                            atomic USDC
                                        </p>

                                        <p className="break-all md:col-span-2">
                                            Batch ID:{' '}
                                            <span className="font-mono text-xs">
                                                {selectedSettlementBatch.batchId}
                                            </span>
                                        </p>

                                        {selectedSettlementBatch.depositAttempt && (
                                            <>
                                                <p>
                                                    Prepared group shape:{' '}
                                                    <span className="font-mono">
                                                        2 transactions (USDC transfer 0, app call 1)
                                                    </span>
                                                </p>

                                                <p className="break-all">
                                                    App-call transaction ID:{' '}
                                                    <span className="font-mono text-xs">
                                                        {
                                                            selectedSettlementBatch.depositAttempt
                                                                .transactionIds?.appCall
                                                        }
                                                    </span>
                                                </p>

                                                <p className="break-all md:col-span-2">
                                                    Group ID:{' '}
                                                    <span className="font-mono text-xs">
                                                        {
                                                            selectedSettlementBatch.depositAttempt
                                                                .groupId
                                                        }
                                                    </span>
                                                </p>
                                            </>
                                        )}

                                        {selectedSettlementBatch.materialization ? (
                                            <p className="break-all md:col-span-2">
                                                Materialization status:{' '}
                                                <span className="font-mono">
                                                    {selectedSettlementBatch.materialization.status || 'unknown'}
                                                </span>
                                            </p>
                                        ) : null}

                                                                                {selectedSettlementBatch.revenueRoundId ? (
                                            <>
                                                <p className="break-all md:col-span-2">
                                                    Payout-round database status:{' '}
                                                    <span className="font-mono">
                                                        {selectedSettlementBatch.status === 'round_created'
                                                            ? 'created'
                                                            : 'unknown'}
                                                    </span>
                                                </p>

                                                <p className="break-all md:col-span-2">
                                                    Payout-round key:{' '}
                                                    <span className="font-mono text-xs">
                                                        {selectedSettlementBatch.revenueRoundId}
                                                    </span>
                                                </p>

                                                <p className="break-all md:col-span-2">
                                                    On-chain payout-round transaction:{' '}
                                                    <span className="font-mono text-xs">
                                                        {selectedSettlementBatch.revenueRoundTxId ||
                                                            'not submitted'}
                                                    </span>
                                                </p>

                                                {selectedSettlementBatch.revenueRoundCreatedAt ? (
                                                    <p className="break-all md:col-span-2">
                                                        Payout-round database creation time:{' '}
                                                        <span className="font-mono text-xs">
                                                            {selectedSettlementBatch.revenueRoundCreatedAt}
                                                        </span>
                                                    </p>
                                                ) : null}
                                            </>
                                        ) : null}
                                    </div>

                                    <p className="mt-2 text-xs text-blue-900">
                                        A unallocated usdc does not pay recipients. Confirmation,
                                        ledger materialization, payout-round creation, and distribution
                                        remain separate steps.
                                    </p>
                                </div>
                            )}

                            {preparedDistribution && (
                                <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                                    <p className="font-medium">
                                        Distribution preview (not persisted, not signed, not broadcast)
                                    </p>
                                    <p className="mt-1 font-mono text-xs">
                                        Recipient count: {preparedDistribution.payoutInstructions?.length ?? 'unknown'}
                                    </p>
                                    <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                                        {(preparedDistribution.payoutInstructions || []).map((instruction, index) => (
                                            <p
                                                key={`${instruction.recipientAddress}-${index}`}
                                                className="break-all font-mono text-xs"
                                            >
                                                {instruction.recipientAddress}: {instruction.amountUsdcAtomicUnits} atomic USDC
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    onClick={handlePrepareRecipientSnapshot}
                                    disabled={
                                        isPreparingRecipientSnapshot ||
                                        !selectedSettlementBatch ||
                                        selectedSettlementBatch.status !== 'created'
                                    }
                                    variant="outline"
                                >
                                    {isPreparingRecipientSnapshot ? (
                                        <Loader2 className="animate-spin" />
                                    ) : (
                                        'Prepare recipient snapshot'
                                    )}
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handlePrepareUnallocatedUsdcDeposit}
                                    disabled={
                                        isPreparingUnallocatedDeposit ||
                                        !isConnected ||
                                        !poolInfo?.isOptedIn ||
                                        !selectedSettlementBatch ||
                                        selectedSettlementBatch.status !==
                                            'recipient_snapshot_prepared'
                                    }
                                >
                                    {isPreparingUnallocatedDeposit ? (
                                        <Loader2 className="animate-spin" />
                                    ) : (
                                        'Prepare unallocated USDC deposit'
                                    )}
                                </Button>

                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() => setIsUsdcDepositSubmissionDialogOpen(true)}
                                    disabled={
                                        isSubmittingPreparedUsdcDeposit ||
                                        !isConnected ||
                                        !accountAddress ||
                                        !selectedSettlementBatch ||
                                        selectedSettlementBatch.status !== 'deposit_prepared' ||
                                        selectedSettlementBatch.depositAttempt?.status !== 'prepared' ||
                                        !isPreparedUnallocatedUsdcDeposit(
                                            selectedSettlementBatch.depositAttempt
                                        )
                                    }
                                >
                                    Sign and submit prepared USDC deposit
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        setIsResetPreparedUsdcDepositDialogOpen(true)
                                    }
                                    disabled={
                                        isResettingPreparedUsdcDeposit ||
                                        isSubmittingPreparedUsdcDeposit ||
                                        !selectedSettlementBatch ||
                                        selectedSettlementBatch.status !== 'deposit_prepared' ||
                                        selectedSettlementBatch.depositAttempt?.status !== 'prepared'
                                    }
                                >
                                    Rebuild expired USDC proposal
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleConfirmDeposit}
                                    disabled={
                                        isConfirmingDeposit ||
                                        !selectedSettlementBatch ||
                                        selectedSettlementBatch.status !== 'deposit_submitted'
                                    }
                                >
                                    {isConfirmingDeposit ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Confirming...
                                        </>
                                    ) : (
                                        'Confirm USDC deposit'
                                    )}
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleMaterializeDeposit}
                                    disabled={
                                        isMaterializingDeposit ||
                                        !selectedSettlementBatch ||
                                        selectedSettlementBatch.status !== 'deposit_confirmed_pending_ledger'
                                    }
                                >
                                    {isMaterializingDeposit ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Materializing...
                                        </>
                                    ) : (
                                        'Materialize confirmed deposit'
                                    )}
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCreatePayoutRound}
                                    disabled={
                                        isCreatingPayoutRound ||
                                        !selectedSettlementBatch ||
                                        selectedSettlementBatch.status !== 'deposited'
                                    }
                                >
                                    {isCreatingPayoutRound ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Creating payout round...
                                        </>
                                    ) : (
                                        'Create payout round'
                                    )}
                                </Button>

                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleReleaseUsdcForClaim}
                                    disabled={
                                        isSubmittingPayoutRound ||
                                        !isConnected ||
                                        !accountAddress ||
                                        !selectedSettlementBatch ||
                                        (
                                            selectedSettlementBatch.status !== 'round_created' &&
                                            selectedSettlementBatch.status !== 'payout_prepared'
                                        )
                                    }
                                >
                                    {isSubmittingPayoutRound ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Preparing release...
                                        </>
                                    ) : (
                                        'Release USDC for claim'
                                    )}
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handlePrepareDistribution}
                                    disabled={
                                        isPreparingDistribution ||
                                        !selectedSettlementBatch ||
                                        selectedSettlementBatch.status !== 'round_created'
                                    }
                                >
                                    {isPreparingDistribution ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Previewing distribution...
                                        </>
                                    ) : (
                                        'Preview distribution (read-only)'
                                    )}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Freeze the current REV-holder snapshot first. Then prepare an unallocated
                                USDC deposit for the exact frozen batch amount.
                            </p>
                            {userInfo.usdc === 0 && isConnected && (
                                <div className="flex gap-2 rounded bg-red-50 p-2 text-xs text-red-600">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>
                                        You have 0 USDC. Go to Tinyman Testnet
                                        to swap ALGO for USDC ({USDC_ASSET_ID}).
                                    </span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog
                open={isCreateBatchDialogOpen}
                onOpenChange={(open) => {
                    if (!isCreatingSettlementBatch) {
                        setIsCreateBatchDialogOpen(open);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create settlement batch?</DialogTitle>

                        <DialogDescription>
                            This creates a database settlement batch and changes the
                            selected revenue-ledger row from release_eligible to batched.
                            It does not deposit USDC, create a payout round, or submit
                            any blockchain transaction.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedEligibleLedgerRow && (
                        <div className="space-y-2 rounded border bg-muted p-3 text-sm">
                            <p>
                                Order:{' '}
                                <span className="font-mono">
                                    {selectedEligibleLedgerRow.orderNumber ||
                                        selectedEligibleLedgerRow.orderId}
                                </span>
                            </p>

                            <p>
                                Ledger row:{' '}
                                <span className="break-all font-mono text-xs">
                                    {selectedEligibleLedgerRow.ledgerRowId}
                                </span>
                            </p>

                            <p>
                                Allocation: $
                                {(
                                    Number(
                                        selectedEligibleLedgerRow.allocationCents
                                    ) / 100
                                ).toFixed(2)}
                            </p>

                            <p>
                                USDC atomic units:{' '}
                                <span className="font-mono">
                                    {selectedEligibleLedgerRow.usdcAtomicUnits}
                                </span>
                            </p>

                            <p>
                                Pool key:{' '}
                                <span className="break-all font-mono text-xs">
                                    {selectedEligibleLedgerRow.poolKey}
                                </span>
                            </p>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCreateBatchDialogOpen(false)}
                            disabled={isCreatingSettlementBatch}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            onClick={handleCreateSettlementBatch}
                            disabled={
                                !selectedEligibleLedgerRow ||
                                isCreatingSettlementBatch
                            }
                        >
                            {isCreatingSettlementBatch ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating batch…
                                </>
                            ) : (
                                'Create database batch'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={isUsdcDepositSubmissionDialogOpen}
                onOpenChange={(open) => {
                    if (!isSubmittingPreparedUsdcDeposit) {
                        setIsUsdcDepositSubmissionDialogOpen(open);
                    }
                }}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            Submit prepared V10 USDC deposit?
                        </DialogTitle>

                        <DialogDescription>
                            This will ask your connected wallet to sign and then broadcast
                            the exact prepared two-transaction group. It transfers USDC
                            into the revenue pool using the <code>deposit_usdc</code>{' '}
                            application action.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSettlementBatch?.depositAttempt && (
                        <div className="space-y-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                    <p className="text-xs font-medium text-amber-800">
                                        Connected signer
                                    </p>

                                    <p className="mt-1 break-all font-mono text-xs">
                                        {accountAddress}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-amber-800">
                                        Deposit operation
                                    </p>

                                    <p className="mt-1 font-mono">
                                        prepare_unallocated_usdc_deposit
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-amber-800">
                                        App action
                                    </p>

                                    <p className="mt-1 font-mono">
                                        deposit_usdc
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-amber-800">
                                        USDC amount
                                    </p>

                                    <p className="mt-1 font-mono">
                                        {
                                            selectedSettlementBatch.depositAttempt
                                                .amountUsdcAtomicUnits
                                        }{' '}
                                        atomic USDC
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-amber-800">
                                        Transaction group
                                    </p>

                                    <p className="mt-1 font-mono">
                                        2 transactions
                                    </p>

                                    <p className="mt-1 text-xs text-amber-900">
                                        USDC transfer: index 0 · App call: index 1
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-amber-800">
                                        Pool key
                                    </p>

                                    <p className="mt-1 break-all font-mono text-xs">
                                        {selectedSettlementBatch.poolKey}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-amber-800">
                                    Settlement batch ID
                                </p>

                                <p className="mt-1 break-all font-mono text-xs">
                                    {selectedSettlementBatch.batchId}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-amber-800">
                                    Prepared group ID
                                </p>

                                <p className="mt-1 break-all font-mono text-xs">
                                    {selectedSettlementBatch.depositAttempt.groupId}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-amber-800">
                                    USDC transfer transaction ID
                                </p>

                                <p className="mt-1 break-all font-mono text-xs">
                                    {
                                        selectedSettlementBatch.depositAttempt
                                            .transactionIds?.usdcTransfer
                                    }
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-amber-800">
                                    Application-call transaction ID
                                </p>

                                <p className="mt-1 break-all font-mono text-xs">
                                    {
                                        selectedSettlementBatch.depositAttempt
                                            .transactionIds?.appCall
                                    }
                                </p>
                            </div>

                            <p className="border-t border-amber-200 pt-3 text-xs text-amber-900">
                                Confirm only if the connected wallet is the V10
                                administrator or the exact configured pool-proxy wallet,
                                and the amount is the intended frozen batch amount.
                                Once broadcast, do not prepare another deposit group for
                                this batch.
                            </p>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                setIsUsdcDepositSubmissionDialogOpen(false)
                            }
                            disabled={isSubmittingPreparedUsdcDeposit}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleSignAndSubmitPreparedUsdcDeposit}
                            disabled={
                                isSubmittingPreparedUsdcDeposit ||
                                !selectedSettlementBatch?.depositAttempt ||
                                !isPreparedUnallocatedUsdcDeposit(
                                    selectedSettlementBatch.depositAttempt
                                )
                            }
                        >
                            {isSubmittingPreparedUsdcDeposit ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Signing and submitting…
                                </>
                            ) : (
                                'Sign and broadcast USDC deposit'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={isPayoutRoundSubmissionDialogOpen}
                onOpenChange={(open) => {
                    if (!isSubmittingPayoutRound) {
                        setIsPayoutRoundSubmissionDialogOpen(open);
                    }
                }}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Release USDC for claim?</DialogTitle>

                        <DialogDescription>
                            This will ask your connected wallet to sign and then broadcast
                            the exact prepared two-transaction payout group. Broadcasting
                            creates the payout round on-chain and makes the released USDC
                            available for eligible recipients to claim.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSettlementBatch?.payoutSubmissionAttempt && (
                        <div className="space-y-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                    <p className="text-xs font-medium text-amber-800">
                                        Connected signer
                                    </p>

                                    <p className="mt-1 break-all font-mono text-xs">
                                        {accountAddress}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-amber-800">
                                        Payout-round key
                                    </p>

                                    <p className="mt-1 break-all font-mono text-xs">
                                        {
                                            selectedSettlementBatch
                                                .payoutSubmissionAttempt
                                                .payoutRoundKey
                                        }
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-amber-800">
                                        USDC amount
                                    </p>

                                    <p className="mt-1 font-mono">
                                        {
                                            selectedSettlementBatch
                                                .payoutSubmissionAttempt
                                                .totalUsdcAtomicUnits
                                        }{' '}
                                        atomic USDC
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-amber-800">
                                        Transaction group
                                    </p>

                                    <p className="mt-1 font-mono">
                                        2 transactions
                                    </p>

                                    <p className="mt-1 text-xs text-amber-900">
                                        USDC transfer: index 0 · App call: index 1
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-amber-800">
                                    Settlement batch ID
                                </p>

                                <p className="mt-1 break-all font-mono text-xs">
                                    {selectedSettlementBatch.batchId}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-amber-800">
                                    Prepared group ID
                                </p>

                                <p className="mt-1 break-all font-mono text-xs">
                                    {
                                        selectedSettlementBatch
                                            .payoutSubmissionAttempt
                                            .groupId
                                    }
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-amber-800">
                                    Application-call transaction ID
                                </p>

                                <p className="mt-1 break-all font-mono text-xs">
                                    {
                                        selectedSettlementBatch
                                            .payoutSubmissionAttempt
                                            .transactionIds?.appCall
                                    }
                                </p>
                            </div>

                            <p className="border-t border-amber-200 pt-3 text-xs text-amber-900">
                                Confirm only if the connected wallet is authorized to
                                create this payout round and the amount matches the frozen
                                settlement batch. This broadcast releases the batch USDC
                                for recipient claims.
                            </p>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                setIsPayoutRoundSubmissionDialogOpen(false)
                            }
                            disabled={isSubmittingPayoutRound}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleSignAndSubmitPayoutRound}
                            disabled={
                                isSubmittingPayoutRound ||
                                !selectedSettlementBatch?.payoutSubmissionAttempt
                            }
                        >
                            {isSubmittingPayoutRound ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Signing and submitting…
                                </>
                            ) : (
                                'Sign and broadcast USDC release'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={isResetPreparedUsdcDepositDialogOpen}
                onOpenChange={(open) => {
                    if (!isResettingPreparedUsdcDeposit) {
                        setIsResetPreparedUsdcDepositDialogOpen(open);
                    }
                }}
            >
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>
                            Rebuild expired USDC proposal?
                        </DialogTitle>

                        <DialogDescription>
                            This clears the existing unsigned proposal because its Algorand
                            validity window has expired. It does not move USDC, sign a
                            transaction, change recipients, or change the frozen batch
                            amount.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSettlementBatch?.depositAttempt && (
                        <div className="space-y-3 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                    <p className="text-xs font-medium text-amber-800">
                                        Batch ID
                                    </p>

                                    <p className="mt-1 break-all font-mono text-xs">
                                        {selectedSettlementBatch.batchId}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-amber-800">
                                        Amount preserved
                                    </p>

                                    <p className="mt-1 font-mono">
                                        {
                                            selectedSettlementBatch.depositAttempt
                                                .amountUsdcAtomicUnits
                                        }{' '}
                                        atomic USDC
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-amber-800">
                                        Existing group ID
                                    </p>

                                    <p className="mt-1 break-all font-mono text-xs">
                                        {
                                            selectedSettlementBatch.depositAttempt
                                                .groupId
                                        }
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-amber-800">
                                        Current status
                                    </p>

                                    <p className="mt-1 font-mono">
                                        {selectedSettlementBatch.status}
                                    </p>
                                </div>
                            </div>

                            <p className="border-t border-amber-200 pt-3 text-xs text-amber-900">
                                The frozen recipient snapshot, recipient hash, pool key,
                                and 800000-atomic-USDC batch amount remain unchanged.
                                After reset, you must prepare a new USDC proposal and
                                promptly review and sign its newly generated group.
                            </p>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                setIsResetPreparedUsdcDepositDialogOpen(false)
                            }
                            disabled={isResettingPreparedUsdcDeposit}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleResetExpiredPreparedUsdcDeposit}
                            disabled={
                                isResettingPreparedUsdcDeposit ||
                                !selectedSettlementBatch?.depositAttempt
                            }
                        >
                            {isResettingPreparedUsdcDeposit ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Clearing proposal…
                                </>
                            ) : (
                                'Clear expired proposal'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}