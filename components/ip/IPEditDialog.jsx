'use client';


import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload, DollarSign, TrendingUp, AlertCircle, Globe, Lock,
  Info, ShoppingCart, Eye, Coins, Users, Calendar, Wallet,
  ExternalLink, BarChart2, Trash2, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import CategoryPicker from '@/components/layout/CategoryPicker';
import { IP_CATEGORY_GROUPS, parseCategoryString, serializeCategoryMap } from '@/lib/ipCategories';


// ── helpers ────────────────────────────────────────────────────────────────────


function fmtDate(val) {
  if (!val) return '—';
  try { return new Date(val).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
}


function AlgoExplorerLink({ label, id, type = 'asset' }) {
  if (!id) return <span className="text-muted-foreground">—</span>;
  const base = 'https://testnet.explorer.perawallet.app';
  const url = type === 'asset'
    ? `${base}/assets/${id}`
    : `${base}/application/${id}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
       className="inline-flex items-center gap-1 text-blue-500 hover:underline font-mono text-xs">
      {String(id).length > 12 ? `${String(id).slice(0, 10)}…` : id}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}


// ── stat row inside a card ─────────────────────────────────────────────────────


function StatRow({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold text-foreground ${valueClass}`}>{value}</span>
    </div>
  );
}


// ── main component ─────────────────────────────────────────────────────────────


