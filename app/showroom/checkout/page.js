'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import ShowroomNav from '@/components/showroom/ShowroomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Truck, Check, AlertCircle, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import countries from '@/data/countries.json';

export default function CheckoutPage() {
  const { items, totalPrice } = useCart();
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const [shippingInfo, setShippingInfo] = useState({
    email: '',
    name: '',
    address1: '',
    city: '',
    state_code: '',
    zip: '',
    country_code: 'US' 
  });

  const [shippingMethod, setShippingMethod] = useState('standard');

  const shippingCosts = {
    standard: 5.99,
    express: 12.99,
    free: 0,
  };

  const subtotal = totalPrice || 0;
  const shipping = subtotal > 50 ? 0 : shippingCosts[shippingMethod];
  const tax = subtotal * 0.08; // Note: Stripe will calculate actual tax on the next screen
  const total = subtotal + shipping + tax;

  if ((items?.length ?? 0) === 0) {
    return (
      <div className="min-h-screen bg-background">
        <ShowroomNav />
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">Your cart is empty</h1>
          <p className="text-muted-foreground mb-6">Add some products to checkout</p>
          <Link href="/showroom">
            <Button>Continue Shopping</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleShippingSubmit = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const handlePlaceOrder = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items,
          shippingInfo: shippingInfo,
          shippingMethod: shippingMethod
        }),
      });

      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe's Hosted Checkout
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (err) {
      console.error("Checkout Error:", err);
      setError("Something went wrong with the payment system. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ShowroomNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/showroom" className="hover:text-foreground">Showroom</Link>
          <span>/</span>
          <span className="text-foreground">Checkout</span>
        </div>

        <div className="flex items-center justify-center mb-12">
          {[
            { num: 1, label: 'Shipping' },
            { num: 2, label: 'Review & Pay' },
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= s.num ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {step > s.num ? <Check className="w-5 h-5" /> : s.num}
                </div>
                <span className="text-xs mt-2">{s.label}</span>
              </div>
              {idx < 1 && (
                <div className={`w-24 h-1 mx-4 ${step > s.num ? 'bg-primary' : 'bg-muted'}`} />
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
            {step === 1 ? (
              <ShippingStep 
                shippingInfo={shippingInfo}
                setShippingInfo={setShippingInfo}
                shippingMethod={shippingMethod}
                setShippingMethod={setShippingMethod}
                shippingCosts={shippingCosts}
                subtotal={subtotal}
                onSubmit={handleShippingSubmit}
              />
            ) : (
              <ReviewStep
                shippingInfo={shippingInfo}
                cart={items}
                onBack={() => setStep(1)}
                onPlaceOrder={handlePlaceOrder}
                isProcessing={isProcessing}
                total={total}
              />
            )}
          </div>

          <OrderSummary
            cart={items}
            subtotal={subtotal}
            shipping={shipping}
            tax={tax}
            total={total}
          />
        </div>
      </div>
    </div>
  );
}

function ShippingStep({ shippingInfo, setShippingInfo, shippingMethod, setShippingMethod, shippingCosts, subtotal, onSubmit }) {
  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Truck className="w-6 h-6" />
        Shipping Information
      </h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            required
            value={shippingInfo.email}
            onChange={(e) => setShippingInfo({ ...shippingInfo, email: e.target.value })}
            placeholder="your@email.com"
          />
        </div>

        <div>
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            required
            value={shippingInfo.name}
            onChange={(e) => setShippingInfo({ ...shippingInfo, name: e.target.value })}
            placeholder="John Doe"
          />
        </div>

        <div>
          <Label htmlFor="address1">Street Address</Label>
          <Input
            id="address1"
            required
            value={shippingInfo.address1}
            onChange={(e) => setShippingInfo({ ...shippingInfo, address1: e.target.value })}
            placeholder="123 Main St"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="col-span-2 md:col-span-1">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              required
              value={shippingInfo.city}
              onChange={(e) => setShippingInfo({ ...shippingInfo, city: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="state_code">State / Province</Label>
            <Input
              id="state_code"
              required
              value={shippingInfo.state_code}
              onChange={(e) => setShippingInfo({ ...shippingInfo, state_code: e.target.value })}
              placeholder="e.g. CA or NY"
            />
          </div>
          <div>
            <Label htmlFor="zip">ZIP / Postal Code</Label>
            <Input
              id="zip"
              required
              value={shippingInfo.zip}
              onChange={(e) => setShippingInfo({ ...shippingInfo, zip: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="country">Country</Label>
          <select 
            id="country"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={shippingInfo.country_code} 
            onChange={(e) => setShippingInfo({...shippingInfo, country_code: e.target.value})}
          >
            {countries.map(c => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>

        <Separator className="my-6" />

        <div>
          <Label className="mb-3 block font-semibold">Shipping Method</Label>
          <RadioGroup value={shippingMethod} onValueChange={setShippingMethod}>
            <div className="flex items-center space-x-2 p-3 border rounded-md">
              <RadioGroupItem value="standard" id="standard" />
              <Label htmlFor="standard" className="flex-1 cursor-pointer">
                Standard Shipping (5-7 days) - ${shippingCosts.standard}
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border rounded-md">
              <RadioGroupItem value="express" id="express" />
              <Label htmlFor="express" className="flex-1 cursor-pointer">
                Express Shipping (2-3 days) - ${shippingCosts.express}
              </Label>
            </div>
            {subtotal > 50 && (
              <div className="flex items-center space-x-2 p-3 border rounded-md bg-green-500/10 border-green-500/20">
                <RadioGroupItem value="free" id="free" />
                <Label htmlFor="free" className="flex-1 cursor-pointer">
                  Free Shipping (5-7 days) - $0.00
                  <Badge className="ml-2 bg-green-500">Unlocked!</Badge>
                </Label>
              </div>
            )}
          </RadioGroup>
        </div>

        <div className="flex gap-3 pt-4">
          <Link href="/showroom" className="flex-1">
            <Button type="button" variant="outline" className="w-full gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Shop
            </Button>
          </Link>
          <Button type="submit" className="flex-1">
            Review Order
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ReviewStep({ shippingInfo, cart, onBack, onPlaceOrder, isProcessing, total }) {
  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6">Review Your Order</h2>

      <div className="space-y-6">
        <div>
          <h3 className="font-semibold mb-3">Shipping Details</h3>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{shippingInfo.name}</p>
            <p>{shippingInfo.email}</p>
            <p>{shippingInfo.address1}</p>
            <p>{shippingInfo.city}, {shippingInfo.state_code} {shippingInfo.zip}</p>
            <p>{countries.find(c => c.code === shippingInfo.country_code)?.name}</p>
          </div>
          <Button variant="link" className="px-0 h-auto mt-2" onClick={onBack}>Edit Shipping</Button>
        </div>

        <Separator />

        <div>
          <h3 className="font-semibold mb-3">Order Items</h3>
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={`${item.productId}-${item.variationId}`} className="flex gap-3 text-sm">
                <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                  <Image
                    src={item.thumbnailUrl || '/placeholder.png'}
                    alt={item.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-muted-foreground text-xs">Qty: {item.quantity}</p>
                </div>
                <p className="font-semibold">
                  ${(item.priceSnapshot * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-muted p-4 rounded-lg flex items-start gap-3">
          <Check className="w-5 h-5 text-green-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Next Step: Secure Payment</p>
            <p className="text-muted-foreground">You will be redirected to Stripe to safely complete your purchase.</p>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" className="flex-1 gap-2" onClick={onBack} disabled={isProcessing}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button 
            className="flex-1 bg-green-600 hover:bg-green-700 text-white" 
            onClick={onPlaceOrder}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : `Checkout Now - $${total.toFixed(2)}`}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function OrderSummary({ cart, subtotal, shipping, tax, total }) {
  return (
    <div className="lg:col-span-1">
      <Card className="p-6 sticky top-20">
        <h3 className="text-xl font-bold mb-4">Order Summary</h3>
        
        <div className="space-y-3 mb-4">
          {cart.slice(0, 3).map((item) => (
            <div key={`${item.productId}-${item.variationId}`} className="flex gap-2 text-sm">
              <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                <Image
                  src={item.thumbnailUrl || '/placeholder.png'}
                  alt={item.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs line-clamp-1">{item.title}</p>
                <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
              </div>
            </div>
          ))}
          {cart.length > 3 && (
            <p className="text-xs text-muted-foreground">+{cart.length - 3} more items</p>
          )}
        </div>

        <Separator className="my-4" />

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span>${shipping.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estimated Tax</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        {subtotal > 50 && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md text-center">
            <p className="text-sm font-semibold text-green-600">🎉 Free Shipping Unlocked!</p>
          </div>
        )}
      </Card>
    </div>
  );
}