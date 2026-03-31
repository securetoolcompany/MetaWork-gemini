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
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { NAVIGATION_ITEMS, ADMIN_NAVIGATION_ITEMS } from '@/lib/navigation-config';
import { useAuth } from '@/lib/AuthContext'; 
import { useWallet } from '@/lib/WalletContext';

export default function MobileSidebar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth(); 
  const { accountAddress, isConnected } = useWallet();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

 const TriggerButton = () => (
    <Button 
      variant="default" // Changed from ghost to default for visibility
      size="icon" 
      className="h-9 w-9 shadow-lg bg-primary hover:bg-primary/90"
    >
      <Menu className="h-5 w-5 text-primary-foreground" />
    </Button>
  );

  if (!mounted) return <TriggerButton />;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <div><TriggerButton /></div>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-72 p-0 bg-card border-border"> 
        {/* side="right" matches the new header position */}
        <div className="flex h-full flex-col">
          {/* Logo Section */}
          <div className="flex h-16 items-center justify-between border-b border-border px-6">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              MetaWork
            </h1>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation Section */}
          <nav className="flex-1 overflow-y-auto space-y-1 px-3 py-4">
            {NAVIGATION_ITEMS.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}

            {/* NEW: Admin Links for Mobile */}
            {user?.isAdmin && (
              <>
                <div className="my-4 border-t border-border" />
                {ADMIN_NAVIGATION_ITEMS.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-yellow-600/70 hover:bg-yellow-500/10"
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                ))}
              </>
            )}
          </nav>

          {/* NEW: User/Account Section for Mobile */}
          <div className="border-t border-border p-4 space-y-3">
             {isAuthenticated && (
               <Button 
                 variant="ghost" 
                 className="w-full justify-start gap-3 px-2 text-destructive"
                 onClick={() => { logout(); setOpen(false); }}
               >
                 <LogOut className="h-5 w-5" />
                 Sign Out
               </Button>
             )}
            
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
