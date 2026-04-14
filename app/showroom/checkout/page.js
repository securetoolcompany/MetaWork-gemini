'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, ArrowLeft, Truck, Check, Loader2, Tag, ShoppingBag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import countries from '@/data/countries.json';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

function CheckoutContent() {
  const { items, totalPrice, clearCart } = useCart();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState(null);

  // Promo Code State
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');

  const [shippingInfo, setShippingInfo] = useState({
    email: '', name: '', address1: '', city: '', state_code: '', zip: '', country_code: 'US' 
  });

  const subtotal = totalPrice || 0;
  const shipping = subtotal > 50 ? 0 : 5.99; 
  const estimatedTax = subtotal * 0.08; 
  const displayTotal = subtotal + shipping + estimatedTax;

  // Check if Stripe just sent us back after a successful payment
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setStep(3);
      clearCart();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  }, [searchParams, clearCart]);

  if ((items?.length ?? 0) === 0 && step !== 3) {
    return (
      <div className="min-h-screen bg-background pt-16 text-center">
        <h1 className="text-4xl font-bold mb-4">Your cart is empty</h1>
        <p className="text-muted-foreground mb-6">Add some products to checkout</p>
        <Link href="/showroom">
          <Button>Continue Shopping</Button>
        </Link>
      </div>
    );
  }

  const handleShippingSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items,
          shippingInfo: shippingInfo,
          shippingCost: shipping,
          promoCode: appliedPromo
        }),
      });

      const data = await response.json();
      
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setStep(2);
      } else {
        throw new Error(data.error || "Failed to initialize payment");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong loading the payment system.");
    }
  };

  const appearance = { theme: 'night', variables: { colorPrimary: '#16a34a' } };

  // SUCCESS SCREEN (STEP 3)
  if (step === 3) {
    const orderNumber = Math.floor(100000 + Math.random() * 900000);
    return (
      <div className="min-h-screen bg-background pt-8 px-4">
        <div className="max-w-3xl mx-auto py-16">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>
            <p className="text-muted-foreground mb-6">Thank you for your purchase. Your order has been received.</p>
            <div className="bg-muted rounded-lg p-6 mb-8 inline-block">
              <p className="text-sm text-muted-foreground mb-1">Order Number</p>
              <p className="text-2xl font-bold">#{orderNumber}</p>
            </div>
            <div className="space-y-3 max-w-sm mx-auto">
              <Link href="/showroom">
                <Button className="w-full" size="lg">Continue Shopping</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" className="w-full">View Order in Dashboard</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-8 pb-16">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* RE-ADDED THE STEP TRACKER HERE */}
        <div className="flex items-center justify-center mb-12">
          {[
            { num: 1, label: 'Shipping' },
            { num: 2, label: 'Payment' },
            { num: 3, label: 'Confirmation' },
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                  step >= s.num ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {step > s.num ? <Check className="w-5 h-5" /> : s.num}
                </div>
                <span className={`text-xs mt-2 ${step >= s.num ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
              </div>
              {idx < 2 && (
                <div className={`w-16 md:w-32 h-1 mx-2 md:mx-4 rounded-full transition-colors ${step > s.num ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="max-w-3xl mx-auto mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {step === 1 && (
              <ShippingStep 
                shippingInfo={shippingInfo}
                setShippingInfo={setShippingInfo}
                onSubmit={handleShippingSubmit}
              />
            )}

            {step === 2 && clientSecret && (
              <Elements options={{ clientSecret, appearance }} stripe={stripePromise}>
                <PaymentStep onBack={() => setStep(1)} />
              </Elements>
            )}
          </div>

          <OrderSummary
            cart={items}
            subtotal={subtotal}
            shipping={shipping}
            tax={estimatedTax}
            total={displayTotal}
            promoCodeInput={promoCodeInput}
            setPromoCodeInput={setPromoCodeInput}
            appliedPromo={appliedPromo}
            setAppliedPromo={setAppliedPromo}
            step={step}
          />
        </div>
      </div>
    </div>
  );
}

// Wrap the main content in Suspense to safely use useSearchParams in Next.js App Router
export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}

