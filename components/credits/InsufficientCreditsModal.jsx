'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const CREDIT_PACKAGES = [
  { id: 'credits_1',  qty: 1,  price: 4.99,  label: 'Single',     highlight: false },
  { id: 'credits_3',  qty: 3,  price: 12.99, label: 'Trio',       highlight: false },
  { id: 'credits_5',  qty: 5,  price: 19.99, label: 'Best Value',  highlight: true  },
  { id: 'credits_10', qty: 10, price: 34.99, label: 'Power Pack',  highlight: false },
];

export default function InsufficientCreditsModal({ open, onClose, onSuccess }) {
  const { getAuthHeader } = useAuth();
  const [selected, setSelected] = useState('credits_5');
  const [loading, setLoading] = useState(false);

  const chosen = CREDIT_PACKAGES.find((p) => p.id === selected);

  const handleBuy = async () => {
    if (!chosen) return;
    setLoading(true);
    try {
      const res = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          priceId: chosen.id,
          quantity: chosen.qty,
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
            You're out of Mint Credits
          </DialogTitle>
          <DialogDescription>
            Each IP or Product mint costs 1 credit. Buy a pack below to continue.
          </DialogDescription>
        </DialogHeader>

        {/* Package selector */}
        <div className="grid grid-cols-2 gap-3 py-2">
          {CREDIT_PACKAGES.map((pkg) => (
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
                  Best Value
                </Badge>
              )}
              <span className="text-lg font-bold leading-none">
                {pkg.qty} Credit{pkg.qty > 1 ? 's' : ''}
              </span>
              <span className="text-sm text-muted-foreground">${pkg.price.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground">
                ${(pkg.price / pkg.qty).toFixed(2)}&nbsp;/ credit
              </span>
            </button>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-2 pt-1">
          <Button className="w-full gap-2" onClick={handleBuy} disabled={loading}>
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
                Buy {chosen?.qty} Credit{chosen?.qty > 1 ? 's' : ''} — ${chosen?.price.toFixed(2)}
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