'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, ShoppingCart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const MINT_COST = 25; // credits per mint

export default function InsufficientCreditsModal({ open, onClose, onSuccess }) {
  const { getAuthHeader } = useAuth();
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingPackages(true);
    fetch('/api/admin/credit-packs')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.packs?.length) {
            const normalized = data.packs.map((p) => ({
            ...p,
            id: p._id?.toString() ?? p.id,
            priceUsd: p.priceUsd ?? p.priceUSDC,
            }));
            setPackages(normalized);
            const highlighted = normalized.find((p) => p.highlight);
            setSelected((highlighted ?? normalized[0]).id);
        }
        })
      .catch(() => toast.error('Failed to load credit packages'))
      .finally(() => setLoadingPackages(false));
  }, [open]);

  const chosen = packages.find((p) => p.id === selected);

  const handleBuy = async () => {
    if (!chosen) return;
    setLoading(true);
    try {
      const res = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          priceId: chosen.id,
          credits: chosen.credits,
          priceUsd: chosen.priceUsd,
          successUrl: `${window.location.href}?credits_purchased=1`,
          cancelUrl: window.location.href,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.message);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-yellow-500" />
            You&apos;re out of Mint Credits
          </DialogTitle>
          <DialogDescription>
            Each mint costs <strong>{MINT_COST} credits</strong>. Each credit is $0.01 USD.
          </DialogDescription>
        </DialogHeader>

        {loadingPackages ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 py-2">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => setSelected(pkg.id)}
                className={[
                  'relative flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all',
                  selected === pkg.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border bg-card hover:border-primary/50',
                ].join(' ')}
              >
                {pkg.highlight && (
                  <Badge className="absolute -top-2 right-2 text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">
                    {pkg.label || 'Best Value'}
                  </Badge>
                )}
                <span className="text-lg font-bold leading-none">
                  {pkg.credits.toLocaleString()} Credits
                </span>
                <span className="text-sm text-muted-foreground">${pkg.priceUsd.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">
                  {Math.floor(pkg.credits / MINT_COST)} mint{Math.floor(pkg.credits / MINT_COST) !== 1 ? 's' : ''}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <Button className="w-full gap-2" onClick={handleBuy} disabled={loading || loadingPackages || !chosen}>
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Redirecting to checkout…
              </span>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Buy {chosen?.credits?.toLocaleString()} Credits — ${chosen?.priceUsd?.toFixed(2)}
              </>
            )}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}