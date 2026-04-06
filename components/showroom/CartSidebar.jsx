'use client';

import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { X, Minus, Plus, ShoppingBag, Trash2, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

export default function CartSidebar() {
  const { cart, isOpen, setIsOpen, updateQuantity, removeFromCart, loading } = useCart();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [updatingItem, setUpdatingItem] = useState(null);

  // --- Unified Stripe Logic ---
  const handleStripeCheckout = async () => {
    if (cart.items.length === 0) return;
    
    setIsRedirecting(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: cart.items.map(item => ({
            name: item.title,
            price: item.priceSnapshot,
            quantity: item.quantity,
            image: item.thumbnailUrl,
            id: item.productId 
          })) 
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; 
      } else {
        toast.error(data.error || "Checkout failed");
      }
    } catch (err) {
      console.error("Stripe Error:", err);
      toast.error("Could not connect to payment gateway");
    } finally {
      setIsRedirecting(false);
    }
  };

  // --- Robust Data Helpers ---
  const formatAttributes = (attributes) => {
    if (!attributes || Object.keys(attributes).length === 0) return null;
    return Object.entries(attributes)
      .map(([key, value]) => `${key.replace(/^pa_/, '')}: ${value}`)
      .join(', ');
  };

  const handleQtyChange = async (productId, variationId, newQty) => {
    setUpdatingItem(`${productId}-${variationId}`);
    const result = await updateQuantity(productId, variationId, newQty);
    if (!result.success) toast.error(result.error || 'Update failed');
    setUpdatingItem(null);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col h-full p-0">
        <SheetHeader className="p-6 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            Your Cart
            {cart.totalItems > 0 && (
              <Badge variant="secondary" className="ml-2">
                {cart.totalItems} {cart.totalItems === 1 ? 'item' : 'items'}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <ShoppingBag className="w-16 h-16 text-muted-foreground opacity-20" />
              <p className="text-muted-foreground">Your shopping cart is empty.</p>
              <Button variant="outline" onClick={() => setIsOpen(false)}>Start Shopping</Button>
            </div>
          ) : (
            <div className="space-y-6">
              {cart.items.map((item) => {
                const itemKey = `${item.productId}-${item.variationId}`;
                const isUpdating = updatingItem === itemKey;
                
                return (
                  <div key={itemKey} className="flex gap-4 relative group">
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden border bg-muted flex-shrink-0">
                      <Image src={item.thumbnailUrl || '/placeholder.png'} alt={item.title} fill className="object-cover" />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                      <div>
                        <h4 className="font-semibold text-sm line-clamp-1">{item.title}</h4>
                        {item.attributes && (
                          <p className="text-xs text-muted-foreground mt-1 capitalize">
                            {formatAttributes(item.attributes)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center border rounded-md h-8">
                          <Button 
                            variant="ghost" size="icon" className="h-7 w-7 rounded-none"
                            onClick={() => handleQtyChange(item.productId, item.variationId, item.quantity - 1)}
                            disabled={isUpdating || loading || item.quantity <= 1}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center text-xs font-medium">{item.quantity}</span>
                          <Button 
                            variant="ghost" size="icon" className="h-7 w-7 rounded-none"
                            onClick={() => handleQtyChange(item.productId, item.variationId, item.quantity + 1)}
                            disabled={isUpdating || loading}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="font-bold text-sm">
                          ${(item.priceSnapshot * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <Button 
                      variant="ghost" size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFromCart(item.productId, item.variationId)}
                      disabled={isUpdating || loading}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {cart.items.length > 0 && (
          <div className="p-6 border-t bg-card space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">${cart.totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600 font-medium">
                <span>Blockchain Royalties Included</span>
                <span>$0.00 extra</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-lg">
                <span className="font-bold">Total</span>
                <span className="font-bold text-primary">${cart.totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <Button 
              className="w-full h-12 text-md font-bold" 
              size="lg" 
              onClick={handleStripeCheckout}
              disabled={isRedirecting || loading}
            >
              {isRedirecting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Securing Connection...
                </>
              ) : (
                "Complete Purchase"
              )}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              Payments secured by Stripe. Assets will be distributed via Algorand post-purchase.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}