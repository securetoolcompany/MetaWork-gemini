'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShoppingBag, Package, TrendingUp, ArrowUpRight,
  Download, Search, X, ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { SaleRecord, SalesSummary } from '@/app/api/sales/route';

// ── Filter config ────────────────────────────────────────────────────────────

type StatusFilter =
  | 'all'
  | 'pending'          // created, not yet paid
  | 'paid'             // stripe confirmed, sent to Printful
  | 'awaiting_approval'// at Printful, waiting for production approval
  | 'failed'           // Printful submission failed
  | 'shipped'          // Printful confirmed shipment
  | 'refunded';        // refunded or cancelled

type TypeFilter = 'all' | 'physical' | 'digital' | 'tokenized';

const STATUS_OPTIONS: { value: StatusFilter; label: string; color: string }[] = [
  { value: 'all',               label: 'All Statuses',        color: '' },
  { value: 'pending',           label: 'Pending Payment',     color: 'text-amber-600' },
  { value: 'paid',              label: 'Paid',                color: 'text-blue-600' },
  { value: 'awaiting_approval', label: 'Awaiting Approval',   color: 'text-indigo-600' },
  { value: 'failed',            label: 'Fulfillment Failed',  color: 'text-red-600' },
  { value: 'shipped',           label: 'Shipped',             color: 'text-emerald-600' },
  { value: 'refunded',          label: 'Refunded / Cancelled', color: 'text-rose-600' },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all',       label: 'All Types' },
  { value: 'physical',  label: 'Physical' },
  { value: 'digital',   label: 'Digital' },
  { value: 'tokenized', label: 'Tokenized IP' },
];

// Badge style per display status
const statusBadgeClass: Record<string, string> = {
  Completed:  'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Processing: 'bg-amber-500/10  text-amber-600  border-amber-500/20',
  Shipped:    'bg-blue-500/10   text-blue-600   border-blue-500/20',
  Refunded:   'bg-red-500/10    text-red-600    border-red-500/20',
  Failed:     'bg-rose-500/10   text-rose-600   border-rose-500/20',
};

// ── Component ────────────────────────────────────────────────────────────────

export default function SalesPage() {
  const [sales,      setSales]      = useState<SaleRecord[]>([]);
  const [summary,    setSummary]    = useState<SalesSummary>({
    totalOrders: 0, grossSales: 0, pendingFulfillment: 0,
  });
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  // Filters
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>('all');

  const activeFilterCount = [
    statusFilter !== 'all',
    typeFilter   !== 'all',
    search.trim() !== '',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
    setPage(1);
  };

  const fetchSales = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search.trim())           params.set('q',               search.trim());
    if (statusFilter !== 'all')  params.set('status',          statusFilter);
    if (typeFilter   !== 'all')  params.set('type',            typeFilter);

    fetch(`/api/sales?${params}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (!data.success) throw new Error(data.error);
        setSales(data.sales);
        setSummary(data.summary);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      })
      .catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [page, search, statusFilter, typeFilter]);

  useEffect(() => {
    const cleanup = fetchSales();
    return cleanup;
  }, [fetchSales]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter]);

  const selectedStatusLabel =
    STATUS_OPTIONS.find(o => o.value === statusFilter)?.label ?? 'Status';
  const selectedTypeLabel =
    TYPE_OPTIONS.find(o => o.value === typeFilter)?.label ?? 'Type';

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8 px-4 sm:px-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales & Orders</h1>
          <p className="text-muted-foreground mt-1">
            Manage orders, physical fulfillment, and digital sales history.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="gap-2 w-full sm:w-auto">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button asChild className="gap-2 w-full sm:w-auto">
            <Link href="/earnings">View Earnings <ArrowUpRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Clickable KPI cards double as quick-filters */}
        <Card
          onClick={() => { setStatusFilter('all'); setPage(1); }}
          className="border-muted/60 shadow-sm bg-gradient-to-br from-background to-secondary/20 cursor-pointer hover:border-primary/40 transition-colors"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalOrders.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border-muted/60 shadow-sm bg-gradient-to-br from-background to-secondary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gross Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => { setStatusFilter('awaiting_approval'); setPage(1); }}
          className="border-muted/60 shadow-sm bg-gradient-to-br from-background to-secondary/20 cursor-pointer hover:border-primary/40 transition-colors"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Fulfillment</CardTitle>
            <Package className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.pendingFulfillment}</div>
            <p className="text-xs text-muted-foreground mt-1">Click to filter</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Bar ── */}
      <Card className="border-muted/60 shadow-sm">
        <CardContent className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">

            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search order, customer, product…"
                className="pl-8 bg-background h-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Status filter — maps to every lifecycle step */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={statusFilter !== 'all' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5 h-9"
                >
                  {selectedStatusLabel}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Order lifecycle
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_OPTIONS.map(opt => (
                  <DropdownMenuItem
                    key={opt.value}
                    className={`text-sm ${opt.color} ${statusFilter === opt.value ? 'font-semibold' : ''}`}
                    onSelect={() => setStatusFilter(opt.value)}
                  >
                    {statusFilter === opt.value && <span className="mr-1.5">✓</span>}
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Type filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={typeFilter !== 'all' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5 h-9"
                >
                  {selectedTypeLabel}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Product type
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {TYPE_OPTIONS.map(opt => (
                  <DropdownMenuItem
                    key={opt.value}
                    className={`text-sm ${typeFilter === opt.value ? 'font-semibold' : ''}`}
                    onSelect={() => setTypeFilter(opt.value)}
                  >
                    {typeFilter === opt.value && <span className="mr-1.5">✓</span>}
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Active filter pills + clear */}
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                {statusFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1 pr-1 text-xs">
                    {selectedStatusLabel}
                    <button onClick={() => setStatusFilter('all')} className="ml-0.5 hover:opacity-70">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {typeFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1 pr-1 text-xs">
                    {selectedTypeLabel}
                    <button onClick={() => setTypeFilter('all')} className="ml-0.5 hover:opacity-70">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={clearFilters}>
                  Clear all
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Table ── */}
      <Card className="border-muted/60 shadow-sm">
        <CardHeader className="border-b bg-muted/20 px-6 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {total > 0
                ? `${total.toLocaleString()} order${total !== 1 ? 's' : ''}${activeFilterCount > 0 ? ' matched' : ''}`
                : 'Recent Transactions'}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <p className="text-center text-destructive py-8 text-sm">{error}</p>
          )}

          <Table>
            <TableHeader>
              <TableRow className="bg-muted/10 hover:bg-muted/10">
                <TableHead className="w-[110px] pl-6">Order ID</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 rounded bg-muted/40 w-3/4" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <Package className="mx-auto mb-3 h-8 w-8 opacity-30" />
                    <p className="font-medium">No orders found</p>
                    {activeFilterCount > 0 && (
                      <button onClick={clearFilters} className="mt-1 text-sm text-primary hover:underline">
                        Clear filters
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                sales.map(sale => (
                  <TableRow key={sale.id} className="cursor-pointer hover:bg-muted/30">
                    <TableCell className="font-mono text-xs pl-6">{sale.orderNumber}</TableCell>
                    <TableCell>
                      <p className="font-medium leading-snug">{sale.product}</p>
                      <p className="text-xs text-muted-foreground">{sale.type}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{sale.customer}</TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{sale.date}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={statusBadgeClass[sale.status] ?? 'bg-muted text-muted-foreground'}
                      >
                        {sale.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold pr-6">{sale.amount}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between px-6 py-4 border-t">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} &middot; {total.toLocaleString()} total
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}