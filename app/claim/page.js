'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/lib/WalletContext';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import {
  Wallet,
  Coins,
  DollarSign,
  Loader2,
  RefreshCcw,
  Gift,
} from 'lucide-react';

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
  const [tokenFilter, setTokenFilter] = useState('available');
  const [tokenOverrides, setTokenOverrides] = useState({});
  const tokenOverridesRef = useRef({});
  const tokensAbortRef = useRef(null);
  const poolsAbortRef = useRef(null);
  const tokensInFlightRef = useRef(false);
  const poolsInFlightRef = useRef(false);
  const refreshTimeoutRef = useRef(null);

  useEffect(() => {
    tokenOverridesRef.current = tokenOverrides;
  }, [tokenOverrides]);

  const mergeTokenWithOverride = useCallback((item) => {
    const override = tokenOverridesRef.current[item.ipId];
    if (!override?.forceClaimed) return item;

    const allocated = Number(
      override.allocatedTokens ?? item.allocatedTokens ?? item.stakeholderBps ?? 0
    );

    return {
      ...item,
      status: 'claimed',
      claimableAmount: 0,
      claimableAmountDisplay: '0',
      existingBalance: allocated,
      existingBalanceDisplay: allocated.toLocaleString(),
      claimedAmount: allocated,
      claimedAmountDisplay: allocated.toLocaleString(),
      allocatedTokens: allocated,
      stakeholderBps: allocated,
      needsOptIn: false,
      hasOptedIn: true,
    };
  }, []);

  const fetchClaimableTokens = useCallback(async () => {
    if (!accountAddress || tokensInFlightRef.current) return;

    tokensAbortRef.current?.abort();
    const controller = new AbortController();
    tokensAbortRef.current = controller;
    tokensInFlightRef.current = true;

    try {
      const response = await fetch(
        `/api/revenue-tokens/claimable?userAddress=${accountAddress}`,
        { signal: controller.signal }
      );

      if (response.ok) {
        const data = await response.json();
        const items = data.items || data.claimableTokens || [];

        setClaimableTokens((prev) => {
          const merged = items.map(mergeTokenWithOverride);

          const missingOptimisticItems = prev
            .filter((item) => {
              const hasOverride = tokenOverridesRef.current[item.ipId]?.forceClaimed;
              const stillMissing = !merged.some((next) => next.ipId === item.ipId);
              return hasOverride && stillMissing;
            })
            .map(mergeTokenWithOverride);

          return [...merged, ...missingOptimisticItems];
        });
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching tokens:', error);
      }
    } finally {
      if (tokensAbortRef.current === controller) {
        tokensAbortRef.current = null;
      }
      tokensInFlightRef.current = false;
    }
  }, [accountAddress, mergeTokenWithOverride]);

  const fetchRevenuePools = useCallback(async () => {
    if (!accountAddress || poolsInFlightRef.current) return;

    poolsAbortRef.current?.abort();
    const controller = new AbortController();
    poolsAbortRef.current = controller;
    poolsInFlightRef.current = true;

    try {
      const authHeaders = getAuthHeader();
      const ipResponse = await fetch('/api/ip', {
        headers: authHeaders,
        credentials: 'include',
        signal: controller.signal,
      });
      if (!ipResponse.ok) return;

      const ipResult = await ipResponse.json();
      const ipData = ipResult.ipAssets || (Array.isArray(ipResult) ? ipResult : []);
      const ipsWithPools = ipData.filter((ip) => ip.revenuePoolAppId);

      const poolsWithClaimInfo = [];
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      for (const ip of ipsWithPools) {
        if (controller.signal.aborted) return;

        try {
          const res = await fetch(
            `/api/revenue-pool/claim?appId=${Number(
              ip.revenuePoolAppId
            )}&userAddress=${accountAddress}&ipId=${ip.id}`,
            { signal: controller.signal }
          );

          if (res.ok) {
            const claimInfo = await res.json();
            poolsWithClaimInfo.push({ ...ip, claimInfo });
          } else {
            console.warn(
              '[POOLS] Claim info request failed',
              ip.id,
              res.status
            );
            poolsWithClaimInfo.push({ ...ip, claimInfo: null });
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Error fetching pool claim info:', ip.id, err);
          }
          poolsWithClaimInfo.push({ ...ip, claimInfo: null });
        }

        await sleep(400);
      }

      if (!controller.signal.aborted) {
        setRevenuePools(poolsWithClaimInfo.filter((p) => p.claimInfo));
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching pools:', error);
      }
    } finally {
      if (poolsAbortRef.current === controller) {
        poolsAbortRef.current = null;
      }
      poolsInFlightRef.current = false;
    }
  }, [accountAddress, getAuthHeader]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchClaimableTokens();
      await fetchRevenuePools();
    } finally {
      setIsLoading(false);
    }
  }, [fetchClaimableTokens, fetchRevenuePools]);

  useEffect(() => {
    if (isConnected && accountAddress) {
      fetchData();
    }
  }, [isConnected, accountAddress, fetchData]);

  useEffect(() => {
    return () => {
      tokensAbortRef.current?.abort();
      poolsAbortRef.current?.abort();
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const handleRepairTokens = async () => {
    if (!isAuthenticated) return toast.error('Please sign in first');
    setIsRepairing(true);
    try {
      const res = await fetch('/api/ip/repair-tokens', {
        method: 'POST',
        headers: getAuthHeader(),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.repaired > 0) {
        toast.success(`Repaired ${data.repaired} IPs.`);
        await fetchData();
      } else {
        toast.info('All synced.');
      }
    } catch (e) {
      toast.error('Repair failed');
    } finally {
      setIsRepairing(false);
    }
  };

  const handleClaimTokens = async (token) => {
    if (!isConnected || !accountAddress) {
      console.error('CLAIM BLOCKED: accountAddress is missing.');
      return toast.error('Wallet not fully synced. Please reconnect.');
    }

    setClaimingTokens(token.ipId);
    try {
      const res = await fetch('/api/revenue-tokens/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          {
            userAddress: accountAddress,
            ipId: token.ipId,
          },
          bigintReplacer
        ),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Backend Error');

      const txnsToSign = data.transactions || [data.transaction];

      const signed = await signTransactionGroup(
        txnsToSign.map((t) => new Uint8Array(Buffer.from(t, 'base64')))
      );

      if (!signed || signed.length === 0) throw new Error('Signing cancelled');

      const submit = await fetch('/api/revenue-tokens/claim', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          {
            signedTxns: signed.map((s) => Buffer.from(s).toString('base64')),
            userAddress: accountAddress,
            ipId: token.ipId,
            appId: Number(token.revenuePoolAppId),
          },
          bigintReplacer
        ),
      });

      const submitData = await submit.json().catch(() => null);
      if (!submit.ok) {
        throw new Error(submitData?.error || 'Submission failed');
      }

      

      const nextOverrides = {
        ...tokenOverridesRef.current,
        [token.ipId]: {
          forceClaimed: true,
          allocatedTokens: Number(token.allocatedTokens ?? token.stakeholderBps ?? 0),
          at: Date.now(),
        },
      };

      tokenOverridesRef.current = nextOverrides;
      setTokenOverrides(nextOverrides);

      // Apply the override immediately to the current list
      setClaimableTokens((prev) =>
        prev.map((item) =>
          item.ipId === token.ipId ? mergeTokenWithOverride(item) : item
        )
      );

      toast.success('Claim submitted!');

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        void fetchClaimableTokens();
        void fetchRevenuePools();
      }, 2500);
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
        body: JSON.stringify(
          {
            claimerAddress: accountAddress,
            appId: Number(pool.revenuePoolAppId),
            ipId: pool.id,
            amount: parseInt(amount, 10),
            userTokenBalance: Number(pool.claimInfo?.user?.tokenBalance || 0),
          },
          bigintReplacer
        ),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const signed = await signTransactionGroup([
        new Uint8Array(Buffer.from(data.transaction, 'base64')),
      ]);
      if (!signed?.length) throw new Error('Cancelled');

      const submit = await fetch('/api/revenue-pool/claim', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedTxn: Buffer.from(signed[0]).toString('base64'),
        }),
      });

      const submitData = await submit.json().catch(() => null);
      if (!submit.ok) {
        throw new Error(submitData?.error || 'USDC claim submission failed');
      }

      toast.success('USDC Claimed!');
      await fetchData();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setClaimingRevenue(null);
    }
  };

  const totalClaimableTokens = claimableTokens.reduce(
    (sum, t) => sum + Number(t.claimableAmount || 0),
    0
  );

  const totalOwnedTokens = claimableTokens.reduce(
    (sum, t) => sum + Number(t.existingBalance || 0),
    0
  );

  const totalClaimableUSDC = revenuePools.reduce(
    (sum, p) => sum + Number(p.claimInfo?.user?.claimableAmount || 0),
    0
  );

  const getTokenClaimStatus = (token) => {
    const claiming = claimingTokens === token.ipId;
    if (claiming) return 'claiming';

    if (token.status === 'claimed' || token.onChainClaimed === true) {
      return 'claimed';
    }

    if (token.status === 'available') {
      return 'available';
    }

    if (token.status === 'empty') {
      return 'empty';
    }

    const claimableAmount = Number(token.claimableAmount || 0);
    return claimableAmount > 0 ? 'available' : 'empty';
  };

  const filteredClaimableTokens = claimableTokens.filter((token) => {
    const status = getTokenClaimStatus(token);
    if (tokenFilter === 'available') {
      return status === 'available' || status === 'claiming';
    }
    if (tokenFilter === 'claimed') {
      return status === 'claimed';
    }
    return true;
  });

  const availableTokenCount = claimableTokens.filter(
    (token) => getTokenClaimStatus(token) === 'available'
  ).length;

  const claimedTokenCount = claimableTokens.filter(
    (token) => getTokenClaimStatus(token) === 'claimed'
  ).length;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Coins className="text-primary" />
            Revenue & Tokens
          </h1>
          <p className="text-muted-foreground">
            Manage your IP equity and claim revenue
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRepairTokens}
            disabled={isRepairing}
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            {isRepairing ? 'Repairing...' : 'Repair'}
          </Button>

          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {!isConnected ? (
        <Card className="py-12 text-center">
          <CardContent>
            <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <Button size="lg" onClick={connect}>
              Connect Wallet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Coins className="text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalOwnedTokens.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Owned</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Gift className="text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {totalClaimableTokens.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Claimable</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <DollarSign className="text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    ${(totalClaimableUSDC / 1000000).toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">USDC</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tokens">Tokens</TabsTrigger>
              <TabsTrigger value="pools">USDC Pools</TabsTrigger>
            </TabsList>

            <TabsContent value="tokens" className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={tokenFilter === 'available' ? 'default' : 'outline'}
                  onClick={() => setTokenFilter('available')}
                  className="min-w-[120px]"
                >
                  Available ({availableTokenCount})
                </Button>

                <Button
                  type="button"
                  variant={tokenFilter === 'claimed' ? 'default' : 'outline'}
                  onClick={() => setTokenFilter('claimed')}
                  className="min-w-[120px]"
                >
                  Claimed ({claimedTokenCount})
                </Button>

                <Button
                  type="button"
                  variant={tokenFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setTokenFilter('all')}
                  className="min-w-[100px]"
                >
                  All ({claimableTokens.length})
                </Button>
              </div>

              {filteredClaimableTokens.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <p className="text-muted-foreground">
                      {tokenFilter === 'available'
                        ? 'No claimable tokens right now.'
                        : tokenFilter === 'claimed'
                        ? 'No claimed token entries yet.'
                        : 'No token entries found.'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredClaimableTokens.map((t) => {
                  const status = getTokenClaimStatus(t);
                  const claimableAmount = Number(t.claimableAmount || 0);
                  const existingBalance = Number(t.existingBalance || 0);
                  const stakeholderBps = Number(t.stakeholderBps || 0);
                  const claimedAmount =
                    Number(t.claimedAmount ?? (status === 'claimed'
                      ? stakeholderBps
                      : Math.min(existingBalance, stakeholderBps)));

                  return (
                    <Card key={t.ipId}>
                      <CardContent className="p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4 min-w-0">
                          {t.imageUrl ? (
                            <img
                              src={t.imageUrl}
                              alt={t.ipName}
                              className="w-12 h-12 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex-shrink-0" />
                          )}

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold truncate">{t.ipName}</h3>

                              <Badge
                                variant="secondary"
                                className={
                                  status === 'claiming'
                                    ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                                    : status === 'claimed'
                                    ? 'bg-green-500/15 text-green-400 border-green-500/30'
                                    : status === 'available'
                                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                    : 'bg-muted text-muted-foreground border-border'
                                }
                              >
                                {status === 'claiming'
                                  ? 'Claiming'
                                  : status === 'claimed'
                                  ? 'Claimed'
                                  : status === 'available'
                                  ? 'Available'
                                  : 'Nothing to claim'}
                              </Badge>
                            </div>

                            <p className="text-sm text-muted-foreground">
                              Share: {t.stakeholderPercentage}%
                            </p>

                            <p className="text-sm text-muted-foreground">
                              Claimed:{' '}
                              {claimedAmount.toLocaleString()} /{' '}
                              {stakeholderBps.toLocaleString()}
                            </p>

                            {claimableAmount > 0 && (
                              <p className="text-sm text-primary font-medium">
                                Ready to claim: {claimableAmount.toLocaleString()} REV
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="w-full md:w-auto">
                          {status === 'available' ? (
                            <Button
                              onClick={() => handleClaimTokens(t)}
                              className="w-full md:min-w-[150px]"
                            >
                              Claim Tokens
                            </Button>
                          ) : status === 'claiming' ? (
                            <Button disabled className="w-full md:min-w-[150px]">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Claiming...
                            </Button>
                          ) : status === 'claimed' ? (
                            <Button
                              disabled
                              variant="secondary"
                              className="w-full md:min-w-[150px]"
                            >
                              Claimed
                            </Button>
                          ) : (
                            <Button
                              disabled
                              variant="outline"
                              className="w-full md:min-w-[150px]"
                            >
                              Nothing to claim
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="pools" className="space-y-4">
              {revenuePools.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <p className="text-muted-foreground">
                      No active revenue pools found.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                revenuePools.map((p) => {
                  const userTokenBalance = Number(p.claimInfo?.user?.tokenBalance || 0);
                  const claimableAmount = Number(p.claimInfo?.user?.claimableAmount || 0);
                  const claimableFormatted =
                    p.claimInfo?.user?.claimableFormatted || '0.00';
                  const poolBalanceFormatted =
                    p.claimInfo?.pool?.balanceFormatted || '0.00';
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
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-lg font-semibold leading-tight">
                                {p.name}
                              </h3>
                              <Badge
                                variant="secondary"
                                className={
                                  claimableAmount > 0
                                    ? 'bg-green-500/15 text-green-400 border-green-500/30'
                                    : 'bg-muted text-muted-foreground border-border'
                                }
                              >
                                {claimableAmount > 0 ? 'Claim available' : 'Nothing to claim'}
                              </Badge>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <div className="min-w-0 rounded-lg border bg-background/60 px-3 py-3">
                                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                  Pool Balance
                                </p>
                                <p className="mt-1 truncate text-sm font-semibold">
                                  ${poolBalanceFormatted}
                                </p>
                              </div>

                              <div className="min-w-0 rounded-lg border bg-background/60 px-3 py-3">
                                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                  Your Share
                                </p>
                                <p className="mt-1 truncate text-sm font-semibold">
                                  {userTokenBalance.toLocaleString()} / 10000
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
                              ) : claimableAmount > 0 ? (
                                `Claim $${claimableFormatted}`
                              ) : (
                                'Nothing to claim'
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