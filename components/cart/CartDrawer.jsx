'use client';

import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function CartDrawer({ open, onOpenChange }) {
  const {
    cart,
    updateQuantity,
    removeFromCart,
    loading
  } = useCart();

  const [updatingItem, setUpdatingItem] = useState(null);
  const router = useRouter();

  // --- UPDATED NAVIGATION LOGIC ---
  // We now navigate to the local checkout page to collect 
  // international shipping and tax info before hitting Stripe.
  const handleGoToCheckout = () => {
    if (cart.items.length === 0) return;
    onOpenChange(false); // Close the drawer
    router.push('/showroom/checkout');
  };
  // -----------------------------

  const handleUpdateQuantity = async (productId, variationId, newQuantity) => {
    if (newQuantity < 1) {
      await handleRemoveItem(productId, variationId);
      return;
    }
    setUpdatingItem(`${productId}-${variationId}`);
    const result = await updateQuantity(productId, variationId, newQuantity);
    if (result.success) toast.success('Cart updated');
    else toast.error(result.error || 'Failed to update quantity');
    setUpdatingItem(null);
  };

  const handleRemoveItem = async (productId, variationId) => {
    setUpdatingItem(`${productId}-${variationId}`);
    const result = await removeFromCart(productId, variationId);
    if (result.success) toast.success('Item removed from cart');
    else toast.error(result.error || 'Failed to remove item');
    setUpdatingItem(null);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatAttributes = (attributes) => {
    if (!attributes || Object.keys(attributes).length === 0) return null;
    return Object.entries(attributes)
      .map(([key, value]) => `${key.replace(/^pa_/, '')}: ${value}`)
      .join(', ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShoppingBag className="h-5 w-5" />
            Shopping Cart
            {cart.itemCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {cart.itemCount === 0 
              ? 'Your cart is empty' 
              : `${cart.totalItems} total items`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
              <Button variant="outline" onClick={() => onOpenChange(false)}>Continue Shopping</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.items.map((item) => {
                const itemKey = `${item.productId}-${item.variationId}`;
                const isUpdating = updatingItem === itemKey;
                return (
                  <div key={itemKey} className="flex gap-4 p-4 border rounded-lg bg-card relative">
                    <div className="relative w-20 h-20 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                      <Image src={item.thumbnailUrl || '/placeholder.png'} alt={item.title} fill className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm leading-tight mb-1 line-clamp-2">{item.title}</h4>
                      {item.attributes && <p className="text-xs text-muted-foreground mb-2 capitalize">{formatAttributes(item.attributes)}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => handleUpdateQuantity(item.productId, item.variationId, item.quantity - 1)} disabled={isUpdating || loading}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => handleUpdateQuantity(item.productId, item.variationId, item.quantity + 1)} disabled={isUpdating || loading}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm font-semibold">{formatPrice(item.priceSnapshot * item.quantity)}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="absolute top-2 right-2 h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveItem(item.productId, item.variationId)} disabled={isUpdating || loading}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {cart.items.length > 0 && (
          <DialogFooter className="px-6 py-4 border-t flex-col gap-3 sm:flex-col">
            <div className="flex items-center justify-between w-full py-2">
              <span className="text-base font-semibold">Subtotal:</span>
              <span className="text-xl font-bold">{formatPrice(cart.totalPrice)}</span>
            </div>
            
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Back to Shop
              </Button>
              
              <Button 
                className="flex-1"
                onClick={handleGoToCheckout}
                disabled={loading}
              >
                Checkout
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}