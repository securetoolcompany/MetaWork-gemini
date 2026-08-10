'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/lib/WalletContext';
import { useAuth } from '@/lib/AuthContext';
import algosdk from 'algosdk';
import { readV7PoolState } from '@/lib/revenue-pool-v7-pool-state';
import { readV7ActiveRoundState } from '@/lib/revenue-pool-v7-round-state';
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

    const [v7SettlementState, setV7SettlementState] = useState({
        status: 'idle',
        error: null,
        suggestedFeeAtomicUnits: null,
        outerFeesAtomicUnits: null,
        poolMbrAtomicUnits: null,
        poolState: null,
        roundState: null,
    });

    const [isFunding, setIsFunding] = useState(false);
    const [isOptingIn, setIsOptingIn] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [fundAmount, setFundAmount] = useState('');
    const [secret, setSecret] = useState('');

    const appId = process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID;

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

    const handleFund = async () => {
        if (!isConnected) {
            return toast.error('Connect Wallet');
        }

        if (!selectedIpId) {
            return toast.error('Select an IP to fund');
        }

        if (!fundAmount || parseFloat(fundAmount) <= 0) {
            return toast.error('Enter valid amount');
        }

        setIsFunding(true);

        try {
            const algod = new algosdk.Algodv2(
                '',
                'https://testnet-api.algonode.cloud',
                ''
            );

            const params = await algod.getTransactionParams().do();
            const amountUnits = BigInt(
                Math.floor(parseFloat(fundAmount) * 1000000)
            );

            const payTxn =
                algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                    sender: accountAddress,
                    receiver: appAddress,
                    amount: amountUnits,
                    assetIndex: USDC_ASSET_ID,
                    suggestedParams: params,
                });

            const boxName = new Uint8Array(
                Buffer.concat([
                    Buffer.from('p_'),
                    Buffer.from(selectedIpId),
                ])
            );

            const appTxn = algosdk.makeApplicationNoOpTxnFromObject({
                sender: accountAddress,
                appIndex: parseInt(appId, 10),
                appArgs: [
                    new Uint8Array(Buffer.from('deposit')),
                    new Uint8Array(Buffer.from(selectedIpId)),
                ],
                boxes: [
                    {
                        appIndex: parseInt(appId, 10),
                        name: boxName,
                    },
                ],
                foreignAssets: [USDC_ASSET_ID],
                suggestedParams: params,
            });

            algosdk.assignGroupID([payTxn, appTxn]);

            const signed = await signTransactionGroup([
                algosdk.encodeUnsignedTransaction(payTxn),
                algosdk.encodeUnsignedTransaction(appTxn),
            ]);

            if (!signed) {
                throw new Error('Transaction cancelled');
            }

            await algod.sendRawTransaction(signed).do();

            toast.success(`Funded IP with ${fundAmount} USDC!`);
            setFundAmount('');
            setTimeout(fetchData, 4000);
        } catch (error) {
            console.error(error);

            if (
                error.message &&
                error.message.includes('message channel closed')
            ) {
                toast.error(
                    'Wallet Connection Lost. Please unlock your wallet extension.'
                );
            } else {
                toast.error(error.message || 'Funding failed');
            }
        } finally {
            setIsFunding(false);
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
                                Step 2: Fund IP Revenue
                            </h3>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">
                                    Select IP to Fund
                                </label>

                                <Select
                                    onValueChange={setSelectedIpId}
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
                            </div>

                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    placeholder="Amount (USDC)"
                                    value={fundAmount}
                                    onChange={(event) =>
                                        setFundAmount(event.target.value)
                                    }
                                />

                                <Button
                                    onClick={handleFund}
                                    disabled={
                                        isFunding ||
                                        !isConnected ||
                                        !poolInfo?.isOptedIn ||
                                        !selectedIpId
                                    }
                                >
                                    {isFunding ? (
                                        <Loader2 className="animate-spin" />
                                    ) : (
                                        'Send'
                                    )}
                                    <ArrowRight className="ml-1 h-4 w-4" />
                                </Button>
                            </div>

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
                        Read-only settlement state for the selected IP asset. No
                        release, signing, or submission action is available in
                        this phase.
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
        </div>
    );
}