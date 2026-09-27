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
import { Zap, ShoppingCart, Loader2, ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useWallet } from '@/lib/WalletContext';
import algosdk from 'algosdk';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
const MINT_COST = 25;

// ── Inline payment form ──────────────────────────────────────────────────────
function CreditPaymentForm({ chosen, onBack, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setPaymentError(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
            return_url: `${window.location.origin}${window.location.pathname}?credits_purchased=1`,
        },
        redirect: 'if_required',
        });

        
    if (error) {
      setPaymentError(error.message);
      setProcessing(false);
    } else if (paymentIntent?.status === 'succeeded') {
      onSuccess(chosen);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
        <span className="font-medium">{chosen.credits.toLocaleString()} Credits</span>
        <span className="font-bold">${chosen.priceUsd.toFixed(2)}</span>
      </div>

      {paymentError && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {paymentError}
        </p>
      )}

      <div className="rounded-lg border bg-muted/20 p-3">
        <PaymentElement />
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack} disabled={processing}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button type="submit" className="flex-1" disabled={!stripe || processing}>
          {processing
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing…</>
            : <><Check className="h-4 w-4 mr-2" /> Pay ${chosen.priceUsd.toFixed(2)}</>
          }
        </Button>
      </div>
    </form>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────
export default function InsufficientCreditsModal({ open, onClose, onSuccess }) {
  const { getAuthHeader } = useAuth();
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [selected, setSelected] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const { signTransactionGroup, accountAddress: connectedWalletAddress } = useWallet();
  const [usdcSubmitting, setUsdcSubmitting] = useState(false);
  const [usdcError, setUsdcError] = useState('');
  const [loadingSecret, setLoadingSecret] = useState(false);

  function bytesToBase64(bytes) {
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return window.btoa(binary);
  }

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setSelected(null);
    }
  }, [open]);

  // Load packs
  useEffect(() => {
    if (!open) return;
    setLoadingPackages(true);
    fetch('/api/admin/credit-packs')
      .then((r) => r.json())
      .then((data) => {
        const raw = data.packs ?? data.packages ?? [];
        if (data.success && raw.length) {
          const normalized = raw.map((p) => ({
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
    setLoadingSecret(true);
    try {
      const res = await fetch('/api/checkout/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ priceId: chosen.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize payment');
      setClientSecret(data.clientSecret);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingSecret(false);
    }
  };

  const handlePayWithUsdc = async (pkg) => {
    if (!pkg) return;

    if (!connectedWalletAddress) {
      setUsdcError('Connect a verified Algorand wallet before paying with USDC.');
      return;
    }

    setUsdcSubmitting(true);
    setUsdcError('');

    try {
      const prepareRes = await fetch('/api/credits/usdc/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          priceId: pkg.id,
          walletAddress: connectedWalletAddress,
        }),
      });

      const prepareData = await prepareRes.json();

      if (!prepareRes.ok || !prepareData?.success) {
        throw new Error(prepareData?.error || 'Unable to prepare the USDC payment.');
      }

      const { transaction, attemptId, expectedTransactionId } = prepareData;

      const unsignedTransactionBytes = Uint8Array.from(
        window.atob(transaction.txnBase64),
        (character) => character.charCodeAt(0)
      );

      const unsignedTransaction = algosdk.decodeUnsignedTransaction(
        unsignedTransactionBytes
      );

      if (unsignedTransaction.txID() !== expectedTransactionId) {
        throw new Error('The prepared USDC transaction does not match the expected payment.');
      }

      const signedTransactionGroup = await signTransactionGroup([
        unsignedTransactionBytes,
      ]);

      const signedTransactionBytes = signedTransactionGroup?.[0];

      if (
        !signedTransactionBytes ||
        !(signedTransactionBytes instanceof Uint8Array) ||
        signedTransactionBytes.length === 0
      ) {
        throw new Error('Pera did not return a signed USDC transaction.');
      }

      const submitRes = await fetch('/api/credits/usdc/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          attemptId,
          expectedTransactionId,
          signedTransactionBase64: bytesToBase64(signedTransactionBytes),
        }),
      });

      const submitData = await submitRes.json();

      if (!submitRes.ok || !submitData?.success) {
        throw new Error(submitData?.error || 'Unable to confirm the USDC payment.');
      }

      toast.success(`${submitData.creditsAdded.toLocaleString()} credits added via USDC!`);
      handlePaymentSuccess(pkg);
    } catch (error) {
      const message = error?.message || 'Unable to complete the USDC payment.';

      if (/cancel|reject|deny|decline|abort/i.test(message)) {
        toast.message('USDC payment cancelled.');
      } else {
        setUsdcError(message);
        toast.error(message);
      }
    } finally {
      setUsdcSubmitting(false);
    }
  };
  
  const handlePaymentSuccess = (pack) => {
    toast.success(`${pack.credits.toLocaleString()} credits added!`);
    onSuccess?.(pack);
    onClose();
  };

  const appearance = { theme: 'night', variables: { colorPrimary: '#16a34a' } };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-yellow-500" />
            {clientSecret ? 'Complete Purchase' : "You're out of Mint Credits"}
          </DialogTitle>
          <DialogDescription>
            {clientSecret
              ? `Adding ${chosen?.credits?.toLocaleString()} credits to your account`
              : <>Each mint costs <strong>{MINT_COST} credits</strong>. Each credit is $0.01 USD.</>
            }
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Pick a pack ── */}
        {!clientSecret && (
          <>
            {loadingPackages ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : packages.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No credit packages available right now.
              </p>
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
              <Button className="w-full gap-2" onClick={handleBuy} disabled={loadingSecret || loadingPackages || !chosen}>
                {loadingSecret
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
                  : <><ShoppingCart className="h-4 w-4" /> Buy {chosen?.credits?.toLocaleString()} Credits — ${chosen?.priceUsd?.toFixed(2)}</>
                }
              </Button>
                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={usdcSubmitting || !chosen}
                  onClick={() => handlePayWithUsdc(chosen)}
                >
                  {usdcSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Waiting for Pera
                    </>
                  ) : (
                    'Pay with USDC (Pera Wallet)'
                  )}
                </Button>

                {usdcError ? (
                  <p className="text-sm text-destructive">{usdcError}</p>
                ) : null}

                <Button variant="ghost" className="w-full" onClick={onClose}>Cancel</Button>
              </div>
            </>
        )}

        {/* ── Step 2: Inline card form ── */}
        {clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
            <CreditPaymentForm
              chosen={chosen}
              onBack={() => setClientSecret(null)}
              onSuccess={handlePaymentSuccess}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
}