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
import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import Image from 'next/image';

export default function CartDrawer({ open, onOpenChange }) {
  const {
    cart,
    updateQuantity,
    removeFromCart,
    loading
  } = useCart();

  const [updatingItem, setUpdatingItem] = useState(null);

  const handleUpdateQuantity = async (productId, variationId, newQuantity) => {
    if (newQuantity < 1) {
      // Remove item if quantity becomes 0
      await handleRemoveItem(productId, variationId);
      return;
    }

    setUpdatingItem(`${productId}-${variationId}`);
    const result = await updateQuantity(productId, variationId, newQuantity);
    
    if (result.success) {
      toast.success('Cart updated');
    } else {
      toast.error(result.error || 'Failed to update quantity');
    }
    
    setUpdatingItem(null);
  };

  const handleRemoveItem = async (productId, variationId) => {
    setUpdatingItem(`${productId}-${variationId}`);
    const result = await removeFromCart(productId, variationId);
    
    if (result.success) {
      toast.success('Item removed from cart');
    } else {
      toast.error(result.error || 'Failed to remove item');
    }
    
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
      .map(([key, value]) => {
        // Remove 'pa_' prefix if present
        const cleanKey = key.replace(/^pa_/, '');
        return `${cleanKey}: ${value}`;
      })
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
              : `${cart.totalItems} total ${cart.totalItems === 1 ? 'item' : 'items'}`
            }
          </DialogDescription>
        </DialogHeader>

        {/* Cart Items - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">Your cart is empty</p>
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Continue Shopping
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.items.map((item) => {
                const itemKey = `${item.productId}-${item.variationId}`;
                const isUpdating = updatingItem === itemKey;
                const itemTotal = item.priceSnapshot * item.quantity;
                const attributes = formatAttributes(item.attributes);

                return (
                  <div
                    key={itemKey}
                    className="flex gap-4 p-4 border rounded-lg bg-card relative"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-20 h-20 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                      {item.thumbnailUrl ? (
                        <Image
                          src={item.thumbnailUrl}
                          alt={item.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm leading-tight mb-1 line-clamp-2">
                        {item.title}
                      </h4>
                      
                      {attributes && (
                        <p className="text-xs text-muted-foreground mb-2 capitalize">
                          {attributes}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            onClick={() =>
                              handleUpdateQuantity(
                                item.productId,
                                item.variationId,
                                item.quantity - 1
                              )
                            }
                            disabled={isUpdating || loading}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          
                          <span className="text-sm font-medium w-8 text-center">
                            {item.quantity}
                          </span>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            onClick={() =>
                              handleUpdateQuantity(
                                item.productId,
                                item.variationId,
                                item.quantity + 1
                              )
                            }
                            disabled={isUpdating || loading}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Price */}
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {formatPrice(itemTotal)}
                          </p>
                          {item.quantity > 1 && (
                            <p className="text-xs text-muted-foreground">
                              {formatPrice(item.priceSnapshot)} each
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Remove Button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        handleRemoveItem(item.productId, item.variationId)
                      }
                      disabled={isUpdating || loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer - Total & Checkout */}
        {cart.items.length > 0 && (
          <DialogFooter className="px-6 py-4 border-t flex-col gap-3 sm:flex-col">
            <div className="flex items-center justify-between w-full py-2">
              <span className="text-base font-semibold">Subtotal:</span>
              <span className="text-xl font-bold">
                {formatPrice(cart.totalPrice)}
              </span>
            </div>
            
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Continue Shopping
              </Button>
              
              <Link href="/checkout" className="flex-1">
                <Button 
                  className="w-full"
                  onClick={() => onOpenChange(false)}
                >
                  Checkout
                </Button>
              </Link>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Shipping and taxes calculated at checkout
            </p>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
