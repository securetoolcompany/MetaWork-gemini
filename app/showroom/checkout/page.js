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
import { ArrowLeft, CreditCard, Truck, Lock, Check } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import confetti from 'canvas-confetti';

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
const [step, setStep] = useState(1);
const [isProcessing, setIsProcessing] = useState(false);

  const [shippingInfo, setShippingInfo] = useState({
    email: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
  });

  const [paymentInfo, setPaymentInfo] = useState({
    cardNumber: '',
    cardName: '',
    expiry: '',
    cvv: '',
  });

  const [shippingMethod, setShippingMethod] = useState('standard');

  const shippingCosts = {
    standard: 5.99,
    express: 12.99,
    free: 0,
  };

const subtotal = totalPrice || 0;
const shipping = subtotal > 50 ? 0 : shippingCosts[shippingMethod];
const tax = subtotal * 0.08;
const total = subtotal + shipping + tax;

  if ((items?.length ?? 0) === 0 && step !== 4) {
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

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    setStep(3);
  };

  const handlePlaceOrder = async () => {
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setStep(4);
    setIsProcessing(false);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    clearCart();
  };

  if (step === 4) {
    const orderNumber = Math.floor(100000 + Math.random() * 900000);
    
    return (
      <div className="min-h-screen bg-background">
        <ShowroomNav />
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>
            <p className="text-muted-foreground mb-6">
              Thank you for your purchase. Your order has been received.
            </p>
            
            <div className="bg-muted rounded-lg p-6 mb-6">
              <p className="text-sm text-muted-foreground mb-1">Order Number</p>
              <p className="text-2xl font-bold">#{orderNumber}</p>
            </div>

            <div className="text-left space-y-4 mb-8">
              <div>
                <h3 className="font-semibold mb-2">Shipping Address</h3>
                <p className="text-sm text-muted-foreground">
                  {shippingInfo.firstName} {shippingInfo.lastName}<br />
                  {shippingInfo.address}<br />
                  {shippingInfo.city}, {shippingInfo.state} {shippingInfo.zip}
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Order Summary</h3>
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
                    <span className="text-muted-foreground">Tax</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
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
            { num: 2, label: 'Payment' },
            { num: 3, label: 'Review' },
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
              {idx < 2 && (
                <div className={`w-24 h-1 mx-4 ${step > s.num ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {step === 1 && (
              <ShippingStep 
                shippingInfo={shippingInfo}
                setShippingInfo={setShippingInfo}
                shippingMethod={shippingMethod}
                setShippingMethod={setShippingMethod}
                shippingCosts={shippingCosts}
                subtotal={subtotal}
                onSubmit={handleShippingSubmit}
              />
            )}

            {step === 2 && (
              <PaymentStep
                paymentInfo={paymentInfo}
                setPaymentInfo={setPaymentInfo}
                onSubmit={handlePaymentSubmit}
                onBack={() => setStep(1)}
              />
            )}

            {step === 3 && (
              <ReviewStep
                shippingInfo={shippingInfo}
                paymentInfo={paymentInfo}
                cart={items}
                onBack={() => setStep(2)}
                onEdit={(stepNum) => setStep(stepNum)}
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
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={shippingInfo.email}
            onChange={(e) => setShippingInfo({ ...shippingInfo, email: e.target.value })}
            placeholder="your@email.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              required
              value={shippingInfo.firstName}
              onChange={(e) => setShippingInfo({ ...shippingInfo, firstName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              required
              value={shippingInfo.lastName}
              onChange={(e) => setShippingInfo({ ...shippingInfo, lastName: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            required
            value={shippingInfo.address}
            onChange={(e) => setShippingInfo({ ...shippingInfo, address: e.target.value })}
            placeholder="123 Main St"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              required
              value={shippingInfo.city}
              onChange={(e) => setShippingInfo({ ...shippingInfo, city: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              required
              value={shippingInfo.state}
              onChange={(e) => setShippingInfo({ ...shippingInfo, state: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="zip">ZIP Code</Label>
            <Input
              id="zip"
              required
              value={shippingInfo.zip}
              onChange={(e) => setShippingInfo({ ...shippingInfo, zip: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label className="mb-3 block">Shipping Method</Label>
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
            Continue to Payment
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PaymentStep({ paymentInfo, setPaymentInfo, onSubmit, onBack }) {
  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <CreditCard className="w-6 h-6" />
        Payment Information
      </h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="cardNumber">Card Number</Label>
          <Input
            id="cardNumber"
            required
            value={paymentInfo.cardNumber}
            onChange={(e) => setPaymentInfo({ ...paymentInfo, cardNumber: e.target.value })}
            placeholder="1234 5678 9012 3456"
            maxLength="19"
          />
        </div>

        <div>
          <Label htmlFor="cardName">Name on Card</Label>
          <Input
            id="cardName"
            required
            value={paymentInfo.cardName}
            onChange={(e) => setPaymentInfo({ ...paymentInfo, cardName: e.target.value })}
            placeholder="John Doe"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="expiry">Expiry Date</Label>
            <Input
              id="expiry"
              required
              value={paymentInfo.expiry}
              onChange={(e) => setPaymentInfo({ ...paymentInfo, expiry: e.target.value })}
              placeholder="MM/YY"
              maxLength="5"
            />
          </div>
          <div>
            <Label htmlFor="cvv">CVV</Label>
            <Input
              id="cvv"
              required
              value={paymentInfo.cvv}
              onChange={(e) => setPaymentInfo({ ...paymentInfo, cvv: e.target.value })}
              placeholder="123"
              maxLength="4"
            />
          </div>
        </div>

        <div className="flex items-start space-x-2 p-4 bg-muted rounded-md">
          <Lock className="w-5 h-5 text-green-500 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Secure Payment</p>
            <p className="text-muted-foreground">Your payment information is encrypted and secure</p>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1 gap-2" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button type="submit" className="flex-1">
            Review Order
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ReviewStep({ shippingInfo, paymentInfo, cart, onBack, onEdit, onPlaceOrder, isProcessing, total }) {
  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6">Review Your Order</h2>

      <div className="space-y-6">
        <div>
          <h3 className="font-semibold mb-3">Shipping Address</h3>
          <div className="text-sm text-muted-foreground">
            <p>{shippingInfo.firstName} {shippingInfo.lastName}</p>
            <p>{shippingInfo.email}</p>
            <p>{shippingInfo.address}</p>
            <p>{shippingInfo.city}, {shippingInfo.state} {shippingInfo.zip}</p>
          </div>
          <Button variant="link" className="px-0" onClick={() => onEdit(1)}>Edit</Button>
        </div>

        <Separator />

        <div>
          <h3 className="font-semibold mb-3">Payment Method</h3>
          <div className="text-sm text-muted-foreground">
            <p>Card ending in {paymentInfo.cardNumber.slice(-4)}</p>
            <p>{paymentInfo.cardName}</p>
          </div>
          <Button variant="link" className="px-0" onClick={() => onEdit(2)}>Edit</Button>
        </div>

        <Separator />

        <div>
          <h3 className="font-semibold mb-3">Order Items</h3>
          <div className="space-y-3">
            {cart.map((item) => (
  <div
    key={`${item.productId}-${item.variationId}`}
    className="flex gap-3 text-sm"
  >
    <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0">
      <Image
        src={item.thumbnailUrl || '/placeholder.png'}
        alt={item.title}
        fill
        className="object-cover"
      />
    </div>
    <div className="flex-1">
      <p className="font-medium">{item.title}</p>
      <p className="text-muted-foreground text-xs">
        Qty: {item.quantity}
      </p>
    </div>
    <p className="font-semibold">
      ${(item.priceSnapshot * item.quantity).toFixed(2)}
    </p>
  </div>
))}

          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" className="flex-1 gap-2" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button 
            className="flex-1" 
            onClick={onPlaceOrder}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : `Place Order - $${total.toFixed(2)}`}
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
  <div
    key={`${item.productId}-${item.variationId}`}
    className="flex gap-2 text-sm"
  >
    <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
      <Image
        src={item.thumbnailUrl || '/placeholder.png'}
        alt={item.title}
        fill
        className="object-cover"
      />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-xs line-clamp-1">
        {item.title}
      </p>
      <p className="text-xs text-muted-foreground">
        Qty: {item.quantity}
      </p>
    </div>
  </div>
))}
{cart.length > 3 && (
  <p className="text-xs text-muted-foreground">
    +{cart.length - 3} more items
  </p>
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
            <span className="text-muted-foreground">Tax</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        {subtotal > 50 && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
            <p className="text-sm font-semibold text-green-600">🎉 Free Shipping Unlocked!</p>
          </div>
        )}
      </Card>
    </div>
  );
}
