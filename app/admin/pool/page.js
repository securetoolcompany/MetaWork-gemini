'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/lib/WalletContext';
import { useAuth } from '@/lib/AuthContext';
import algosdk from 'algosdk';
import { toast } from 'sonner';
import { Loader2, Coins, ArrowRight, ShieldCheck, Wallet, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Use the ID we confirmed
const USDC_ID = 10458941;

export default function PoolAdminPage() {
    const { accountAddress, isConnected, connect, signTransactionGroup } = useWallet();
    const { getAuthHeader } = useAuth();

    // State
    const [poolInfo, setPoolInfo] = useState(null);
    const [userInfo, setUserInfo] = useState({ algo: 0, usdc: 0 });
    const [ips, setIps] = useState([]);
    const [selectedIpId, setSelectedIpId] = useState('');

    // Loading Flags
    const [isFunding, setIsFunding] = useState(false);
    const [isOptingIn, setIsOptingIn] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Inputs
    const [fundAmount, setFundAmount] = useState('');
    const [secret, setSecret] = useState('');

    const appId = process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID;

    // --- HELPER: Safely Decode App Address ---
    const getSafeAppAddress = (id) => {
        if (!id) return '';
        try {
            const addr = algosdk.getApplicationAddress(parseInt(id));
            if (typeof addr === 'object' && addr.publicKey) {
                return algosdk.encodeAddress(addr.publicKey);
            }
            return String(addr);
        } catch (e) { return ''; }
    };

    const appAddress = getSafeAppAddress(appId);

    // --- HELPER: Robust Asset Finder ---
    const findAsset = (assets, targetId) => {
        if (!assets) return null;
        return assets.find(a => {
            // Check all possible key names the SDK might use
            const id = a['asset-id'] || a.assetId || a.index || a.id;
            return Number(id) === targetId;
        });
    };

    // --- 1. FETCH DATA ---
    const fetchData = useCallback(async () => {
        if (!appId || !appAddress) return;
        setIsRefreshing(true); 
        const algod = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');

        try {
            // A. Pool Info
            const poolAcct = await algod.accountInformation(appAddress).do();
            const poolUsdc = findAsset(poolAcct.assets, USDC_ID);

            setPoolInfo({
                algoBalance: Number(poolAcct.amount) / 1000000,
                usdcBalance: poolUsdc ? Number(poolUsdc.amount) / 1000000 : 0,
                isOptedIn: !!poolUsdc
            });

            // B. User Info
            if (accountAddress) {
                const userAcct = await algod.accountInformation(accountAddress).do();
                const userUsdc = findAsset(userAcct.assets, USDC_ID);

                setUserInfo({
                    algo: Number(userAcct.amount) / 1000000,
                    usdc: userUsdc ? Number(userUsdc.amount) / 1000000 : 0
                });
            }

            // C. Fetch IPs
            const ipRes = await fetch('/api/ip', { headers: getAuthHeader() });
            if (ipRes.ok) {
                const ipData = await ipRes.json();
                const assets = ipData.ipAssets || [];

                // NEW: Show ALL IPs so I can fund them during testing
                setIps(assets); 
            }

        } catch (e) {
            console.error("Fetch Error:", e);
            toast.error("Failed to refresh data: " + e.message);
        } finally {
            setIsRefreshing(false);
        }
    }, [appAddress, appId, accountAddress, getAuthHeader]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // --- 2. OPT-IN HANDLER ---
    const handleOptIn = async () => {
        if (!secret) return toast.error("Enter Admin Secret");
        setIsOptingIn(true);
        try {
            const res = await fetch('/api/admin/pool/optin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success("Pool Opted-In successfully!");
            fetchData();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setIsOptingIn(false);
        }
    };

    // --- 3. FUND HANDLER ---
    const handleFund = async () => {
        if (!isConnected) return toast.error("Connect Wallet");
        if (!selectedIpId) return toast.error("Select an IP to fund");
        if (!fundAmount || parseFloat(fundAmount) <= 0) return toast.error("Enter valid amount");

        setIsFunding(true);
        try {
            const algod = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
            const params = await algod.getTransactionParams().do();

            // Safe BigInt math for USDC (6 decimals)
            const amountUnits = BigInt(Math.floor(parseFloat(fundAmount) * 1000000)); 

            // Txn 1: Transfer USDC to Pool
            const payTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                sender: accountAddress,
                receiver: appAddress,
                amount: amountUnits, 
                assetIndex: USDC_ID,
                suggestedParams: params
            });

            // Txn 2: Notify Contract
            const boxName = new Uint8Array(Buffer.concat([Buffer.from("p_"), Buffer.from(selectedIpId)]));
            const appTxn = algosdk.makeApplicationNoOpTxnFromObject({
                sender: accountAddress,
                appIndex: parseInt(appId),
                appArgs: [
                    new Uint8Array(Buffer.from("deposit")),
                    new Uint8Array(Buffer.from(selectedIpId))
                ],
                boxes: [{ appIndex: parseInt(appId), name: boxName }],
                foreignAssets: [USDC_ID],
                suggestedParams: params
            });

            algosdk.assignGroupID([payTxn, appTxn]);

            const signed = await signTransactionGroup([
                algosdk.encodeUnsignedTransaction(payTxn),
                algosdk.encodeUnsignedTransaction(appTxn)
            ]);

            if (!signed) throw new Error("Transaction cancelled");

            const { txId } = await algod.sendRawTransaction(signed).do();
            toast.success(`Funded IP with ${fundAmount} USDC!`);

            setFundAmount('');
            setTimeout(fetchData, 4000);

        } catch (e) {
            console.error(e);
            if (e.message && e.message.includes("message channel closed")) {
                toast.error("Wallet Connection Lost. Please unlock your wallet extension.");
            } else {
                toast.error(e.message || "Funding failed");
            }
        } finally {
            setIsFunding(false);
        }
    };

    if (!appId) return <div className="p-8">Error: NEXT_PUBLIC_REVENUE_POOL_APP_ID not set</div>;

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-8">
            <h1 className="text-3xl font-bold flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-blue-600"/> Pool Admin
            </h1>

            {/* WALLET STATUS CARD */}
            <Card className="bg-slate-50 border-slate-200">
                <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-full border shadow-sm">
                            <Wallet className="w-6 h-6 text-slate-500"/>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Your Wallet Balance</p>
                            <div className="font-bold flex gap-4 items-center text-lg">
                                <span>{userInfo.algo.toFixed(2)} ALGO</span>
                                <span className={userInfo.usdc > 0 ? "text-green-600" : "text-red-500"}>
                                    {userInfo.usdc.toFixed(2)} USDC
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        {!isConnected ? (
                            <Button onClick={connect}>Connect Wallet</Button>
                        ) : (
                            <Button 
                                variant="outline" 
                                onClick={fetchData} 
                                disabled={isRefreshing}
                            >
                                {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <RefreshCw className="w-4 h-4 mr-2"/>}
                                Refresh
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                {/* LEFT: POOL STATUS */}
                <Card>
                    <CardHeader>
                        <CardTitle>Pool Contract</CardTitle>
                        <CardDescription className="font-mono text-xs break-all bg-muted p-2 rounded mt-2">
                            {appAddress}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-green-50 text-green-800 rounded border border-green-100">
                            <span className="flex items-center gap-2"><Coins className="w-4 h-4"/> Pool Total USDC</span>
                            <span className="font-bold font-mono text-xl">${poolInfo?.usdcBalance.toFixed(2) || '0.00'}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted rounded">
                            <span className="text-muted-foreground">USDC Opt-In</span>
                            {poolInfo?.isOptedIn ? 
                                <span className="text-green-600 font-bold flex items-center gap-1"><ShieldCheck className="w-4 h-4"/> Active</span> : 
                                <span className="text-red-500 font-bold">Inactive</span>
                            }
                        </div>
                    </CardContent>
                </Card>

                {/* RIGHT: ACTIONS */}
                <Card>
                    <CardHeader>
                        <CardTitle>Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {/* 1. INITIALIZE (OPT-IN) */}
                        {!poolInfo?.isOptedIn && (
                            <div className="space-y-2 border-b pb-6">
                                <h3 className="font-medium flex items-center gap-2 text-yellow-600">
                                    <ShieldCheck className="w-4 h-4"/> Step 1: Initialize Pool
                                </h3>
                                <div className="flex gap-2">
                                    <Input 
                                        type="password" 
                                        placeholder="Admin Secret" 
                                        value={secret} 
                                        onChange={e => setSecret(e.target.value)} 
                                    />
                                    <Button onClick={handleOptIn} disabled={isOptingIn}>
                                        {isOptingIn ? <Loader2 className="animate-spin"/> : 'Opt-In USDC'}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">This enables the pool to hold USDC.</p>
                            </div>
                        )}

                        {/* 2. FUND REVENUE */}
                        <div className="space-y-3">
                             <h3 className="font-medium flex items-center gap-2 text-green-600">
                                <Coins className="w-4 h-4"/> Step 2: Fund IP Revenue
                            </h3>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Select IP to Fund</label>
                                <Select onValueChange={setSelectedIpId} value={selectedIpId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select IP Asset..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ips.map(ip => (
                                            <SelectItem key={ip.id} value={ip.id}>
                                                {ip.name} (Token ID: {ip.revenueTokenAssetId})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex gap-2">
                                <Input 
                                    type="number" 
                                    placeholder="Amount (USDC)" 
                                    value={fundAmount} 
                                    onChange={e => setFundAmount(e.target.value)} 
                                />
                                <Button onClick={handleFund} disabled={isFunding || !isConnected || !poolInfo?.isOptedIn || !selectedIpId}>
                                    {isFunding ? <Loader2 className="animate-spin"/> : 'Send'} <ArrowRight className="w-4 h-4 ml-1"/>
                                </Button>
                            </div>

                            {/* Alert if balance low */}
                            {userInfo.usdc === 0 && isConnected && (
                                <div className="p-2 bg-red-50 text-red-600 text-xs rounded flex gap-2">
                                    <AlertCircle className="w-4 h-4"/>
                                    <span>You have 0 USDC. Go to Tinyman Testnet to swap ALGO for USDC ({USDC_ID}).</span>
                                </div>
                            )}
                        </div>

                    </CardContent>
                </Card>
            </div>
        </div>
    );
}