export default function IPEditDialog({ ipAsset, open, onOpenChange, onSaved, tutorialStep }) {
  const rawCat = ipAsset?.category || '';
  const initialCategory = Array.isArray(rawCat)
    ? rawCat.join(',')
    : rawCat;


  const [formData, setFormData] = useState({
    name:         ipAsset?.name        || '',
    description:  ipAsset?.description || 'High-quality digital artwork perfect for print-on-demand products',
    category:     initialCategory,
    tags:         Array.isArray(ipAsset?.tags) ? ipAsset.tags : (ipAsset?.tags || 'design, artwork, print, creative'),
    licensingFee: ipAsset?.licensingFee != null ? ipAsset.licensingFee : 1.00,    isPublic:     ipAsset?.isPublic !== undefined ? ipAsset.isPublic : true,
  });


  const [charCount, setCharCount] = useState(formData.description.length);

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDescriptionChange = (e) => {
    const text = e.target.value;
    if (text.length <= 500) {
      setFormData({ ...formData, description: text });
      setCharCount(text.length);
    }
  };


  // ── earnings projections ───────────────────────────────────────────────────
  const usageCount      = ipAsset?.usageCount      || 0;
  const totalRevenue    = ipAsset?.totalRevenue     || 0;
  const avgProductPrice = ipAsset?.avgProductPrice  || 0;
  const viewCount       = ipAsset?.viewCount        || 0;
  const earnings        = ipAsset?.earnings         || 0;
  const stakeholders    = ipAsset?.stakeholders     || [];


  const avgEarningsPerUse    = usageCount > 0 ? (earnings / usageCount) : formData.licensingFee;
  const potentialIncrease    = avgEarningsPerUse > 0
    ? (((formData.licensingFee - avgEarningsPerUse) / avgEarningsPerUse) * 100).toFixed(1)
    : '0.0';


  // conversion rate: views → products
  const conversionRate = viewCount > 0 ? ((usageCount / viewCount) * 100).toFixed(1) : '—';


  // ── save ───────────────────────────────────────────────────────────────────
 const handleSave = async () => {
    if (!formData.name || !formData.category) {
      toast.error('Missing required fields', { description: 'Name and at least one category are required.' });
      return;
    }
    if (formData.isPublic && formData.licensingFee < 0.50) {
      toast.error('Licensing fee too low!', { description: 'Minimum is $0.50 per use.' });
      return;
    }
    if (formData.isPublic && formData.licensingFee > 20.00) {
      toast.warning('High licensing fee', { description: 'High fees may discourage usage.' });
    }

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1];      const res = await fetch(`/api/ip/${ipAsset._id || ipAsset.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name:         formData.name,
          description:  formData.description,
          category:     formData.category,
          tags:         formData.tags,
          licensingFee: formData.licensingFee,
          isPublic:     formData.isPublic,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      if (ipAsset?.isPublic && !formData.isPublic) {
        toast.success('IP set to private!', { description: 'Removed from library. Existing licenses remain active.' });
      } else if (!ipAsset?.isPublic && formData.isPublic) {
        toast.success('IP set to public!', { description: 'Will be available in library once active.' });
      } else {
        toast.success('IP updated successfully!', { description: 'Your changes have been saved.' });
      }

      onSaved?.({ ...ipAsset, ...formData });
      onOpenChange(false);
    } catch (err) {
      toast.error('Save failed', { description: err.message });
    }
  };

  const handleDelete = async () => {
    if (!ipAsset) return;

    const confirmed = window.confirm(
      `Delete "${ipAsset.name || 'this IP'}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeleting(true);

    try {
      // Reuse the same token approach as handleSave
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1];

      const res = await fetch(`/api/ip/${ipAsset._id || ipAsset.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Delete failed');
      }

      toast.success('IP deleted', {
        description: 'This IP asset has been permanently removed.',
      });

      // Let parent page remove it from its list if it wants
      onSaved?.({ ...ipAsset, _deleted: true });

      onOpenChange(false);
    } catch (err) {
      toast.error('Delete failed', { description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!ipAsset) return null;


  // whether the asset has on-chain IDs worth showing
  const hasOnChain = !!(
    ipAsset.algorandAssetId || ipAsset.assetId || ipAsset.nftAssetId ||
    ipAsset.revenueTokenId  || ipAsset.revTokenId ||
    ipAsset.contractAppId  || ipAsset.appId || ipAsset.smartContractId ||
    ipAsset.revenueTokenAssetId || ipAsset.revenuePoolAppId
  );


  const nftId  = ipAsset.algorandAssetId || ipAsset.assetId || ipAsset.nftAssetId;
  const revId  = ipAsset.revenueTokenAssetId || ipAsset.revenueTokenId || ipAsset.revTokenId;
  const appId  = ipAsset.revenuePoolAppId  || ipAsset.contractAppId  || ipAsset.appId || ipAsset.smartContractId;


  // badge color for status
  const statusColor =
    ipAsset.status === 'active'              ? 'bg-green-600'  :
    ipAsset.status === 'pending'             ? 'bg-yellow-600' :
    ipAsset.status?.startsWith('pending_')   ? 'bg-yellow-600' :
    'bg-slate-600';
  const statusLabel =
    ipAsset.status === 'active'              ? 'Active'         :
    ipAsset.status === 'pending'             ? 'Pending Review' :
    ipAsset.status === 'pending_nft_mint'    ? 'Minting NFT…'   :
    ipAsset.status === 'pending_pool_create' ? 'Creating Pool…' :
    (ipAsset.status || 'Unknown');


  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (tutorialStep >= 3 && tutorialStep <= 8) return;
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Edit IP Asset</DialogTitle>
          <DialogDescription>
            Update your IP details, visibility, licensing fees, and usage information
          </DialogDescription>
        </DialogHeader>


        <div className="grid gap-6 md:grid-cols-2">


          {/* ══════════════════════════════════════════════
              LEFT COLUMN — IP Details + editable fields
          ══════════════════════════════════════════════ */}
          <div className="space-y-6">


            {/* Preview image with live badge */}
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="aspect-square relative rounded-lg overflow-hidden bg-muted mb-3">
                  <img
                    src={ipAsset.imageUrl}
                    alt={ipAsset.name}
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute top-2 right-2">
                    {formData.isPublic ? (
                      <Badge className="bg-blue-600 flex items-center gap-1">
                        <Globe className="h-3 w-3" /> Public
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-600 flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Private
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="outline" className="w-full" size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload New Version
                </Button>
              </CardContent>
            </Card>


            {/* Visibility toggle */}
            <Card className="border-border bg-card" id="ip-visibility-toggle">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="isPublic" className="text-base font-semibold">
                      {formData.isPublic ? 'Public IP' : 'Private IP'}
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p><strong>Public:</strong> Available in IP library for licensing. Earn royalties.</p>
                          <p className="mt-1"><strong>Private:</strong> Only you can use. No cost in your products.</p>
                          <p className="mt-1 text-yellow-500">Note: Changing to private won't affect existing licenses.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-2">
                    {formData.isPublic
                      ? <Globe className="h-4 w-4 text-blue-500" />
                      : <Lock  className="h-4 w-4 text-slate-500" />}
                    <Switch
                      id="isPublic"
                      checked={formData.isPublic}
                      onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formData.isPublic
                    ? <>🌐 Visible in global IP library. Others can license it for royalties.</>
                    : <>🔒 Private to you. Free to use in your products. Hidden from library.</>}
                </p>
                {usageCount > 0 && !formData.isPublic && (
                  <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-muted-foreground">
                    ⚠️ This IP is used in {usageCount} products. Existing licenses remain active.
                  </div>
                )}
              </CardContent>
            </Card>


            {/* Basic Info */}
            <div className="space-y-4" id="ip-basic-info">
              <div className="space-y-2" id="ip-name-field">
                <Label htmlFor="name">IP Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Dragon Logo, Abstract Pattern"
                  className="bg-background border-border"
                />
              </div>


              <div className="space-y-2" id="ip-description-field">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={handleDescriptionChange}
                  placeholder="Describe your IP asset and intended use..."
                  className="bg-background border-border min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground text-right">{charCount}/500</p>
              </div>


              {/* CategoryPicker — replaces hardcoded accordion */}
              <div className="space-y-1.5" id="ip-category-field">
                <div className="flex items-center justify-between">
                  <Label>Categories * <span className="text-xs text-muted-foreground">(select all that apply)</span></Label>
                </div>
                <CategoryPicker
                  value={formData.category}
                  onChange={(v) => setFormData({ ...formData, category: v })}
                />
              </div>


              <div className="space-y-2" id="ip-tags-field">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  value={Array.isArray(formData.tags) ? formData.tags.join(', ') : formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="e.g. vintage, cool, urban, modern"
                  className="bg-background border-border"
                />
                <p className="text-xs text-muted-foreground">
                  Help others discover your IP with relevant tags
                </p>
              </div>
            </div>
          </div>


          {/* ══════════════════════════════════════════════
              RIGHT COLUMN — Licensing + Stats + On-Chain
          ══════════════════════════════════════════════ */}
          <div className="space-y-5">


            {/* ── Licensing Fee (public only) ──────────────── */}
            {formData.isPublic && (
              <Card className="border-border bg-card" id="ip-licensing-fee">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Licensing Fee
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fee">Per-Use Royalty *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        id="fee"
                        type="number"
                        step="0.25"
                        min="0.50"
                        max="20.00"
                        value={formData.licensingFee}
                        onChange={(e) => setFormData({ ...formData, licensingFee: parseFloat(e.target.value) || 0 })}
                        className="pl-7 bg-background border-border"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Amount earned each time this IP is used on a product
                    </p>
                  </div>


                  <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Recommended Range:</span>
                      <span className="font-semibold text-foreground">$1.50 – $5.00</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formData.licensingFee < 1.50
                        ? '⚠️ Lower fees encourage more usage'
                        : formData.licensingFee > 5.00
                          ? '⚠️ Higher fees may limit adoption'
                          : '✓ Within optimal range'}
                    </div>
                  </div>


                  {usageCount > 0 && (
                    <div className="p-3 rounded-lg border border-border bg-background">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">Impact Analysis</span>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <StatRow label="Current avg/use" value={`$${avgEarningsPerUse.toFixed(2)}`} />
                        <StatRow label="New earnings/use" value={`$${formData.licensingFee.toFixed(2)}`} />
                        {Math.abs(potentialIncrease) > 1 && (
                          <StatRow
                            label="Change"
                            value={`${potentialIncrease > 0 ? '+' : ''}${potentialIncrease}%`}
                            valueClass={potentialIncrease > 0 ? 'text-green-500' : 'text-red-500'}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}


            {/* ── Private IP benefits ──────────────────────── */}
            {!formData.isPublic && (
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    Private IP Benefits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    'Free to use in all your products',
                    'No licensing costs deducted',
                    'Hidden from public library',
                    'Exclusive to your brand',
                  ].map(b => (
                    <div key={b} className="flex items-start gap-2 text-sm">
                      <div className="rounded-full bg-green-500/20 p-1 mt-0.5">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                      </div>
                      <span className="text-muted-foreground">{b}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}


            {/* ── Performance Stats ────────────────────────── */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 2×2 stat grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
                      <ShoppingCart className="h-3.5 w-3.5" /> Products
                    </div>
                    <p className="text-xl font-bold">{usageCount}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" /> Views
                    </div>
                    <p className="text-xl font-bold">{viewCount}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" /> Revenue
                    </div>
                    <p className="text-xl font-bold">${totalRevenue.toFixed(0)}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" /> Avg Price
                    </div>
                    <p className="text-xl font-bold">${avgProductPrice.toFixed(2)}</p>
                  </div>
                </div>


                <Separator className="bg-border" />


                {/* secondary row stats */}
                <div className="space-y-2">
                  {formData.isPublic && (
                    <StatRow
                      label="Pool earnings"
                      value={`$${earnings.toFixed(2)}`}
                      valueClass="text-green-500"
                    />
                  )}
                  {usageCount > 0 && formData.isPublic && (
                    <StatRow
                      label="Avg earnings/use"
                      value={`$${(earnings / usageCount).toFixed(2)}`}
                    />
                  )}
                  <StatRow
                    label="Conversion (views → products)"
                    value={conversionRate !== '—' ? `${conversionRate}%` : '—'}
                  />
                </div>


                <Separator className="bg-border" />


                {/* projected earnings box */}
                {formData.isPublic ? (
                  <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                    <div className="text-xs text-muted-foreground mb-1">Projected Monthly Earnings</div>
                    <div className="text-2xl font-bold">
                      ${(formData.licensingFee * Math.max(usageCount, 10)).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Based on {Math.max(usageCount, 10)} uses/month @ ${formData.licensingFee.toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Cost Savings (private)</div>
                    <div className="text-2xl font-bold text-green-500">
                      ${(2.50 * usageCount).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Saved vs $2.50/use public rate
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>


            {/* ── Stakeholders ─────────────────────────────── */}
            {stakeholders.length > 0 && (
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Revenue Splits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stakeholders.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                          {(s.name || s.address || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-muted-foreground truncate max-w-[140px]" title={s.address}>
                          {s.name || `${String(s.address).slice(0, 8)}…`}
                        </span>
                      </div>
                      <Badge variant="outline" className="shrink-0 font-mono text-xs">
                        {s.percentage}%
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}


            {/* ── On-Chain Asset IDs ───────────────────────── */}
            {hasOnChain && (
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary" />
                    On-Chain Assets
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {nftId && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">NFT Asset ID</span>
                      <AlgoExplorerLink id={nftId} type="asset" />
                    </div>
                  )}
                  {revId && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Revenue Token ID</span>
                      <AlgoExplorerLink id={revId} type="asset" />
                    </div>
                  )}
                  {appId && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Pool App ID</span>
                      <AlgoExplorerLink id={appId} type="application" />
                    </div>
                  )}
                  {ipAsset.ownerWallet && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Wallet className="h-3 w-3" /> Creator Wallet
                      </span>
                      <span className="font-mono text-xs text-muted-foreground" title={ipAsset.ownerWallet}>
                        {ipAsset.ownerWallet.slice(0, 6)}…{ipAsset.ownerWallet.slice(-4)}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}


            {/* ── Asset Dates & Status ─────────────────────── */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Asset Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={statusColor}>{statusLabel}</Badge>
                </div>
                <StatRow label="Minted" value={fmtDate(ipAsset.createdAt)} />
                {ipAsset.updatedAt && (
                  <StatRow label="Last updated" value={fmtDate(ipAsset.updatedAt)} />
                )}


                {/* contextual notice — pending only */}
                {ipAsset.status === 'pending' && formData.isPublic && (
                  <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-muted-foreground">
                    ⏳ Processing on-chain. Usually completes within a few minutes.
                  </div>
                )}
              </CardContent>
            </Card>


          </div>{/* end right column */}
        </div>


        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={isDeleting}
          >
            Cancel
          </Button>

          <Button
            variant="outline"
            className="flex-1 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete IP
              </>
            )}
          </Button>

          <Button
            onClick={handleSave}
            className="flex-1 bg-primary"
            id="ip-save-button"
            disabled={isDeleting}
          >
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}