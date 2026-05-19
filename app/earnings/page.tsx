'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  DollarSign, TrendingUp, TrendingDown, ShoppingCart,
  Download, Shield, Coins, Package, Plus, ArrowRight, Calendar,
} from 'lucide-react';
import EarningsChart from '@/components/earnings/EarningsChart';
import RevenueBreakdown from '@/components/earnings/RevenueBreakdown';
import SocialMetrics from '@/components/marketing/SocialMetrics';
import TransactionsTable from '@/components/earnings/TransactionsTable';
import Link from 'next/link';

interface Overview {
  totalEarnings: number;
  productRevenue: number;
  ipRoyalties: number;
  thisMonth: number;
  lastMonth: number;
  pendingPayout: number;
}
interface RevenueBreakdownData {
  productSales: number;
  ipRoyalties: number;
  adRevenue: number;
  tips: number;
}
interface MonthlyBucket {
  month: string;
  productSales: number;
  ipRoyalties: number;
  adRevenue: number;
  tips: number;
}
interface TopProduct {
  id: string;
  name: string;
  image: string;
  sales: number;
  revenue: number;
}
interface TopIpAsset {
  id: string;
  name: string;
  type: 'tokenized' | 'authenticated';
  royalties: number;
  uses: number;
}
interface Transaction {
  id: string;
  date: string;
  type: string;
  description: string;
  amount: number;
  status: string;
}
interface EarningsData {
  overview: Overview;
  revenueBreakdown: RevenueBreakdownData;
  monthlyData: MonthlyBucket[];
  topProducts: TopProduct[];
  topIpAssets: TopIpAsset[];
  transactions: Transaction[];
}

function KpiSkeleton() {
  return (
    <Card className="p-6 animate-pulse">
      <div className="flex items-center justify-between mb-2">
        <div className="h-4 w-24 rounded bg-muted/50" />
        <div className="h-5 w-5 rounded-full bg-muted/50" />
      </div>
      <div className="h-8 w-32 rounded bg-muted/50 mb-2" />
      <div className="h-3 w-20 rounded bg-muted/40" />
    </Card>
  );
}

function EmptyPanel({
  icon: Icon,
  label,
  href,
  cta,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
      <Icon className="h-9 w-9 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{label}</p>
      <Button asChild size="sm" variant="outline" className="gap-1.5">
        <Link href={href}>
          <Plus className="h-3.5 w-3.5" /> {cta}
        </Link>
      </Button>
    </div>
  );
}

