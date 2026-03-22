'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Images,
  Palette,
  Package,
  DollarSign,
  Settings,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'My IP', href: '/my-ip', icon: Images },
  { name: 'Product Designer', href: '/product-designer', icon: Palette },
  { name: 'My Products', href: '/my-products', icon: Package },
  { name: 'Earnings', href: '/earnings', icon: DollarSign },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function MobileSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Only render Sheet on client side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Return placeholder button during SSR
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="md:hidden">
        <Menu className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0 bg-card border-border">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-border px-6">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              MetaWork
            </h1>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-border p-4">
            <div className="rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-4 border border-blue-500/20">
              <p className="text-xs font-medium text-foreground mb-1">Creator Pro</p>
              <p className="text-xs text-muted-foreground">Unlock premium features</p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
