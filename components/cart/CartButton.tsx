'use client';

import * as React from 'react';
import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart } from 'lucide-react';
import CartDrawer from './CartDrawer';
import { cn } from '@/lib/utils';

interface CartButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // any extras...
}

export default function CartButton({ className, ...props }: CartButtonProps) {
  const { cart } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={cn('relative text-xs md:text-sm gap-2', className)}
        onClick={() => setDrawerOpen(true)}
        {...props}
      >
        <ShoppingCart className="h-4 w-4" />
        <span className="hidden md:inline">Cart</span>

        {cart.itemCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
          >
            {cart.itemCount > 9 ? '9+' : cart.itemCount}
          </Badge>
        )}
      </Button>

      <CartDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