export default function EarningsPage() {
  const [data,      setData]      = useState<EarningsData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'3' | '6' | '12'>('6');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/earnings?months=${timeframe}`)
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error(json.error ?? 'Failed to load earnings');
        setData(json);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [timeframe]);

  const overview     = data?.overview;
  const breakdown    = data?.revenueBreakdown;
  const monthly      = data?.monthlyData ?? [];
  const topProducts  = data?.topProducts ?? [];
  const topIpAssets  = data?.topIpAssets ?? [];
  const transactions = data?.transactions ?? [];

  const pctChange = overview
    ? overview.lastMonth > 0
      ? (((overview.thisMonth - overview.lastMonth) / overview.lastMonth) * 100).toFixed(1)
      : overview.thisMonth > 0 ? '100.0' : '0.0'
    : '0.0';
  const isPositive = parseFloat(pctChange) >= 0;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ── Header ── */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-1">Earnings & Analytics</h1>
              <p className="text-muted-foreground text-sm">Track your revenue and performance</p>
            </div>
            <Button className="gap-2" disabled={loading}>
              <Download className="w-4 h-4" /> Export Report
            </Button>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? (
              <>{[...Array(4)].map((_, i) => <KpiSkeleton key={i} />)}</>
            ) : (
              <>
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Total Earnings</span>
                    <DollarSign className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    ${(overview?.totalEarnings ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground">All-time revenue</p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">This Month</span>
                    {isPositive
                      ? <TrendingUp className="w-5 h-5 text-green-500" />
                      : <TrendingDown className="w-5 h-5 text-red-500" />}
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    ${(overview?.thisMonth ?? 0).toFixed(2)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={isPositive ? 'default' : 'destructive'} className="text-xs">
                      {isPositive ? '+' : ''}{pctChange}%
                    </Badge>
                    <span className="text-xs text-muted-foreground">vs last month</span>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Pending Payout</span>
                    <Calendar className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    ${(overview?.pendingPayout ?? 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">Awaiting settlement</p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">IP Royalties</span>
                    <Coins className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    ${(overview?.ipRoyalties ?? 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">All-time from tokenized IP</p>
                </Card>
              </>
            )}
          </div>

          {/* ── Top Grossing — always side by side ── */}
          <div className="grid md:grid-cols-2 gap-4">

            {/* Products */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-blue-400" />
                  <h3 className="text-sm font-semibold">Top Grossing Products</h3>
                </div>
                {topProducts.length > 0 && (
                  <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
                    <Link href="/products">View all <ArrowRight className="h-3 w-3" /></Link>
                  </Button>
                )}
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-5 h-4 rounded bg-muted/40" />
                      <div className="w-9 h-9 rounded-md bg-muted/40" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3 w-3/4 rounded bg-muted/40" />
                        <div className="h-3 w-1/3 rounded bg-muted/30" />
                      </div>
                      <div className="h-4 w-16 rounded bg-muted/40" />
                    </div>
                  ))}
                </div>
              ) : topProducts.length === 0 ? (
                <EmptyPanel
                  icon={Package}
                  label="No product sales yet. Create your first product to start earning."
                  href="/products/new"
                  cta="Create Product"
                />
              ) : (
                <div className="space-y-2">
                  {topProducts.slice(0, 5).map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="w-5 text-xs text-muted-foreground text-right shrink-0 tabular-nums">#{i + 1}</span>
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-9 h-9 rounded-md object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.sales} sales</p>
                      </div>
                      <span className="text-sm font-semibold text-green-500 shrink-0 tabular-nums">
                        ${p.revenue.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* IP Assets */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-semibold">Top Grossing IP Assets</h3>
                </div>
                {topIpAssets.length > 0 && (
                  <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
                    <Link href="/ip-assets">View all <ArrowRight className="h-3 w-3" /></Link>
                  </Button>
                )}
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-5 h-4 rounded bg-muted/40" />
                      <div className="w-9 h-9 rounded-md bg-muted/40" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3 w-3/4 rounded bg-muted/40" />
                        <div className="h-3 w-1/3 rounded bg-muted/30" />
                      </div>
                      <div className="h-4 w-16 rounded bg-muted/40" />
                    </div>
                  ))}
                </div>
              ) : topIpAssets.length === 0 ? (
                <EmptyPanel
                  icon={Coins}
                  label="No IP assets yet. Tokenize your work to earn royalties automatically."
                  href="/ip-assets/new"
                  cta="Create IP Asset"
                />
              ) : (
                <>
                  <div className="space-y-2">
                    {topIpAssets.slice(0, 5).map((ip, i) => (
                      <div key={ip.id} className="flex items-center gap-3">
                        <span className="w-5 text-xs text-muted-foreground text-right shrink-0 tabular-nums">#{i + 1}</span>
                        <div className="w-9 h-9 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                          {ip.type === 'tokenized'
                            ? <Coins className="h-4 w-4 text-indigo-400" />
                            : <Shield className="h-4 w-4 text-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{ip.name}</p>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={cn(
                              'text-[10px] px-1.5 py-0 h-4 border',
                              ip.type === 'tokenized'
                                ? 'border-indigo-500/30 text-indigo-400'
                                : 'border-slate-600 text-slate-400'
                            )}>
                              {ip.type === 'tokenized' ? 'Tokenized' : 'Authenticated'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{ip.uses} uses</span>
                          </div>
                        </div>
                        <span className={cn('text-sm font-semibold shrink-0 tabular-nums',
                          ip.royalties > 0 ? 'text-green-500' : 'text-muted-foreground'
                        )}>
                          {ip.royalties > 0 ? `$${ip.royalties.toFixed(2)}` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Authenticated IP shows usage count only. Tokenized IP earns royalties per use.
                  </p>
                </>
              )}
            </Card>
          </div>

          {/* ── Tabs ── */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Revenue Trends</h3>
                    <p className="text-sm text-muted-foreground">Monthly earnings by source</p>
                  </div>
                  <select
                    value={timeframe}
                    onChange={e => setTimeframe(e.target.value as '3' | '6' | '12')}
                    className="px-3 py-2 rounded-md border bg-background text-sm"
                  >
                    <option value="3">Last 3 Months</option>
                    <option value="6">Last 6 Months</option>
                    <option value="12">Last 12 Months</option>
                  </select>
                </div>
                {loading
                  ? <div className="h-64 rounded-lg bg-muted/30 animate-pulse" />
                  : <EarningsChart data={monthly} timeframe={timeframe} />
                }
              </Card>

              <div className="grid lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="text-xl font-bold mb-6">Revenue Breakdown</h3>
                  {loading
                    ? <div className="h-48 rounded-lg bg-muted/30 animate-pulse" />
                    : breakdown
                      ? <RevenueBreakdown data={breakdown} />
                      : <p className="text-sm text-muted-foreground">No data yet.</p>
                  }
                </Card>

                {/* Social Metrics stub */}
                <Card className="p-6">
                  {loading
                    ? <div className="h-48 rounded-lg bg-muted/30 animate-pulse" />
                    : <SocialMetrics />
                  }
                </Card>
              </div>
            </TabsContent>

            {/* Products */}
            <TabsContent value="products" className="space-y-6">
              <Card className="p-6">
                <h3 className="text-xl font-bold mb-6">Product Performance</h3>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-lg border animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-muted/40" />
                        <div className="w-16 h-16 rounded-md bg-muted/40" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-1/2 rounded bg-muted/40" />
                          <div className="h-3 w-1/4 rounded bg-muted/30" />
                        </div>
                        <div className="h-6 w-20 rounded bg-muted/40" />
                      </div>
                    ))}
                  </div>
                ) : topProducts.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-muted-foreground gap-3">
                    <Package className="h-10 w-10 opacity-30" />
                    <p className="font-medium">No product sales yet</p>
                    <p className="text-sm">Sales will appear here once orders are placed.</p>
                    <Button asChild size="sm" variant="outline" className="gap-1.5 mt-1">
                      <Link href="/products/new"><Plus className="h-3.5 w-3.5" /> Create Product</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topProducts.map((product, index) => (
                      <div key={product.id} className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                          #{index + 1}
                        </div>
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-16 h-16 rounded-md object-cover shrink-0" />
                        ) : (
                          <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold mb-1">{product.name}</h4>
                          <p className="text-sm text-muted-foreground">{product.sales} sales</p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-green-600 tabular-nums">${product.revenue.toFixed(2)}</div>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            ${(product.revenue / product.sales).toFixed(2)} avg
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Transactions */}
            <TabsContent value="transactions">
              {loading
                ? <Card className="p-6"><div className="h-64 rounded-lg bg-muted/30 animate-pulse" /></Card>
                : <TransactionsTable transactions={transactions} />
              }
            </TabsContent>
          </Tabs>

        </div>
      </div>
    </div>
  );
}