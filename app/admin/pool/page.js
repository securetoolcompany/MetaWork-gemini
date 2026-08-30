'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/lib/WalletContext';
import { useAuth } from '@/lib/AuthContext';
import algosdk from 'algosdk';
import { readV7PoolState } from '@/lib/revenue-pool-v7-pool-state';
import { readV7ActiveRoundState } from '@/lib/revenue-pool-v7-round-state';
import { preflightV7ReleaseHeld } from '@/lib/revenue-pool-v7-preflight';
import { signApprovedV7ReleaseHeldGroup } from '@/lib/revenue-pool-v7-signing';
import { submitApprovedV7ReleaseHeldGroup } from '@/lib/revenue-pool-v7-submission';
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

const V7_RELEASE_SUBMISSION_ENABLED =
    process.env.NEXT_PUBLIC_ALGORAND_NETWORK === 'testnet' &&
    process.env.NEXT_PUBLIC_V7_RELEASE_SUBMISSION_ENABLED === 'true';

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
    const [v7SettlementState, setV7SettlementState] = useState({
        status: 'idle',
        error: null,
        suggestedFeeAtomicUnits: null,
        outerFeesAtomicUnits: null,
        poolMbrAtomicUnits: null,
        poolState: null,
        roundState: null,
    });

    const [preflightResult, setPreflightResult] = useState(null);
    const [preflightError, setPreflightError] = useState(null);
    const [isPreparingRelease, setIsPreparingRelease] = useState(false);

    const [signedResult, setSignedResult] = useState(null);
    const [signingError, setSigningError] = useState(null);
    const [isSigningRelease, setIsSigningRelease] = useState(false);

    const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
    const [isSubmittingRelease, setIsSubmittingRelease] = useState(false);
    const [submissionResult, setSubmissionResult] = useState({
        outcome: 'disabled',
        reasons: [
            'V7 settlement submission is disabled by configuration.',
        ],
        transactionId: null,
        confirmedRound: null,
    });

    const [isFunding, setIsFunding] = useState(false);

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

    const getPreparedUsdcDepositType = (depositAttempt) => {
        if (!depositAttempt || typeof depositAttempt !== 'object') {
            return null;
        }

        if (depositAttempt.depositType === 'usdc') {
            return 'usdc';
        }

        // Compatibility for the one existing prepared proposal created by
        // the new “Prepare unallocated USDC deposit” workflow before the
        // depositType field was persisted.
        if (
            depositAttempt.depositType === undefined ||
            depositAttempt.depositType === null
        ) {
            return 'usdc';
        }

        return null;
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

    const fetchData = useCallback(async () => {
        if (!appId || !appAddress) return;

        const revenuePoolAppId = Number(appId);

        if (!Number.isSafeInteger(revenuePoolAppId) || revenuePoolAppId < 1) {
            setV7SettlementState({
                status: 'error',
                error: 'NEXT_PUBLIC_REVENUE_POOL_APP_ID must be a positive safe integer.',
                suggestedFeeAtomicUnits: null,
                outerFeesAtomicUnits: null,
                poolMbrAtomicUnits: null,
                poolState: null,
                roundState: null,
            });

            return;
        }

        setPreflightResult(null);
        setPreflightError(null);
        setSignedResult(null);
        setSigningError(null);
        setIsSubmissionDialogOpen(false);
        setSubmissionResult({
            outcome: 'disabled',
            reasons: [
                V7_RELEASE_SUBMISSION_ENABLED
                    ? 'A fresh preflight and signature are required before submission.'
                    : 'V7 settlement submission is disabled by configuration.',
            ],
            transactionId: null,
            confirmedRound: null,
        });
        
        setIsRefreshing(true);

        setV7SettlementState((previous) => ({
            ...previous,
            status: selectedIpId ? 'loading' : 'idle',
            error: null,
            poolState: null,
            roundState: null,
        }));

        const algod = new algosdk.Algodv2(
            '',
            'https://testnet-api.algonode.cloud',
            ''
        );

        try {
            const suggestedParams = await algod.getTransactionParams().do();

            const poolAcct = await algod.accountInformation(appAddress).do();
            const poolUsdc = findAsset(poolAcct.assets, USDC_ASSET_ID);

            setPoolInfo({
                algoBalance: Number(poolAcct.amount) / 1000000,
                usdcBalance: poolUsdc ? Number(poolUsdc.amount) / 1000000 : 0,
                isOptedIn: !!poolUsdc,
            });

            if (accountAddress) {
                const userAcct = await algod.accountInformation(accountAddress).do();
                const userUsdc = findAsset(userAcct.assets, USDC_ASSET_ID);

                setUserInfo({
                    algo: Number(userAcct.amount) / 1000000,
                    usdc: userUsdc ? Number(userUsdc.amount) / 1000000 : 0,
                });
            }

            const ipRes = await fetch('/api/admin/revenue-pool/ip-assets', {
                headers: getAuthHeader(),
                cache: 'no-store',
            });

           const ipData = await ipRes.json();

            if (!ipRes.ok) {
                throw new Error(
                    ipData.error || 'Unable to load IP assets for pool administration.'
                );
            }

            setIps(ipData.ipAssets || []);

            const suggestedFeeAtomicUnits = toAtomicUnitsBigInt(
                suggestedParams.minFee ?? suggestedParams.fee
            );

            const poolMbrAtomicUnits = toAtomicUnitsBigInt(
                poolAcct['min-balance'] ?? poolAcct.minBalance
            );

            if (!selectedIpId) {
                setV7SettlementState({
                    status: 'idle',
                    error: null,
                    suggestedFeeAtomicUnits,
                    outerFeesAtomicUnits: suggestedFeeAtomicUnits * 2n,
                    poolMbrAtomicUnits,
                    poolState: null,
                    roundState: null,
                });

                return;
            }

            try {
                const poolState = await readV7PoolState({
                    algodClient: algod,
                    revenuePoolAppId,
                    expectedRevenuePoolAppId: revenuePoolAppId,
                    ipAssetId: selectedIpId,
                });

                const roundState = await readV7ActiveRoundState({
                    algodClient: algod,
                    revenuePoolAppId,
                    expectedRevenuePoolAppId: revenuePoolAppId,
                    ipAssetId: selectedIpId,
                    poolState,
                });

                setV7SettlementState({
                    status: 'ready',
                    error: null,
                    suggestedFeeAtomicUnits,
                    outerFeesAtomicUnits: suggestedFeeAtomicUnits * 2n,
                    poolMbrAtomicUnits,
                    poolState,
                    roundState,
                });
            } catch (error) {
                console.error('V7 settlement read error:', error);

                setV7SettlementState({
                    status: 'error',
                    error:
                        error.message ||
                        'Unable to read V7 pool settlement state.',
                    suggestedFeeAtomicUnits,
                    outerFeesAtomicUnits: suggestedFeeAtomicUnits * 2n,
                    poolMbrAtomicUnits,
                    poolState: null,
                    roundState: null,
                });
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            toast.error(`Failed to refresh data: ${error.message}`);

            setV7SettlementState({
                status: 'error',
                error:
                    error.message ||
                    'Unable to refresh settlement read state.',
                suggestedFeeAtomicUnits: null,
                outerFeesAtomicUnits: null,
                poolMbrAtomicUnits: null,
                poolState: null,
                roundState: null,
            });
        } finally {
            setIsRefreshing(false);
        }
    }, [
        appAddress,
        appId,
        accountAddress,
        getAuthHeader,
        selectedIpId,
    ]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handlePrepareRelease = async () => {
        if (!isConnected || !accountAddress) {
            return toast.error(
                'Connect the administrator wallet before preparing a release.'
            );
        }

        if (!selectedIpId) {
            return toast.error('Select an IP asset before preparing a release.');
        }

        if (!appId || !appAddress) {
            return toast.error('Revenue-pool application configuration is unavailable.');
        }

        const revenuePoolAppId = Number(appId);

        if (!Number.isSafeInteger(revenuePoolAppId) || revenuePoolAppId < 1) {
            return toast.error(
                'NEXT_PUBLIC_REVENUE_POOL_APP_ID must be a positive safe integer.'
            );
        }

        setIsPreparingRelease(true);
        setPreflightError(null);
        setPreflightResult(null);
        setSignedResult(null);
        setSigningError(null);
        setIsSubmissionDialogOpen(false);
        setSubmissionResult({
            outcome: 'disabled',
            reasons: [
                V7_RELEASE_SUBMISSION_ENABLED
                    ? 'A fresh signature is required after preparing a new release.'
                    : 'V7 settlement submission is disabled by configuration.',
            ],
            transactionId: null,
            confirmedRound: null,
        });

        try {
            const algod = new algosdk.Algodv2(
                '',
                'https://testnet-api.algonode.cloud',
                ''
            );

            const [suggestedParams, adminAccount, poolAccount] =
                await Promise.all([
                    algod.getTransactionParams().do(),
                    algod.accountInformation(accountAddress).do(),
                    algod.accountInformation(appAddress).do(),
                ]);

            const poolState = await readV7PoolState({
                algodClient: algod,
                revenuePoolAppId,
                expectedRevenuePoolAppId: revenuePoolAppId,
                ipAssetId: selectedIpId,
            });

            const roundState = await readV7ActiveRoundState({
                algodClient: algod,
                revenuePoolAppId,
                expectedRevenuePoolAppId: revenuePoolAppId,
                ipAssetId: selectedIpId,
                poolState,
            });

            const suggestedFeeAtomicUnits = toAtomicUnitsBigInt(
                suggestedParams.minFee ?? suggestedParams.fee
            );
            const poolMbrAtomicUnits = toAtomicUnitsBigInt(
                poolAccount['min-balance'] ?? poolAccount.minBalance
            );

            setUserInfo({
                algo: Number(adminAccount.amount) / 1000000,
                usdc: findAsset(adminAccount.assets, USDC_ASSET_ID)
                    ? Number(
                          findAsset(adminAccount.assets, USDC_ASSET_ID).amount
                      ) / 1000000
                    : 0,
            });

            setV7SettlementState({
                status: 'ready',
                error: null,
                suggestedFeeAtomicUnits,
                outerFeesAtomicUnits: suggestedFeeAtomicUnits * 2n,
                poolMbrAtomicUnits,
                poolState,
                roundState,
            });

            const result = preflightV7ReleaseHeld({
                revenuePoolAppId,
                expectedRevenuePoolAppId: revenuePoolAppId,
                usdcAssetId: USDC_ASSET_ID,
                adminAddress: accountAddress,
                ipAssetId: selectedIpId,
                suggestedParams,
                poolState,
                releaseState: roundState,
                adminAccountBalanceMicroAlgos: toAtomicUnitsBigInt(
                    adminAccount.amount
                ),
            });

            if (!result.ok) {
                setPreflightError(result.reasons);
                return;
            }

            setPreflightResult(result);
            toast.success('Release preflight prepared. Signing remains disabled.');
        } catch (error) {
            console.error('V7 release preflight error:', error);

            setPreflightError([
                {
                    code: 'PREPARE_FAILED',
                    message:
                        error.message || 'Unable to prepare release from live state.',
                },
            ]);
        } finally {
            setIsPreparingRelease(false);
        }
    };

    const handleSignRelease = async () => {
    if (
        !isConnected ||
        !accountAddress ||
        !preflightResult?.ok ||
        !preflightResult.unsignedGroup ||
        !preflightResult.proposedGroup?.groupId
    ) {
        return toast.error(
            'Connect the administrator wallet and prepare a successful release before signing.'
        );
    }

    setIsSigningRelease(true);
    setSigningError(null);
    setSignedResult(null);
    setIsSubmissionDialogOpen(false);
    setSubmissionResult({
        outcome: 'disabled',
        reasons: [
            V7_RELEASE_SUBMISSION_ENABLED
                ? 'Submission requires final confirmation after signing.'
                : 'V7 settlement submission is disabled by configuration.',
        ],
        transactionId: null,
        confirmedRound: null,
    });

    try {
        const signedResult = await signApprovedV7ReleaseHeldGroup({
            approvedGroup: preflightResult.unsignedGroup,
            expectedGroupId: preflightResult.proposedGroup.groupId,
            signTransactionGroup,
        });

        setSignedResult(signedResult);
        toast.success('Release group signed. Submission remains disabled.');
    } catch (error) {
        console.error('V7 release signing error:', error);

        setSigningError(
            error.message || 'Release signing was cancelled or rejected.'
        );
    } finally {
        setIsSigningRelease(false);
    }
};
    
    const refreshV7ReleasePreflight = async () => {
        if (!isConnected || !accountAddress) {
            throw new Error(
                'Connect the administrator wallet before refreshing submission state.'
            );
        }

        if (!selectedIpId) {
            throw new Error('Select an IP asset before refreshing submission state.');
        }

        if (!appId || !appAddress) {
            throw new Error('Revenue-pool application configuration is unavailable.');
        }

        const revenuePoolAppId = Number(appId);

        if (!Number.isSafeInteger(revenuePoolAppId) || revenuePoolAppId < 1) {
            throw new Error(
                'NEXT_PUBLIC_REVENUE_POOL_APP_ID must be a positive safe integer.'
            );
        }

        const algod = new algosdk.Algodv2(
            '',
            'https://testnet-api.algonode.cloud',
            ''
        );

        const [suggestedParams, adminAccount] = await Promise.all([
            algod.getTransactionParams().do(),
            algod.accountInformation(accountAddress).do(),
        ]);

        const poolState = await readV7PoolState({
            algodClient: algod,
            revenuePoolAppId,
            expectedRevenuePoolAppId: revenuePoolAppId,
            ipAssetId: selectedIpId,
        });

        const roundState = await readV7ActiveRoundState({
            algodClient: algod,
            revenuePoolAppId,
            expectedRevenuePoolAppId: revenuePoolAppId,
            ipAssetId: selectedIpId,
            poolState,
        });

        return preflightV7ReleaseHeld({
            revenuePoolAppId,
            expectedRevenuePoolAppId: revenuePoolAppId,
            usdcAssetId: USDC_ASSET_ID,
            adminAddress: accountAddress,
            ipAssetId: selectedIpId,
            suggestedParams,
            poolState,
            releaseState: roundState,
            adminAccountBalanceMicroAlgos: toAtomicUnitsBigInt(
                adminAccount.amount
            ),
            buildUnsignedGroup: false,
        });
    };

    const handleSubmitSignedRelease = async () => {
        if (
            !signedResult ||
            !preflightResult?.ok ||
            !preflightResult.proposedGroup?.groupId
        ) {
            setSubmissionResult({
                outcome: 'stale_preflight',
                reasons: [
                    'A matching in-memory signed result and successful preflight are required.',
                ],
                transactionId: null,
                confirmedRound: null,
            });
            setIsSubmissionDialogOpen(false);
            return;
        }

        setIsSubmittingRelease(true);

        try {
            const algod = new algosdk.Algodv2(
                '',
                'https://testnet-api.algonode.cloud',
                ''
            );

            const result = await submitApprovedV7ReleaseHeldGroup({
                enabled: V7_RELEASE_SUBMISSION_ENABLED,
                userConfirmedSubmission: true,
                signedResult,
                preflightResult,
                refreshPreflight: refreshV7ReleasePreflight,
                algodClient: algod,
                maxConfirmationAttempts: 20,
                confirmationPollIntervalMilliseconds: 1000,
            });

            setSubmissionResult(result);
            setIsSubmissionDialogOpen(false);

            if (result.outcome === 'confirmed') {
                toast.success(
                    `Release confirmed in round ${result.confirmedRound}.`
                );
                setSignedResult(null);
                setPreflightResult(null);
                await fetchData();
                return;
            }

            if (result.outcome === 'pending') {
                toast.success(
                    `Release submitted as ${result.transactionId}; confirmation is pending.`
                );
                setSignedResult(null);
                setPreflightResult(null);
                return;
            }

            if (result.outcome === 'stale_preflight') {
                setSignedResult(null);
                setPreflightResult(null);
                toast.error(
                    'Live state changed. Prepare and sign a new release group.'
                );
                return;
            }

            toast.error(
                result.reasons?.join(' ') ||
                    `Release submission ended with ${result.outcome}.`
            );
        } catch (error) {
            console.error('V7 release submission error:', error);

            setSubmissionResult({
                outcome: 'network_error',
                reasons: [
                    error.message || 'Unable to submit the signed release group.',
                ],
                transactionId: null,
                confirmedRound: null,
            });
            setIsSubmissionDialogOpen(false);
        } finally {
            setIsSubmittingRelease(false);
        }
    };

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
            return toast.error('Select a settlement batch before confirming its held deposit.');
        }

        if (selectedSettlementBatch.status !== 'deposit_submitted') {
            return toast.error('The held deposit can only be confirmed for batches with status "deposit_submitted".');
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
                throw new Error(data.error || 'Unable to confirm the held deposit.');
            }

            toast.success('Held deposit confirmed.');
            await loadSettlementBatches(selectedIpId);
        } catch (error) {
            console.error('V10 deposit confirmation failed', error);
            toast.error(error.message || 'Unable to confirm the held deposit.');
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

    const handleFund = async () => {
        if (!isConnected || !accountAddress) {
            return toast.error(
                'Connect the administrator wallet before preparing a held deposit.'
            );
        }

        if (!selectedSettlementBatch) {
            return toast.error(
                'Select a frozen settlement batch before preparing a held deposit.'
            );
        }

        setIsFunding(true);

        try {
            const prepareResponse = await fetch(
                '/api/admin/revenue-settlement',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeader(),
                    },
                    body: JSON.stringify({
                        action: 'prepare_deposit',
                        batchId: selectedSettlementBatch.batchId,
                        depositorAddress: accountAddress,
                    }),
                }
            );

            const prepareData = await prepareResponse.json();

            if (!prepareResponse.ok || !prepareData.success) {
                throw new Error(
                    prepareData.error ||
                        'Unable to prepare the durable held USDC deposit.'
                );
            }

            const depositAttempt = prepareData.depositAttempt;

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
                    'Prepared held-deposit metadata is incomplete or inconsistent.'
                );
            }

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
                    'Held-deposit signing was cancelled or incomplete.'
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
                        'The held deposit broadcast, but the durable submission state could not be recorded.'
                );
            }

            setIsUsdcDepositSubmissionDialogOpen(false);

            toast.success(
                'Held USDC deposit submitted. Confirmation, ledger materialization, payout-round creation, and distribution remain separate steps.'
            );

            await loadSettlementBatches(selectedIpId);
            await fetchData();
        } catch (error) {
            console.error('V10 held deposit failed:', error);

            toast.error(
                error?.message || 'Unable to submit the held USDC deposit.'
            );
        } finally {
            setIsFunding(false);
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

        setIsFunding(true);

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
            setIsFunding(false);
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
                resolvedDepositType: getPreparedUsdcDepositType(
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
        const preparedDepositType = getPreparedUsdcDepositType(depositAttempt);

        console.log('[V10 USDC] deposit attempt validation fields', {
            attemptStatus: depositAttempt?.status,
            preparedDepositType,
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
            preparedDepositType !== 'usdc' ||
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

            <div className="flex flex-col gap-3 rounded border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="font-medium text-blue-950">Release preparation</p>
                    <p className="text-sm text-blue-900">
                        Refreshes live state and builds a preflight-approved unsigned
                        group only. It does not open Pera or submit a transaction.
                    </p>
                </div>

                <Button
                    type="button"
                    onClick={handlePrepareRelease}
                    disabled={
                        isPreparingRelease ||
                        !isConnected ||
                        !accountAddress ||
                        !selectedIpId
                    }
                >
                    {isPreparingRelease ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Preparing...
                        </>
                    ) : (
                        'Prepare release'
                    )}
                </Button>

                <Button
                type="button"
                onClick={handleSignRelease}
                disabled={
                    isSigningRelease ||
                    !preflightResult?.ok ||
                    !preflightResult?.unsignedGroup ||
                    !preflightResult?.proposedGroup?.groupId
                }
            >
                Sign release
            </Button>

            <Button
                type="button"
                variant="destructive"
                onClick={() => setIsSubmissionDialogOpen(true)}
                disabled={
                    !V7_RELEASE_SUBMISSION_ENABLED ||
                    !signedResult ||
                    !preflightResult?.ok ||
                    signedResult.groupId !== preflightResult.proposedGroup?.groupId ||
                    isSubmittingRelease
                }
            >
                Submit signed release
            </Button>
            </div>

            {preflightError?.length > 0 && (
                <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <p className="mb-2 font-medium">Release preflight blocked</p>

                    <div className="space-y-1">
                        {preflightError.map(({ code, message }, index) => (
                            <p key={`${code}-${index}`}>
                                <span className="font-mono font-medium">{code}:</span>{' '}
                                {message}
                            </p>
                        ))}
                    </div>
                </div>
            )}

            {submissionResult?.outcome && (
    <div
        className={`rounded border p-3 text-sm ${
            submissionResult.outcome === 'confirmed'
                ? 'border-green-200 bg-green-50 text-green-950'
                : submissionResult.outcome === 'pending'
                  ? 'border-yellow-200 bg-yellow-50 text-yellow-950'
                  : submissionResult.outcome === 'disabled'
                    ? 'border-slate-200 bg-slate-50 text-slate-700'
                    : 'border-red-200 bg-red-50 text-red-800'
        }`}
    >
        <p className="font-medium">
            Submission status: {submissionResult.outcome}
        </p>

        {submissionResult.transactionId && (
            <p className="mt-1 break-all font-mono text-xs">
                Transaction ID: {submissionResult.transactionId}
            </p>
        )}

        {submissionResult.confirmedRound && (
            <p className="mt-1 font-mono">
                Confirmed round: {submissionResult.confirmedRound}
            </p>
        )}

        {submissionResult.reasons?.map((reason, index) => (
            <p key={`${reason}-${index}`} className="mt-1">
                {reason}
            </p>
        ))}
    </div>
)}

            {isSubmissionDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <Card className="w-full max-w-2xl">
                        <CardHeader>
                            <CardTitle>Submit signed V7 release?</CardTitle>

                            <CardDescription>
                                This is the final broadcast confirmation. The signed group
                                will first be checked against fresh live state. If any
                                state changed, submission will be rejected.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <div className="grid gap-3 text-sm md:grid-cols-2">
                                <div>
                                    <p className="text-muted-foreground">Pool key</p>
                                    <p className="break-all font-mono">{selectedIpId}</p>
                                </div>

                                <div>
                                    <p className="text-muted-foreground">
                                        Held USDC atomic units
                                    </p>
                                    <p className="font-mono">
                                        {toAtomicUnitsString(
                                            v7SettlementState.poolState
                                                ?.heldUsdcAtomicUnits
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-muted-foreground">Current round</p>
                                    <p className="font-mono">
                                        {preflightResult?.currentRoundId}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-muted-foreground">Next round</p>
                                    <p className="font-mono">
                                        {preflightResult?.nextRoundId}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-muted-foreground">
                                        Required MBR atomic units
                                    </p>
                                    <p className="font-mono">
                                        {preflightResult?.requiredMbrMicroAlgos}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-muted-foreground">
                                        Required outer fees atomic units
                                    </p>
                                    <p className="font-mono">
                                        {preflightResult?.requiredFeesMicroAlgos}
                                    </p>
                                </div>

                                <div className="md:col-span-2">
                                    <p className="text-muted-foreground">
                                        Signed group ID
                                    </p>
                                    <p className="break-all font-mono text-xs">
                                        {signedResult?.groupId}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsSubmissionDialogOpen(false)}
                                    disabled={isSubmittingRelease}
                                >
                                    Cancel
                                </Button>

                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleSubmitSignedRelease}
                                    disabled={isSubmittingRelease}
                                >
                                    {isSubmittingRelease ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        'Submit signed group'
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {preflightResult?.ok && (
                <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-950">
                    <p className="mb-3 font-medium">
                        Release preflight approved — signing is enabled; submission remains disabled
                    </p>

                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <p className="text-xs font-medium text-green-800">
                                Pool key
                            </p>
                            <p className="mt-1 break-all font-mono">
                                {selectedIpId}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-medium text-green-800">
                                Held USDC atomic units
                            </p>
                            <p className="mt-1 break-all font-mono">
                                {toAtomicUnitsString(
                                    v7SettlementState.poolState?.heldUsdcAtomicUnits
                                )}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-medium text-green-800">
                                Current round
                            </p>
                            <p className="mt-1 font-mono">
                                {preflightResult.currentRoundId}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-medium text-green-800">
                                Next round
                            </p>
                            <p className="mt-1 font-mono">
                                {preflightResult.nextRoundId}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-medium text-green-800">
                                Required round MBR atomic units
                            </p>
                            <p className="mt-1 font-mono">
                                {preflightResult.requiredMbrMicroAlgos}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-medium text-green-800">
                                Required outer fees atomic units
                            </p>
                            <p className="mt-1 font-mono">
                                {preflightResult.requiredFeesMicroAlgos}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-medium text-green-800">
                                Total required ALGO atomic units
                            </p>
                            <p className="mt-1 font-mono">
                                {preflightResult.requiredTotalMicroAlgos}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-medium text-green-800">
                                Unsigned transaction count
                            </p>
                            <p className="mt-1 font-mono">
                                {preflightResult.proposedGroup.transactionCount}
                            </p>
                        </div>

                        <div className="md:col-span-2">
                            <p className="text-xs font-medium text-green-800">
                                Approved group ID
                            </p>
                            <p className="mt-1 break-all font-mono text-xs">
                                {preflightResult.proposedGroup.groupId}
                            </p>
                        </div>
                    </div>
                </div>
            )}
            
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
                                Step 1: Prepare recipient snapshot and Step 2: Prepare held USDC deposit
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
                                            Held deposit amount:{' '}
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
                                        A held deposit does not pay recipients. Confirmation,
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
                                    onClick={handleFund}
                                    disabled={
                                        isFunding ||
                                        !isConnected ||
                                        !poolInfo?.isOptedIn ||
                                        !selectedSettlementBatch ||
                                        selectedSettlementBatch.status !==
                                            'recipient_snapshot_prepared'
                                    }
                                >
                                    {isFunding ? (
                                        <Loader2 className="animate-spin" />
                                    ) : (
                                        'Prepare and submit held deposit'
                                    )}
                                    <ArrowRight className="ml-1 h-4 w-4" />
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handlePrepareUnallocatedUsdcDeposit}
                                    disabled={
                                        isFunding ||
                                        !isConnected ||
                                        !poolInfo?.isOptedIn ||
                                        !selectedSettlementBatch ||
                                        selectedSettlementBatch.status !==
                                            'recipient_snapshot_prepared'
                                    }
                                >
                                    {isFunding ? (
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
                                        getPreparedUsdcDepositType(
                                            selectedSettlementBatch.depositAttempt
                                        ) !== 'usdc'
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
                                        'Confirm held deposit'
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
                                First prepare the recipient snapshot to freeze the recipient allocation.
                                Then prepare and submit the held USDC deposit. Depositing funds the
                                pool&apos;s held balance; it does not pay recipients.
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

            <Card>
                <CardHeader>
                    <CardTitle>V7 Release-Held Read State</CardTitle>

                    <CardDescription>
                        Inspect live settlement state for one selected IP asset, then
                        explicitly prepare a release preflight. Preparation does not sign
                        or submit a transaction.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="grid gap-3 text-sm md:grid-cols-2">
                        <div className="rounded border bg-muted p-3">
                            <p className="text-xs font-medium text-muted-foreground">
                                Selected IP asset
                            </p>

                            <p className="mt-1 break-all font-mono">
                                {selectedIpId || 'Select an IP asset above'}
                            </p>
                        </div>

                        <div className="rounded border bg-muted p-3">
                            <p className="text-xs font-medium text-muted-foreground">
                                Revenue-pool app ID
                            </p>

                            <p className="mt-1 font-mono">{appId}</p>
                        </div>
                    </div>

                    {!selectedIpId && (
                        <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                            Select one IP asset in the existing funding panel to
                            load its V7 pool box and active settlement-round
                            state.
                        </div>
                    )}

                    {selectedIpId &&
                        v7SettlementState.status === 'loading' && (
                            <div className="flex items-center gap-2 rounded border bg-muted p-3 text-sm">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Reading V7 pool and active settlement-round
                                state...
                            </div>
                        )}

                    {selectedIpId &&
                        v7SettlementState.status === 'error' && (
                            <div className="flex gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{v7SettlementState.error}</span>
                            </div>
                        )}

                    {selectedIpId &&
                        v7SettlementState.status === 'ready' && (
                            <>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded border p-3">
                                        <p className="text-xs font-medium text-muted-foreground">
                                            Held USDC atomic units
                                        </p>

                                        <p className="mt-1 break-all font-mono text-lg font-bold">
                                            {toAtomicUnitsString(
                                                v7SettlementState.poolState
                                                    ?.heldUsdcAtomicUnits
                                            )}
                                        </p>
                                    </div>

                                    <div className="rounded border p-3">
                                        <p className="text-xs font-medium text-muted-foreground">
                                            Current round ID
                                        </p>

                                        <p className="mt-1 break-all font-mono text-lg font-bold">
                                            {toAtomicUnitsString(
                                                v7SettlementState.poolState
                                                    ?.currentRoundId
                                            )}
                                        </p>
                                    </div>

                                    <div className="rounded border p-3">
                                        <p className="text-xs font-medium text-muted-foreground">
                                            Release status
                                        </p>

                                        <p className="mt-1 font-mono text-lg font-bold">
                                            {v7SettlementState.roundState
                                                ?.releaseStatus || 'unknown'}
                                        </p>
                                    </div>

                                    <div className="rounded border p-3">
                                        <p className="text-xs font-medium text-muted-foreground">
                                            Stakeholder count
                                        </p>

                                        <p className="mt-1 font-mono text-lg font-bold">
                                            {v7SettlementState.poolState
                                                ?.stakeholderCount ?? '0'}
                                        </p>
                                    </div>

                                    <div className="rounded border p-3">
                                        <p className="text-xs font-medium text-muted-foreground">
                                            Pool MBR atomic units
                                        </p>

                                        <p className="mt-1 break-all font-mono text-lg font-bold">
                                            {toAtomicUnitsString(
                                                v7SettlementState.poolMbrAtomicUnits
                                            )}
                                        </p>
                                    </div>

                                    <div className="rounded border p-3">
                                        <p className="text-xs font-medium text-muted-foreground">
                                            Suggested fee per outer transaction
                                        </p>

                                        <p className="mt-1 break-all font-mono text-lg font-bold">
                                            {toAtomicUnitsString(
                                                v7SettlementState.suggestedFeeAtomicUnits
                                            )}
                                        </p>
                                    </div>

                                    <div className="rounded border p-3 md:col-span-2">
                                        <p className="text-xs font-medium text-muted-foreground">
                                            Two-transaction outer-fee baseline
                                            atomic units
                                        </p>

                                        <p className="mt-1 break-all font-mono text-lg font-bold">
                                            {toAtomicUnitsString(
                                                v7SettlementState.outerFeesAtomicUnits
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {v7SettlementState.roundState?.reasons
                                    ?.length > 0 && (
                                    <div className="rounded border bg-muted p-3 text-sm">
                                        <p className="mb-1 font-medium">
                                            Release-state details
                                        </p>

                                        {v7SettlementState.roundState.reasons.map(
                                            (reason) => (
                                                <p
                                                    key={reason}
                                                    className="text-muted-foreground"
                                                >
                                                    {reason}
                                                </p>
                                            )
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                </CardContent>
            </Card>
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
                                        Deposit type
                                    </p>

                                    <p className="mt-1 font-mono">
                                        {getPreparedUsdcDepositType(
                                            selectedSettlementBatch.depositAttempt
                                        ) || 'unknown'}
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
                                getPreparedUsdcDepositType(
                                    selectedSettlementBatch.depositAttempt
                                ) !== 'usdc'
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