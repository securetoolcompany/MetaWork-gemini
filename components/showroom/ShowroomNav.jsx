'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, User, ShoppingCart, LayoutDashboard } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/lib/AuthContext';
import { useState } from 'react';
import CartDrawer from '@/components/cart/CartDrawer';

export default function ShowroomNav() {
  const { cart } = useCart();
  const { isAuthenticated } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const cartCount = cart?.itemCount || 0;

  return (
    <>
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/showroom" className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                MetaWork Showroom
              </span>
            </Link>

            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2 relative"
                onClick={() => setDrawerOpen(true)}
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="hidden md:inline">Cart</span>
                {cartCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 px-1.5 min-w-[20px] h-5">
                    {cartCount}
                  </Badge>
                )}
              </Button>

              {isAuthenticated ? (
                <Link href="/">
                  <Button variant="outline" size="sm" className="gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="hidden md:inline">Dashboard</span>
                  </Button>
                </Link>
              ) : (
                <Link href="/login">
                  <Button variant="outline" size="sm" className="gap-2">
                    <User className="w-4 h-4" />
                    <span className="hidden md:inline">Sign In</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <CartDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
