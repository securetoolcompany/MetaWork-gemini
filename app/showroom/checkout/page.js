'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  ArrowLeft,
  Truck,
  Check,
  Loader2,
  Tag,
  ShoppingBag,
} from 'lucide-react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import {
  COUNTRIES,
  getRegionsForCountry,
  countryRequiresRegion,
} from '@/lib/addressCodes';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

const REQUIRED_ADDRESS_FIELDS = [
  'email',
  'name',
  'phone',
  'address1',
  'city',
  'zip',
  'country_code',
];

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(Number(amount ?? 0));
}

function CheckoutContent() {
  const { items, totalPrice, clearCart } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState(null);

  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');

  const [shippingInfo, setShippingInfo] = useState({
    email: '',
    name: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    state_code: '',
    zip: '',
    country_code: 'US',
  });

  const [shippingQuote, setShippingQuote] = useState(null);
  const [selectedRateId, setSelectedRateId] = useState('');
  const [shippingQuoteLoading, setShippingQuoteLoading] = useState(false);
  const [shippingQuoteError, setShippingQuoteError] = useState('');

  const subtotal = Number(totalPrice ?? 0);

  const regions = useMemo(
    () => getRegionsForCountry(shippingInfo.country_code),
    [shippingInfo.country_code]
  );

  const requiresRegion = useMemo(
    () => countryRequiresRegion(shippingInfo.country_code),
    [shippingInfo.country_code]
  );

  const addressIsComplete = useMemo(() => {
    const hasRequiredFields = REQUIRED_ADDRESS_FIELDS.every((field) =>
      String(shippingInfo[field] ?? '').trim()
    );

    return hasRequiredFields && (!requiresRegion || shippingInfo.state_code);
  }, [shippingInfo, requiresRegion]);

  const selectedShippingRate = useMemo(
    () =>
      shippingQuote?.rates?.find(
        (rate) => String(rate.id) === String(selectedRateId)
      ) ?? null,
    [shippingQuote, selectedRateId]
  );

  const quoteExpired = useMemo(() => {
    if (!shippingQuote?.expiresAt) {
      return true;
    }

    return new Date(shippingQuote.expiresAt).getTime() <= Date.now();
  }, [shippingQuote?.expiresAt]);

  const shipping = Number(selectedShippingRate?.amount ?? 0);

  /*
   * Tax is authoritative only after /api/checkout creates the Stripe Tax
   * calculation. Do not fabricate a browser tax estimate.
   */
  const tax = 0;
  const displayTotal = subtotal + shipping + tax;

  const paymentStartDisabled =
    !addressIsComplete ||
    shippingQuoteLoading ||
    !shippingQuote ||
    quoteExpired ||
    !selectedShippingRate ||
    Boolean(shippingQuoteError);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setStep(3);
      clearCart();
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [searchParams, clearCart]);

  /*
   * Create/recreate a quote only after the address is complete. Any address
   * change clears rate selection immediately, then starts a new request after
   * 500 ms. Cart data stays server-derived by /api/shipping/rates.
   */
  useEffect(() => {
    if (!addressIsComplete) {
      setShippingQuote(null);
      setSelectedRateId('');
      setShippingQuoteError('');
      setShippingQuoteLoading(false);
      return undefined;
    }

    const controller = new AbortController();

    const timeoutId = window.setTimeout(async () => {
      try {
        setShippingQuoteLoading(true);
        setShippingQuoteError('');
        setShippingQuote(null);
        setSelectedRateId('');

        const response = await fetch('/api/shipping/rates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({
            shippingInfo,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || 'Unable to calculate shipping for this address.'
          );
        }

        setShippingQuote(data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setShippingQuoteError(
            err.message || 'Unable to calculate shipping for this address.'
          );
          setShippingQuote(null);
          setSelectedRateId('');
        }
      } finally {
        if (!controller.signal.aborted) {
          setShippingQuoteLoading(false);
        }
      }
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [
    addressIsComplete,
    shippingInfo.email,
    shippingInfo.name,
    shippingInfo.phone,
    shippingInfo.address1,
    shippingInfo.address2,
    shippingInfo.city,
    shippingInfo.state_code,
    shippingInfo.zip,
    shippingInfo.country_code,
  ]);

  if ((items?.length ?? 0) === 0 && step !== 3) {
    return (
      <div className="min-h-screen bg-background pt-16 text-center">
        <h1 className="mb-4 text-4xl font-bold">Your cart is empty</h1>
        <p className="mb-6 text-muted-foreground">
          Add some products to checkout
        </p>
        <Link href="/showroom">
          <Button>Continue Shopping</Button>
        </Link>
      </div>
    );
  }

  const handleShippingSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (paymentStartDisabled) {
      if (shippingQuoteLoading) {
        setError('Calculating shipping. Please wait a moment.');
      } else if (quoteExpired) {
        setError('Your shipping quote expired. Please update the address to recalculate it.');
      } else if (!selectedShippingRate) {
        setError('Select a shipping method before continuing to payment.');
      } else {
        setError('Enter a complete valid shipping address to continue.');
      }

      return;
    }

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          quoteId: shippingQuote.quoteId,
          rateId: selectedRateId,
          promoCode: appliedPromo,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.clientSecret) {
        throw new Error(data.error || 'Failed to initialize payment.');
      }

      setClientSecret(data.clientSecret);
      setStep(2);
    } catch (err) {
      console.error('[checkout]', err);
      setError(err.message || 'Something went wrong loading the payment system.');
    }
  };

  const appearance = {
    theme: 'night',
    variables: {
      colorPrimary: '#16a34a',
    },
  };

  if (step === 3) {
    const orderNumber = Math.floor(100000 + Math.random() * 900000);

    return (
      <div className="min-h-screen bg-background px-4 pt-8">
        <div className="mx-auto max-w-3xl py-16">
          <Card className="p-8 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
              <Check className="h-8 w-8 text-white" />
            </div>

            <h1 className="mb-2 text-3xl font-bold">Order Confirmed!</h1>

            <p className="mb-6 text-muted-foreground">
              Thank you for your purchase. Your order has been received.
            </p>

            <div className="mb-8 inline-block rounded-lg bg-muted p-6">
              <p className="mb-1 text-sm text-muted-foreground">
                Order Number
              </p>
              <p className="text-2xl font-bold">#{orderNumber}</p>
            </div>

            <div className="mx-auto max-w-sm space-y-3">
              <Link href="/showroom">
                <Button className="w-full" size="lg">
                  Continue Shopping
                </Button>
              </Link>

              <Link href="/dashboard">
                <Button variant="outline" className="w-full">
                  View Order in Dashboard
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16 pt-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-12 flex items-center justify-center">
          {[
            { num: 1, label: 'Shipping' },
            { num: 2, label: 'Payment' },
            { num: 3, label: 'Confirmation' },
          ].map((currentStep, index) => (
            <div key={currentStep.num} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold transition-colors ${
                    step >= currentStep.num
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step > currentStep.num ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    currentStep.num
                  )}
                </div>

                <span
                  className={`mt-2 text-xs ${
                    step >= currentStep.num
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {currentStep.label}
                </span>
              </div>

              {index < 2 && (
                <div
                  className={`mx-2 h-1 w-16 rounded-full transition-colors md:mx-4 md:w-32 ${
                    step > currentStep.num ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mx-auto mb-6 flex max-w-3xl items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {step === 1 && (
              <ShippingStep
                shippingInfo={shippingInfo}
                setShippingInfo={setShippingInfo}
                regions={regions}
                requiresRegion={requiresRegion}
                shippingQuote={shippingQuote}
                selectedRateId={selectedRateId}
                setSelectedRateId={setSelectedRateId}
                shippingQuoteLoading={shippingQuoteLoading}
                shippingQuoteError={shippingQuoteError}
                quoteExpired={quoteExpired}
                paymentStartDisabled={paymentStartDisabled}
                onSubmit={handleShippingSubmit}
              />
            )}

            {step === 2 && clientSecret && (
              <Elements
                options={{ clientSecret, appearance }}
                stripe={stripePromise}
              >
                <PaymentStep
                  onBack={() => {
                    setClientSecret('');
                    setStep(1);
                  }}
                />
              </Elements>
            )}
          </div>

          <OrderSummary
            cart={items}
            subtotal={subtotal}
            shipping={shipping}
            selectedShippingRate={selectedShippingRate}
            quoteLoading={shippingQuoteLoading}
            tax={tax}
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

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}

function ShippingStep({
  shippingInfo,
  setShippingInfo,
  regions,
  requiresRegion,
  shippingQuote,
  selectedRateId,
  setSelectedRateId,
  shippingQuoteLoading,
  shippingQuoteError,
  quoteExpired,
  paymentStartDisabled,
  onSubmit,
}) {
  const updateField = (field, value) => {
    setShippingInfo((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleCountryChange = (event) => {
    const countryCode = event.target.value;

    setShippingInfo((previous) => ({
      ...previous,
      country_code: countryCode,
      state_code: '',
    }));
  };

  return (
    <Card className="border-muted/60 p-6 shadow-sm">
      <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <Truck className="h-6 w-6 text-primary" />
        Shipping Information
      </h2>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              required
              value={shippingInfo.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="John Doe"
              autoComplete="name"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              required
              value={shippingInfo.email}
              onChange={(event) => updateField('email', event.target.value)}
              placeholder="john@example.com"
              autoComplete="email"
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            required
            value={shippingInfo.phone}
            onChange={(event) => updateField('phone', event.target.value)}
            placeholder="+1 555 555 5555"
            autoComplete="tel"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="address1">Street Address</Label>
          <Input
            id="address1"
            required
            value={shippingInfo.address1}
            onChange={(event) => updateField('address1', event.target.value)}
            placeholder="123 Main St"
            autoComplete="address-line1"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="address2">Apartment, suite, etc. (optional)</Label>
          <Input
            id="address2"
            value={shippingInfo.address2}
            onChange={(event) => updateField('address2', event.target.value)}
            placeholder="Apartment 4B"
            autoComplete="address-line2"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="country">Country</Label>
          <select
            id="country"
            required
            className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={shippingInfo.country_code}
            onChange={handleCountryChange}
            autoComplete="country"
          >
            <option value="">Select country</option>
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="col-span-2 md:col-span-1">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              required
              value={shippingInfo.city}
              onChange={(event) => updateField('city', event.target.value)}
              autoComplete="address-level2"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="state_code">
              {regions.length > 0 ? 'State / Province' : 'State / Region'}
            </Label>

            {regions.length > 0 ? (
              <select
                id="state_code"
                required={requiresRegion}
                value={shippingInfo.state_code}
                onChange={(event) =>
                  updateField('state_code', event.target.value)
                }
                autoComplete="address-level1"
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select state / province</option>
                {regions.map((region) => (
                  <option key={region.code} value={region.code}>
                    {region.name}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="state_code"
                required={requiresRegion}
                value={shippingInfo.state_code}
                onChange={(event) =>
                  updateField(
                    'state_code',
                    event.target.value.trim().toUpperCase()
                  )
                }
                placeholder="Region code"
                autoComplete="address-level1"
                className="mt-1.5"
              />
            )}
          </div>

          <div>
            <Label htmlFor="zip">Postal Code</Label>
            <Input
              id="zip"
              required
              value={shippingInfo.zip}
              onChange={(event) => updateField('zip', event.target.value)}
              autoComplete="postal-code"
              className="mt-1.5"
            />
          </div>
        </div>

        <section className="border-t pt-5">
          <h3 className="text-lg font-semibold">Shipping Method</h3>

          {!shippingQuoteLoading &&
            !shippingQuoteError &&
            !shippingQuote && (
              <p className="mt-2 text-sm text-muted-foreground">
                Complete your shipping address to calculate delivery options.
              </p>
            )}

          {shippingQuoteLoading && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculating shipping…
            </div>
          )}

          {shippingQuoteError && (
            <div
              className="mt-3 flex items-center gap-2 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="h-4 w-4" />
              {shippingQuoteError}
            </div>
          )}

          {quoteExpired && shippingQuote && !shippingQuoteLoading && (
            <div
              className="mt-3 flex items-center gap-2 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="h-4 w-4" />
              Your shipping quote expired. Update the address to calculate a
              new quote.
            </div>
          )}

          {shippingQuote?.rates?.length > 0 &&
            !shippingQuoteLoading &&
            !quoteExpired && (
              <fieldset className="mt-4 space-y-2">
                <legend className="sr-only">Choose a shipping method</legend>

                {shippingQuote.rates.map((rate) => (
                  <label
                    key={rate.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/40"
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shipping-rate"
                        value={rate.id}
                        checked={String(selectedRateId) === String(rate.id)}
                        onChange={() => setSelectedRateId(rate.id)}
                      />

                      <span>
                        <span className="block font-medium">{rate.name}</span>

                        {(rate.minDeliveryDays ||
                          rate.maxDeliveryDays) && (
                          <span className="block text-sm text-muted-foreground">
                            Estimated delivery: {rate.minDeliveryDays ?? '?'}–
                            {rate.maxDeliveryDays ?? '?'} business days
                          </span>
                        )}
                      </span>
                    </span>

                    <span className="font-medium">
                      {formatCurrency(rate.amount, rate.currency)}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
        </section>

        <div className="pt-4">
          <Button
            type="submit"
            className="h-12 w-full text-base"
            disabled={paymentStartDisabled}
          >
            {shippingQuoteLoading
              ? 'Calculating shipping…'
              : !shippingQuote || quoteExpired
                ? 'Enter address for shipping'
                : !selectedRateId
                  ? 'Select shipping to continue'
                  : 'Continue to Payment'}
          </Button>
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
  const [isElementReady, setIsElementReady] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements || !isElementReady) {
      setPaymentError(
        'Payment form is still loading. Please wait a moment and try again.'
      );
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/showroom/checkout?success=true`,
      },
    });

    if (stripeError) {
      setPaymentError(stripeError.message);
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-muted/60 p-6 shadow-sm">
      <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <Check className="h-6 w-6 text-green-500" />
        Secure Payment
      </h2>

      {paymentError && (
        <div className="mb-6 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {paymentError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-6 rounded-lg border bg-muted/30 p-4">
          <PaymentElement
            onReady={() => setIsElementReady(true)}
            onLoadError={() => {
              setPaymentError('Failed to load payment form.');
              setIsElementReady(false);
            }}
          />
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1"
            onClick={onBack}
            disabled={isProcessing}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Button
            type="submit"
            className="h-12 flex-1 bg-green-600 text-base text-white hover:bg-green-700"
            disabled={!stripe || !elements || !isElementReady || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm & Pay'
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function OrderSummary({
  cart,
  subtotal,
  shipping,
  selectedShippingRate,
  quoteLoading,
  tax,
  total,
  promoCodeInput,
  setPromoCodeInput,
  appliedPromo,
  setAppliedPromo,
  step,
}) {
  const handleApplyPromo = () => {
    if (!promoCodeInput.trim()) {
      return;
    }

    setAppliedPromo(promoCodeInput.toUpperCase());
  };

  return (
    <div className="lg:col-span-1">
      <Card className="sticky top-24 border-muted/60 p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-xl font-bold">
          <ShoppingBag className="h-5 w-5" />
          Order Summary
        </h3>

        {step === 1 && (
          <div className="mb-6 rounded-lg border border-border/50 bg-muted/30 p-4">
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Promo Code
            </Label>

            <div className="flex gap-2">
              <Input
                placeholder="Enter code"
                value={promoCodeInput}
                onChange={(event) => setPromoCodeInput(event.target.value)}
                disabled={Boolean(appliedPromo)}
                className="bg-background"
              />

              <Button
                type="button"
                variant={appliedPromo ? 'outline' : 'default'}
                onClick={
                  appliedPromo
                    ? () => {
                        setAppliedPromo('');
                        setPromoCodeInput('');
                      }
                    : handleApplyPromo
                }
              >
                {appliedPromo ? 'Remove' : 'Apply'}
              </Button>
            </div>

            {appliedPromo && (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-green-500">
                <Tag className="h-3.5 w-3.5" />
                Code {appliedPromo} applied
              </p>
            )}
          </div>
        )}

        <div className="space-y-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-medium text-foreground">
              {formatCurrency(subtotal)}
            </span>
          </div>

          <div className="flex justify-between text-muted-foreground">
            <span>Shipping</span>
            <span className="font-medium text-foreground">
              {quoteLoading
                ? 'Calculating…'
                : selectedShippingRate
                  ? formatCurrency(
                      selectedShippingRate.amount,
                      selectedShippingRate.currency
                    )
                  : 'Select a method'}
            </span>
          </div>

          <div className="flex justify-between text-muted-foreground">
            <span>Tax</span>
            <span className="font-medium text-foreground">
              {step === 1 ? 'Calculated at payment' : formatCurrency(tax)}
            </span>
          </div>

          <Separator className="my-4" />

          <div className="flex justify-between text-lg font-bold">
            <span>Total {step === 1 ? '(before tax)' : ''}</span>
            <span className="text-primary">{formatCurrency(total)}</span>
          </div>

          {step === 2 && (
            <p className="mt-4 rounded-md bg-muted/30 p-3 text-center text-xs text-muted-foreground">
              Final tax and discounts are calculated securely by Stripe.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}