function ShippingStep({ shippingInfo, setShippingInfo, onSubmit }) {
  return (
    <Card className="p-6 border-muted/60 shadow-sm">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Truck className="w-6 h-6 text-primary" />
        Shipping Information
      </h2>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" required value={shippingInfo.name} onChange={(e) => setShippingInfo({ ...shippingInfo, name: e.target.value })} placeholder="John Doe" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" required value={shippingInfo.email} onChange={(e) => setShippingInfo({ ...shippingInfo, email: e.target.value })} placeholder="john@example.com" className="mt-1.5" />
          </div>
        </div>
        <div>
          <Label htmlFor="address1">Street Address</Label>
          <Input id="address1" required value={shippingInfo.address1} onChange={(e) => setShippingInfo({ ...shippingInfo, address1: e.target.value })} placeholder="123 Main St" className="mt-1.5" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="col-span-2 md:col-span-1">
            <Label htmlFor="city">City</Label>
            <Input id="city" required value={shippingInfo.city} onChange={(e) => setShippingInfo({ ...shippingInfo, city: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="state_code">State / Province</Label>
            <Input id="state_code" required value={shippingInfo.state_code} onChange={(e) => setShippingInfo({ ...shippingInfo, state_code: e.target.value })} placeholder="NY" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="zip">Postal Code</Label>
            <Input id="zip" required value={shippingInfo.zip} onChange={(e) => setShippingInfo({ ...shippingInfo, zip: e.target.value })} className="mt-1.5" />
          </div>
        </div>
        <div>
          <Label htmlFor="country">Country</Label>
          <select 
            id="country"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1.5"
            value={shippingInfo.country_code} 
            onChange={(e) => setShippingInfo({...shippingInfo, country_code: e.target.value})}
          >
            {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div className="pt-4">
          <Button type="submit" className="w-full h-12 text-base">Continue to Payment</Button>
        </div>
      </form>
    </Card>
  );
}

function PaymentStep({ onBack }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setPaymentError(null);

    // This return_url is key: It sends them back to THIS page with ?success=true
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/showroom/checkout?success=true` },
    });

    if (error) {
      setPaymentError(error.message);
      setIsProcessing(false);
    }
  };

  return (
    <Card className="p-6 border-muted/60 shadow-sm">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Check className="w-6 h-6 text-green-500" />
        Secure Payment
      </h2>
      {paymentError && <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20 text-sm font-medium">{paymentError}</div>}
      <form onSubmit={handleSubmit}>
        <div className="p-4 border rounded-lg bg-muted/30 mb-6">
          <PaymentElement />
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1 h-12" onClick={onBack} disabled={isProcessing}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12 text-base" disabled={!stripe || isProcessing}>
            {isProcessing ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</> : `Confirm & Pay`}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function OrderSummary({ cart, subtotal, shipping, tax, total, promoCodeInput, setPromoCodeInput, appliedPromo, setAppliedPromo, step }) {
  const handleApplyPromo = () => {
    if (!promoCodeInput.trim()) return;
    setAppliedPromo(promoCodeInput.toUpperCase());
  };

  return (
    <div className="lg:col-span-1">
      <Card className="p-6 sticky top-24 border-muted/60 shadow-sm">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5" /> Order Summary
        </h3>
        
        {step === 1 && (
          <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border/50">
            <Label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase tracking-wider">Promo Code</Label>
            <div className="flex gap-2">
              <Input placeholder="Enter code" value={promoCodeInput} onChange={(e) => setPromoCodeInput(e.target.value)} disabled={!!appliedPromo} className="bg-background" />
              <Button variant={appliedPromo ? "outline" : "default"} onClick={appliedPromo ? () => { setAppliedPromo(''); setPromoCodeInput(''); } : handleApplyPromo}>
                {appliedPromo ? 'Remove' : 'Apply'}
              </Button>
            </div>
            {appliedPromo && (
              <p className="text-xs text-green-500 mt-3 flex items-center gap-1.5 font-medium">
                <Tag className="w-3.5 h-3.5" /> Code {appliedPromo} applied
              </p>
            )}
          </div>
        )}

        <div className="space-y-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-medium text-foreground">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Shipping</span>
            <span className="font-medium text-foreground">${shipping.toFixed(2)}</span>
          </div>
          {step === 1 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Estimated Tax</span>
              <span className="font-medium text-foreground">${tax.toFixed(2)}</span>
            </div>
          )}
          <Separator className="my-4" />
          <div className="flex justify-between text-lg font-bold">
            <span>Total {step === 1 ? '(Est.)' : ''}</span>
            <span className="text-primary">${total.toFixed(2)}</span>
          </div>
          {step === 2 && (
            <p className="text-xs text-center text-muted-foreground mt-4 bg-muted/30 p-3 rounded-md">
              Final tax and discounts are calculated securely by Stripe.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}