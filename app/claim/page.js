'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useWallet } from '@/lib/WalletContext';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import {
  Wallet,
  Coins,
  DollarSign,
  Loader2,
  RefreshCcw,
  ExternalLink,
  AlertCircle,
  Gift
} from 'lucide-react';
import algosdk from 'algosdk';

const bigintReplacer = (_key, value) =>
  typeof value === 'bigint' ? value.toString() : value;

export default function ClaimPage() {
  const { accountAddress, isConnected, connect, signTransactionGroup } = useWallet();
  const { getAuthHeader, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState('tokens');
  const [isLoading, setIsLoading] = useState(false);
  const [claimableTokens, setClaimableTokens] = useState([]);
  const [revenuePools, setRevenuePools] = useState([]);
  const [claimingTokens, setClaimingTokens] = useState(null);
  const [claimingRevenue, setClaimingRevenue] = useState(null);
  const [claimAmounts, setClaimAmounts] = useState({});
  const [isRepairing, setIsRepairing] = useState(false);
  const [uninitializedIPs, setUninitializedIPs] = useState([]);
  const [reinitializingIP, setReinitializingIP] = useState(null);

  const fetchClaimableTokens = useCallback(async () => {
    if (!accountAddress) return;
    try {
      const response = await fetch(`/api/revenue-tokens/claimable?userAddress=${accountAddress}`);
      if (response.ok) {
        const data = await response.json();
        setClaimableTokens(data.items || data.claimableTokens || []);
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
    }
  }, [accountAddress]);

  const fetchRevenuePools = useCallback(async () => {
    if (!accountAddress) return;
    try {
      const authHeaders = getAuthHeader();
      const ipResponse = await fetch('/api/ip', { headers: authHeaders, credentials: 'include' });
      if (!ipResponse.ok) return;

      const ipResult = await ipResponse.json();
      const ipData = ipResult.ipAssets || (Array.isArray(ipResult) ? ipResult : []);
      const ipsWithPools = ipData.filter(ip => ip.revenuePoolAppId);

      const needsReinit = ipsWithPools.filter(ip => !(ip.revenueTokenAssetId ?? ip.revenueTokenId));
      setUninitializedIPs(needsReinit);

      const poolsWithClaimInfo = await Promise.all(
        ipsWithPools.map(async (ip) => {
          try {
            const res = await fetch(`/api/revenue-pool/claim?appId=${Number(ip.revenuePoolAppId)}&userAddress=${accountAddress}&ipId=${ip.id}`);
            if (res.ok) return { ...ip, claimInfo: await res.json() };
          } catch (err) {}
          return { ...ip, claimInfo: null };
        })
      );
      setRevenuePools(poolsWithClaimInfo.filter(p => p.claimInfo));
    } catch (error) {
      console.error('Error fetching pools:', error);
    }
  }, [accountAddress, getAuthHeader]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchClaimableTokens(), fetchRevenuePools()]);
    setIsLoading(false);
  }, [fetchClaimableTokens, fetchRevenuePools]);

  useEffect(() => {
    if (isConnected && accountAddress) fetchData();
  }, [isConnected, accountAddress, fetchData]);

  const handleRepairTokens = async () => {
    if (!isAuthenticated) return toast.error('Please sign in first');
    setIsRepairing(true);
    try {
      const res = await fetch('/api/ip/repair-tokens', { method: 'POST', headers: getAuthHeader(), credentials: 'include' });
      const data = await res.json();
      if (data.repaired > 0) { toast.success(`Repaired ${data.repaired} IPs.`); await fetchData(); }
      else toast.info('All synced.');
    } catch (e) { toast.error('Repair failed'); } finally { setIsRepairing(false); }
  };

  const handleReinitializePool = async (ip) => {
    if (!isConnected) return toast.error('Please connect your wallet');
    setReinitializingIP(ip.id);
    try {
      const res = await fetch('/api/ip/reinitialize-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        credentials: 'include',
        body: JSON.stringify({ ipAssetId: ip.id }, bigintReplacer)
      });
      const data = await res.json();
      if (data.transactions) {
        const signed = await signTransactionGroup(data.transactions.map(t => new Uint8Array(Buffer.from(t, 'base64'))));
        await fetch('/api/ip/reinitialize-pool', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          credentials: 'include',
          body: JSON.stringify({ ipAssetId: ip.id, signedTxns: signed.map(s => Buffer.from(s).toString('base64')) })
        });
        toast.success('Pool Initialized!');
        await fetchData();
      }
    } catch (e) { toast.error(e.message); } finally { setReinitializingIP(null); }
  };

  // --- ATOMIC CLAIM HANDLER (FIXED) ---
  const handleClaimTokens = async (token) => {
    // GLOBAL FIX 1: Prevent execution if state is not ready
    if (!isConnected || !accountAddress) {
      console.error("CLAIM BLOCKED: accountAddress is missing.");
      return toast.error('Wallet not fully synced. Please reconnect.');
    }

    setClaimingTokens(token.ipId);
    try {
      const res = await fetch('/api/revenue-tokens/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Use userAddress key to match the backend extraction logic
        body: JSON.stringify({ 
          userAddress: accountAddress, 
          ipId: token.ipId 
        }, bigintReplacer)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Backend Error');

      const txnsToSign = data.transactions || [data.transaction];

      const signed = await signTransactionGroup(
        txnsToSign.map(t => algosdk.decodeUnsignedTransaction(Buffer.from(t, 'base64')))
      );

      if (!signed || signed.length === 0) throw new Error('Signing cancelled');

      const submit = await fetch('/api/revenue-tokens/claim', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          signedTxns: signed.map(s => Buffer.from(s).toString('base64')) 
        }, bigintReplacer)
      });

      if (!submit.ok) throw new Error('Submission failed');

      toast.success('Tokens Claimed!');
      await fetchData();
    } catch (e) {
      console.error('Final Point of Failure:', e);
      toast.error(e.message);
    } finally {
      setClaimingTokens(null);
    }
  };

  const handleClaimRevenue = async (pool) => {
    if (!isConnected || !accountAddress) return toast.error('Connect wallet');
    const amount = claimAmounts[pool.id] || pool.claimInfo?.user?.claimableAmount;
    if (!amount) return toast.error('Nothing to claim');
    setClaimingRevenue(pool.id);
    try {
      const res = await fetch('/api/revenue-pool/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimerAddress: accountAddress,
          appId: Number(pool.revenuePoolAppId),
          ipId: pool.id,
          amount: parseInt(amount),
          userTokenBalance: Number(pool.claimInfo?.user?.tokenBalance || 0)
        }, bigintReplacer)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const signed = await signTransactionGroup([new Uint8Array(Buffer.from(data.transaction, 'base64'))]);
      if (!signed?.length) throw new Error('Cancelled');

      await fetch('/api/revenue-pool/claim', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedTxn: Buffer.from(signed[0]).toString('base64') })
      });
      toast.success('USDC Claimed!');
      await fetchData();
    } catch (e) { toast.error(e.message); } finally { setClaimingRevenue(null); }
  };

  const totalClaimableTokens = claimableTokens.reduce((sum, t) => sum + (t.claimableAmount || 0), 0);
  const totalOwnedTokens = claimableTokens.reduce((sum, t) => sum + (t.existingBalance || 0), 0);
  const totalClaimableUSDC = revenuePools.reduce((sum, p) => sum + (p.claimInfo?.user?.claimableAmount || 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><Coins className="text-primary" /> Revenue & Tokens</h1>
          <p className="text-muted-foreground">Manage your IP equity and claim revenue</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRepairTokens} disabled={isRepairing}><RefreshCcw className="w-4 h-4 mr-2" /> Repair</Button>
          <Button variant="outline" size="sm" onClick={fetchData}>Refresh</Button>
        </div>
      </div>

      {!isConnected ? (
        <Card className="py-12 text-center">
            <CardContent>
                <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <Button size="lg" onClick={connect}>Connect Wallet</Button>
            </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full"><Coins className="text-blue-600" /></div>
              <div><p className="text-2xl font-bold">{totalOwnedTokens}</p><p className="text-sm text-muted-foreground">Owned</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-full"><Gift className="text-yellow-600" /></div>
              <div><p className="text-2xl font-bold">{totalClaimableTokens}</p><p className="text-sm text-muted-foreground">Claimable</p></div>
            </CardContent></Card>
            <Card><CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full"><DollarSign className="text-green-600" /></div>
              <div><p className="text-2xl font-bold">${(totalClaimableUSDC / 1000000).toFixed(2)}</p><p className="text-sm text-muted-foreground">USDC</p></div>
            </CardContent></Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="tokens">Tokens</TabsTrigger><TabsTrigger value="pools">USDC Pools</TabsTrigger></TabsList>
            <TabsContent value="tokens" className="space-y-4">
              {claimableTokens.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No claimable tokens found.</p>
              ) : (
                claimableTokens.map(t => (
                  <Card key={t.ipId}><CardContent className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      {t.imageUrl && <img src={t.imageUrl} className="w-12 h-12 rounded object-cover" />}
                      <div><h3 className="font-bold">{t.ipName}</h3><p className="text-sm text-muted-foreground">Share: {t.stakeholderPercentage}%</p></div>
                    </div>
                    <Button onClick={() => handleClaimTokens(t)} disabled={claimingTokens === t.ipId}>
                      {claimingTokens === t.ipId ? <Loader2 className="animate-spin" /> : 'Claim Tokens'}
                    </Button>
                  </CardContent></Card>
                ))
              )}
            </TabsContent>
            <TabsContent value="pools" className="space-y-4">
              {revenuePools.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No active pools found.</p>
              ) : (
                revenuePools.map((p) => {
                  const userTokenBalance = Number(p.claimInfo?.user?.tokenBalance || 0);
                  const claimableAmount = Number(p.claimInfo?.user?.claimableAmount || 0);
                  const claimableFormatted = p.claimInfo?.user?.claimableFormatted || '0.00';
                  const poolBalanceFormatted = p.claimInfo?.pool?.balanceFormatted || '0.00';
                  const isClaiming = claimingRevenue === p.id;
                  const isDisabled = isClaiming || claimableAmount <= 0;

                  return (
                    <Card key={p.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="grid min-h-[132px] grid-cols-1 md:grid-cols-[96px_minmax(0,1fr)_180px]">
                          <div className="flex items-center justify-center border-b bg-muted/20 p-4 md:border-b-0 md:border-r">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="h-16 w-16 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="h-16 w-16 rounded-xl bg-muted" />
                            )}
                          </div>

                          <div className="flex min-w-0 flex-col justify-center p-4 md:p-5">
                            <h3 className="truncate text-lg font-semibold leading-tight">{p.name}</h3>

                            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <div className="min-w-0 rounded-lg border bg-background/60 px-3 py-3">
                                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                  Pool Balance
                                </p>
                                <p className="mt-1 truncate text-sm font-semibold">
                                  {poolBalanceFormatted}
                                </p>
                              </div>

                              <div className="min-w-0 rounded-lg border bg-background/60 px-3 py-3">
                                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                  Your Share
                                </p>
                                <p className="mt-1 truncate text-sm font-semibold">
                                  {userTokenBalance} / 100
                                </p>
                              </div>

                              <div className="min-w-0 rounded-lg border bg-background/60 px-3 py-3">
                                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                  Claimable
                                </p>
                                <p className="mt-1 truncate text-sm font-semibold">
                                  ${claimableFormatted} USDC
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-center border-t bg-muted/10 p-4 md:border-l md:border-t-0">
                            <Button
                              onClick={() => handleClaimRevenue(p)}
                              disabled={isDisabled}
                              className="h-11 w-full md:w-[148px]"
                            >
                              {isClaiming ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                `Claim $${claimableAmount > 0 ? claimableFormatted : '0.00'}`
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}