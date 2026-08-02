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

const CURRENT_REVENUE_POOL_APP_ID = Number(
  process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID || 768287773
);

const resolvePoolIpId = (item) =>
  String(
    item?.ipId ||
      item?.tokenizedIpId ||
      item?.assetId ||
      item?.id ||
      item?._id ||
      ''
  );

const resolveIpImage = (item) =>
  item?.imageUrl ||
  item?.image ||
  item?.thumbnailUrl ||
  item?.thumbnail ||
  item?.previewImage ||
  item?.coverImage ||
  item?.fileUrl ||
  item?.mediaUrl ||
  null;

const bigintReplacer = (_key, value) =>
  typeof value === 'bigint' ? value.toString() : value;

export default function ClaimPage() {
  const { accountAddress, isConnected, connect, signTransactionGroup } =
    useWallet();
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
  const usdcOptInCacheRef = useRef(new Map());

  useEffect(() => {
    tokenOverridesRef.current = tokenOverrides;
  }, [tokenOverrides]);

  const USDC_OPTIN_CACHE_TTL_MS = 30_000;

  async function getUsdcOptInStatus(userAddress) {
    const cached = usdcOptInCacheRef.current.get(userAddress);
    if (
      cached &&
      Date.now() - cached.checkedAt < USDC_OPTIN_CACHE_TTL_MS
    ) {
      return cached;
    }

    const res = await fetch(
      `/api/wallet/assets?userAddress=${encodeURIComponent(userAddress)}`,
      { method: 'GET', credentials: 'include' }
    );

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || 'Failed to check USDC opt-in');
    }

    const status = {
      optedIn: Boolean(data?.optedIn),
      assetId: Number(data?.usdcAssetId || 0),
      checkedAt: Date.now(),
    };

    usdcOptInCacheRef.current.set(userAddress, status);
    return status;
  }

  async function getUsdcOptInTxn(userAddress) {
    if (!userAddress) {
      throw new Error('Wallet address missing for USDC opt-in');
    }

    const res = await fetch('/api/revenue-pool/usdc-optin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userAddress }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || 'Failed to prepare USDC opt-in transaction');
    }

    if (!data?.transaction) {
      throw new Error('USDC opt-in transaction was not returned');
    }

    return {
      transaction: data.transaction,
      assetId: Number(data?.assetId || 0),
    };
  }

  // ── Revenue-token (REV ASA) opt-in helpers ──────────────────────────────────

  async function getRevenueTokenOptInTxn(userAddress, revenueTokenId) {
    const res = await fetch('/api/revenue-tokens/optin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userAddress, revenueTokenId }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Failed to prepare revenue token opt-in');
    if (!data?.transaction) throw new Error('Revenue token opt-in transaction was not returned');

    return {
      transaction: data.transaction,
      revenueTokenId: Number(data?.revenueTokenId || revenueTokenId || 0),
    };
  }

  async function submitRevenueTokenOptIn({ signedTxn, userAddress, revenueTokenId }) {
    const res = await fetch('/api/revenue-tokens/optin', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ signedTxn, userAddress, revenueTokenId }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Revenue token opt-in submission failed');
    return data;
  }

  // ────────────────────────────────────────────────────────────────────────────

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
      const poolsWithClaimInfo = [];

      // ── 1) Creator/IP-based pools via /api/ip ──────────────────────────────
      const ipResponse = await fetch('/api/ip', {
        headers: authHeaders,
        credentials: 'include',
        signal: controller.signal,
      });
      if (ipResponse.ok) {
        const ipResult = await ipResponse.json();
        const ipData =
          ipResult.ipAssets || (Array.isArray(ipResult) ? ipResult : []);
        const ipsWithPools = ipData.filter(
          (ip) =>
            Number(ip.revenuePoolAppId) === CURRENT_REVENUE_POOL_APP_ID
        );

        console.log(
          '[POOLS] ipsWithPools',
          ipsWithPools.map((ip) => ({
            name: ip.name,
            _id: ip._id,
            mongoId: ip.mongoId,
            id: ip.id,
            ipId: ip.ipId,
            tokenizedIpId: ip.tokenizedIpId,
            assetId: ip.assetId,
            revenuePoolAppId: ip.revenuePoolAppId,
            revenuePool: ip.revenuePool,
          }))
        );

        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

        for (const ip of ipsWithPools) {
          if (controller.signal.aborted) return;

          const resolvedIpId = resolvePoolIpId(ip);

          console.log('[POOLS] resolving ip id', {
            name: ip.name,
            _id: ip._id,
            id: ip.id,
            ipId: ip.ipId,
            tokenizedIpId: ip.tokenizedIpId,
            resolvedIpId,
            revenuePoolAppId: ip.revenuePoolAppId,
          });

          // Per-request timeout controller
          const requestController = new AbortController();
          const timeoutId = setTimeout(() => {
            requestController.abort();
          }, 4000); // 4s, adjust as needed

          try {
            const res = await fetch(
              `/api/revenue-pool/claim?appId=${Number(
                ip.revenuePoolAppId
              )}&userAddress=${accountAddress}&ipId=${resolvedIpId}`,
              {
                signal: requestController.signal,
              }
            );

            if (res.ok) {
              const claimInfo = await res.json();
              poolsWithClaimInfo.push({
                ...ip,
                resolvedIpId,
                imageUrl: resolveIpImage(ip),
                claimInfo,
              });
            } else {
              console.warn(
                '[POOLS] Claim info request failed',
                { id: ip.id, status: res.status }
              );
              poolsWithClaimInfo.push({
                ...ip,
                resolvedIpId,
                imageUrl: resolveIpImage(ip),
                claimInfo,
              });
            }
          } catch (err) {
            if (err.name === 'AbortError') {
              console.warn('[POOLS] claim fetch timed out', {
                name: ip.name,
                appId: ip.revenuePoolAppId,
                resolvedIpId,
              });
            } else {
              console.error('Error fetching pool claim info:', ip.id, err);
            }
            poolsWithClaimInfo.push({
              ...ip,
              resolvedIpId,
              imageUrl: resolveIpImage(ip),
              claimInfo: null,
            });
          } finally {
            clearTimeout(timeoutId);
          }

          await sleep(400);
        }
      } else {
        console.warn('[POOLS] /api/ip request failed', {
          status: ipResponse.status,
        });
      }

      // ── 2) Stakeholder pools via REV ASA holdings (fallback) ───────────────
      if (!controller.signal.aborted && poolsWithClaimInfo.length === 0) {
        try {
          const stakeholderRes = await fetch(
            `/api/revenue-pool/stakeholder-pools?userAddress=${accountAddress}`,
            {
              credentials: 'include',
              signal: controller.signal,
            }
          );

          if (stakeholderRes.ok) {
            const stakeholderData = await stakeholderRes.json();
            const stakeholderPools = Array.isArray(stakeholderData?.pools)
              ? stakeholderData.pools
              : [];

            console.log('[POOLS] stakeholder pools', {
              userAddress: accountAddress,
              count: stakeholderPools.length,
            });

            // We treat stakeholder pools as first-class pools in the UI.
            for (const p of stakeholderPools) {
              if (controller.signal.aborted) return;

              const resolvedIpId = p.ipId || resolvePoolIpId(p);

              const requestController = new AbortController();
              const timeoutId = setTimeout(() => {
                requestController.abort();
              }, 4000);

              try {
                const res = await fetch(
                  `/api/revenue-pool/claim?appId=${Number(
                    p.revenuePoolAppId
                  )}&userAddress=${accountAddress}&ipId=${resolvedIpId}`,
                  {
                    signal: requestController.signal,
                  }
                );

                let claimInfo = null;
                if (res.ok) {
                  claimInfo = await res.json();
                } else {
                  console.warn(
                    '[POOLS] stakeholder Claim info request failed',
                    { ipId: resolvedIpId, status: res.status }
                  );
                }

                poolsWithClaimInfo.push({
                  ...p,
                  resolvedIpId,
                  imageUrl: p.imageUrl || resolveIpImage(p),
                  claimInfo,
                });
              } catch (err) {
                if (err.name === 'AbortError') {
                  console.warn('[POOLS] stakeholder claim fetch timed out', {
                    ipId: resolvedIpId,
                    appId: p.revenuePoolAppId,
                  });
                } else {
                  console.error(
                    'Error fetching stakeholder pool claim info:',
                    resolvedIpId,
                    err
                  );
                }
                poolsWithClaimInfo.push({
                  ...p,
                  resolvedIpId,
                  imageUrl: p.imageUrl || resolveIpImage(p),
                  claimInfo: null,
                });
              } finally {
                clearTimeout(timeoutId);
              }
            }
          } else {
            console.warn('[POOLS] stakeholder-pools request failed', {
              status: stakeholderRes.status,
            });
          }
        } catch (err) {
          if (err.name === 'AbortError') {
            console.warn('[POOLS] stakeholder-pools fetch aborted');
          } else {
            console.error('Error fetching stakeholder pools:', err);
          }
        }
      }

      // ── 3) Final state update ───────────────────────────────────────────────
      if (!controller.signal.aborted) {
        setRevenuePools(poolsWithClaimInfo);
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
    const addr = accountAddress;

    if (!isConnected || !addr) {
      return toast.error('Wallet not fully synced. Please reconnect.');
    }

    setClaimingTokens(token.ipId);

    try {
      // Helper to call POST /api/revenue-tokens/claim
      const prepareClaim = async () => {
        const res = await fetch('/api/revenue-tokens/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userAddress: addr, ipId: token.ipId }),
        });
        const data = await res.json().catch(() => null);
        return { res, data };
      };

      let { res, data } = await prepareClaim();

      // ── Automatic REV ASA opt-in subflow ──────────────────────────────────
      if (
        res.status === 409 &&
        data?.code === 'TOKEN_OPT_IN_REQUIRED' &&
        data?.revenueTokenId
      ) {
        toast.info(
          'Preparing your wallet for this revenue token. This is a one-time setup.'
        );

        const { transaction: optInTxn, revenueTokenId } =
          await getRevenueTokenOptInTxn(addr, data.revenueTokenId);

        const signedOptIn = await signTransactionGroup([
          new Uint8Array(Buffer.from(optInTxn, 'base64')),
        ]);

        if (!signedOptIn?.length) {
          throw new Error('Revenue token opt-in signing cancelled');
        }

        const signedOptInBase64 = Buffer.from(signedOptIn[0]).toString('base64');

        await submitRevenueTokenOptIn({
          signedTxn: signedOptInBase64,
          userAddress: addr,
          revenueTokenId,
        });

        toast.success('Revenue token opt-in complete.');

        // Retry the claim now that the wallet is opted in
        ({ res, data } = await prepareClaim());
      }
      // ─────────────────────────────────────────────────────────────────────

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to prepare token claim');
      }

      if (!data?.transaction) {
        throw new Error('Missing claim transaction');
      }

      const signed = await signTransactionGroup([
        new Uint8Array(Buffer.from(data.transaction, 'base64')),
      ]);

      if (!signed?.length) {
        throw new Error('Claim signing cancelled');
      }

      const signedTxn = Buffer.from(signed[0]).toString('base64');

      const submit = await fetch('/api/revenue-tokens/claim', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          signedTxn,
          userAddress: addr,
          ipId: token.ipId,
        }),
      });

      const submitData = await submit.json().catch(() => null);
      if (!submit.ok) {
        throw new Error(submitData?.error || 'Submission failed');
      }

      // Optimistic UI update – keep claimed state visible before next refresh
      const nextOverrides = {
        ...tokenOverridesRef.current,
        [token.ipId]: {
          forceClaimed: true,
          allocatedTokens: Number(
            token.allocatedTokens ?? token.stakeholderBps ?? 0
          ),
          at: Date.now(),
        },
      };

      tokenOverridesRef.current = nextOverrides;
      setTokenOverrides(nextOverrides);
      setClaimableTokens((prev) =>
        prev.map((item) =>
          item.ipId === token.ipId ? mergeTokenWithOverride(item) : item
        )
      );

      toast.success('Revenue tokens claimed.');

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        void fetchClaimableTokens();
        void fetchRevenuePools();
      }, 2500);
    } catch (e) {
      console.error('Token claim failed:', e);
      toast.error(e?.message || 'Failed to claim revenue tokens');
    } finally {
      setClaimingTokens(null);
    }
  };

  async function handleClaimRevenue(pool) {
    const addr = accountAddress;

    if (!isConnected || !addr) {
      return toast.error('Wallet not fully synced. Please reconnect.');
    }

    const poolIpId = resolvePoolIpId(pool);
    const amount =
      claimAmounts[poolIpId] ?? pool.claimInfo?.user?.claimableAmount;

    if (!amount) {
      return toast.error('Nothing to claim');
    }

    setClaimingRevenue(poolIpId);

    try {
      // 1) USDC opt-in if needed — SINGLE TXN FLOW
      const optInStatus = await getUsdcOptInStatus(addr);
      const isUsdcOptedIn = Boolean(optInStatus?.optedIn);

      if (!isUsdcOptedIn) {
        toast.info(
          'Preparing your wallet to receive USDC. This is a one-time setup.'
        );

        const { transaction: optInTxn } = await getUsdcOptInTxn(addr);
        if (!optInTxn) {
          throw new Error('Failed to prepare USDC opt-in transaction');
        }

        const signedOptIn = await signTransactionGroup([
          new Uint8Array(Buffer.from(optInTxn, 'base64')),
        ]);

        if (!signedOptIn?.length) {
          throw new Error('USDC opt-in signing cancelled');
        }

        const signedOptInBase64 = [
          Buffer.from(signedOptIn[0]).toString('base64'),
        ];

        const submitOptIn = await fetch('/api/revenue-pool/usdc-optin', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            signedTxns: signedOptInBase64,
            signedTxn: signedOptInBase64[0],
            userAddress: addr,
          }),
        });

        const submitOptInData = await submitOptIn.json().catch(() => null);
        if (!submitOptIn.ok) {
          throw new Error(
            submitOptInData?.error || 'USDC opt-in submission failed'
          );
        }

        usdcOptInCacheRef.current.set(addr, {
          optedIn: true,
          assetId: Number(submitOptInData?.assetId || 0),
          checkedAt: Date.now(),
        });

        toast.success('USDC opt-in complete.');
      }

      // 2) Pool claim — SINGLE TXN FLOW
      const prepareClaimRes = await fetch('/api/revenue-pool/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          claimerAddress: addr,
          appId: Number(pool.revenuePoolAppId),
          ipId: poolIpId,
        }),
      });

      const prepareClaimData = await prepareClaimRes.json().catch(() => null);
      if (!prepareClaimRes.ok) {
        throw new Error(
          prepareClaimData?.error || 'Failed to prepare claim transaction'
        );
      }

      if (!prepareClaimData?.transaction) {
        throw new Error('Missing claim transaction');
      }

      const claimTxnBase64 = prepareClaimData.transaction;

      const signedClaim = await signTransactionGroup([
        new Uint8Array(Buffer.from(claimTxnBase64, 'base64')),
      ]);

      if (!signedClaim?.length) {
        throw new Error('Claim signing cancelled');
      }

      const signedClaimBase64 = [
        Buffer.from(signedClaim[0]).toString('base64'),
      ];

      const submitClaimRes = await fetch('/api/revenue-pool/claim', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          signedTxns: signedClaimBase64,
          signedTxn: signedClaimBase64[0],
          userAddress: addr,
          ipId: poolIpId,
          appId: Number(pool.revenuePoolAppId),
        }),
      });

      const submitClaimData = await submitClaimRes.json().catch(() => null);
      if (!submitClaimRes.ok) {
        throw new Error(
          submitClaimData?.error || 'USDC claim submission failed'
        );
      }

      toast.success('USDC Claimed!');
      await fetchData();
    } catch (e) {
      console.error('Error claiming from Revenue Pool', e);
      toast.error(e?.message || 'Failed to claim from revenue pool');
    } finally {
      setClaimingRevenue(null);
    }
  }

  function formatUsdDynamicFromMicro(microUsdc) {
    const raw = microUsdc / 1_000_000;

    // Up to 6 decimals.
    let s = raw.toFixed(6);

    // Trim trailing zeros after the last non-zero decimal.
    s = s.replace(/(\.\d*?[1-9])0+$/, '$1');

    // Ensure at least two decimals for whole numbers.
    if (s.endsWith('.0')) {
      s = s + '0';
    } else if (!s.includes('.')) {
      s = s + '.00';
    }

    return s;
  }

  const totalPendingReleaseUSDC = revenuePools.reduce(
    (sum, p) => sum + Number(p.claimInfo?.pool?.unallocatedUsdc || 0),
    0
  );

  const totalClaimableUSDC = revenuePools.reduce(
    (sum, p) => sum + Number(p.claimInfo?.user?.claimableAmount || 0),
    0
  );

  const totalLifetimeClaimedUSDC = revenuePools.reduce((sum, p) => {
    const rounds = Array.isArray(p.claimInfo?.rounds) ? p.claimInfo.rounds : [];
    const claimed = rounds
      .filter((r) => r.claimed)
      .reduce((roundSum, r) => roundSum + Number(r.amount || 0), 0);
    return sum + claimed;
  }, 0);

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
            <RefreshCcw
              className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
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
                  <p className="text-2xl font-bold">
                    ${formatUsdDynamicFromMicro(totalPendingReleaseUSDC)}
                  </p>
                  <p className="text-sm text-muted-foreground">Pending Release</p>
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
                    ${formatUsdDynamicFromMicro(totalClaimableUSDC)}
                  </p>
                  <p className="text-sm text-muted-foreground">Available to Claim</p>
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
                    ${formatUsdDynamicFromMicro(totalLifetimeClaimedUSDC)}
                  </p>
                  <p className="text-sm text-muted-foreground">Lifetime Claimed</p>
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
                  const claimedAmount = Number(
                    t.claimedAmount ??
                      (status === 'claimed'
                        ? stakeholderBps
                        : Math.min(existingBalance, stakeholderBps))
                  );

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
                              Claimed{' '}
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
                  const claimInfo = p.claimInfo;
                  const hasError = !claimInfo;

                  const userRevBalance = Number(claimInfo?.user?.tokenBalance || 0);
                  const claimableAmount = Number(claimInfo?.user?.claimableAmount || 0);
                  const claimableFormatted =
                    claimInfo?.user?.claimableFormatted || '0.00';
                  const poolBalanceFormatted =
                    claimInfo?.pool?.balanceFormatted || '0.00';

                  const rounds = Array.isArray(claimInfo?.rounds) ? claimInfo.rounds : [];
                  const lifetimeClaimedAmount = rounds
                    .filter((r) => r.claimed)
                    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
                  const lifetimeClaimedFormatted = formatUsdDynamicFromMicro(lifetimeClaimedAmount);

                  const poolKey = p.resolvedIpId || resolvePoolIpId(p);
                  const isClaiming = claimingRevenue === poolKey;
                  const isDisabled = isClaiming || hasError || claimableAmount <= 0;

                  return (
                    <Card key={poolKey} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="grid min-h-[124px] grid-cols-1 md:grid-cols-[84px_minmax(0,1fr)_170px]">
                          <div className="flex items-center justify-center border-b bg-muted/20 p-4 md:border-b-0 md:border-r">
                            {resolveIpImage(p) ? (
                              <img
                                src={resolveIpImage(p)}
                                alt={p.name}
                                className="h-14 w-14 rounded-xl object-cover"
                                width={56}
                                height={56}
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-14 w-14 rounded-xl bg-muted" />
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
                                  hasError
                                    ? 'bg-muted text-muted-foreground border-border'
                                    : claimableAmount > 0
                                    ? 'bg-green-500/15 text-green-400 border-green-500/30'
                                    : 'bg-muted text-muted-foreground border-border'
                                }
                              >
                                {hasError
                                  ? 'Unavailable'
                                  : claimableAmount > 0
                                  ? 'Claim available'
                                  : 'Nothing to claim'}
                              </Badge>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
                              <div className="rounded-md border bg-background/50 px-3 py-2">
                                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                  Pool Balance
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                  {hasError ? '—' : `$${poolBalanceFormatted}`}
                                </p>
                              </div>

                              <div className="rounded-md border bg-background/50 px-3 py-2">
                                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                  REV Held
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                  {hasError ? '—' : userRevBalance.toLocaleString()}
                                </p>
                              </div>

                              <div className="rounded-md border bg-background/50 px-3 py-2">
                                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                  Claimable
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                  {hasError ? '—' : `$${claimableFormatted} USDC`}
                                </p>
                              </div>

                              <div className="rounded-md border bg-background/50 px-3 py-2">
                                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                  Lifetime USDC Claimed
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                  {hasError ? '—' : `$${lifetimeClaimedFormatted}`}
                                </p>
                              </div>
                            </div>

                            {hasError && (
                              <button
                                type="button"
                                onClick={() => fetchRevenuePools()}
                                className="mt-3 w-fit text-xs text-primary underline underline-offset-2"
                              >
                                Retry loading pool data
                              </button>
                            )}
                          </div>

                          <div className="flex items-center justify-center border-t bg-muted/10 p-4 md:border-l md:border-t-0">
                            <Button
                              onClick={() => handleClaimRevenue(p)}
                              disabled={isDisabled}
                              className="h-11 w-full md:w-[148px]"
                            >
                              {isClaiming ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : hasError ? (
                                'Unavailable'
                              ) : claimableAmount > 0 ? (
                                `Claim $${claimableFormatted}`
                              ) : (
                                'Nothing to claim'
                              )}
                            </Button>
                          </div>
                        </div>

                        {!hasError && rounds.length > 0 && (
                          <details className="border-t bg-muted/5">
                            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-muted-foreground md:px-5">
                              <span>USDC Claim History</span>
                              <span>
                                {rounds.length}{' '}
                                {rounds.length === 1 ? 'round' : 'rounds'}
                              </span>
                            </summary>

                            <div className="px-4 pb-4 md:px-5">
                              <div className="overflow-hidden rounded-lg border">
                                <div className="hidden grid-cols-[110px_160px_160px_1fr] border-b bg-muted/20 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:grid">
                                  <div>Round</div>
                                  <div>Date released</div>
                                  <div>Date claimed</div>
                                  <div>Amount</div>
                                </div>

                                <div className="divide-y">
                                  {rounds.map((r) => {
                                    const releasedAt = r.roundCreated
                                      ? new Date(
                                          Number(r.roundCreated) * 1000
                                        ).toLocaleDateString()
                                      : '—';

                                    const claimedLabel = r.claimed
                                      ? 'Claimed'
                                      : 'Pending';

                                    return (
                                      <div
                                        key={r.roundId}
                                        className="grid gap-2 px-3 py-3 md:grid-cols-[110px_160px_160px_1fr] md:items-center"
                                      >
                                        <div>
                                          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground md:hidden">
                                            Round
                                          </p>
                                          <p className="text-sm font-medium">
                                            Round {r.roundId}
                                          </p>
                                        </div>

                                        <div>
                                          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground md:hidden">
                                            Date released
                                          </p>
                                          <p className="text-sm text-muted-foreground">
                                            {releasedAt}
                                          </p>
                                        </div>

                                        <div>
                                          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground md:hidden">
                                            Date claimed
                                          </p>
                                          <p className="text-sm text-muted-foreground">
                                            {claimedLabel}
                                          </p>
                                        </div>

                                        <div>
                                          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground md:hidden">
                                            Amount
                                          </p>
                                          <p className="text-sm font-medium">
                                            {formatUsdDynamicFromMicro(Number(r.amount || 0))} USDC
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </details>
                        )}
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