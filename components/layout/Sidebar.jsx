'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, Database, ShoppingBag, Settings, 
  TrendingUp, Gift, Info, Landmark, Box, Zap, Globe, 
  Home, LogIn, LogOut, UserPlus, Store, Palette
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading, logout } = useAuth();

  // 1. Fully Restored Dashboard Menu (Logged In)
  const dashboardMenuItems = [
    { icon: Home, label: 'Home', href: '/' },
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: Store, label: 'Aisle Settings', href: '/aisle-settings' }, // RESTORED
    { icon: Palette, label: 'Product Designer', href: '/products/creator' }, // RESTORED
    { icon: Database, label: 'My IP Assets', href: '/my-ip' },
    { icon: ShoppingBag, label: 'My Products', href: '/my-products' },
    { icon: TrendingUp, label: 'Earnings', href: '/earnings' },
    { icon: Gift, label: 'Promotions', href: '/promotions' },
    { icon: Settings, label: 'Profile Settings', href: '/profile-settings' },
  ];

  // 2. Site Menu (Logged Out)
  const publicMenuItems = [
    { icon: Home, label: 'Welcome', href: '/' },
    { icon: Info, label: 'About Us', href: '/about-us' },
    { icon: Landmark, label: 'Tokenization', href: '/tokenization' },
    { icon: Box, label: 'Product Creation', href: '/product-creation' },
    { icon: Zap, label: 'Minting Process', href: '/minting-process' },
    { icon: Globe, label: 'Industries', href: '/industries' },
  ];

  if (loading) return <div className="w-64 border-r border-border bg-card/50" />;

  const menuItems = isAuthenticated ? dashboardMenuItems : publicMenuItems;
  const menuTitle = isAuthenticated ? "Creator Tools" : "Explore MetaWork";

  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card/50 backdrop-blur-sm sticky top-0 h-screen z-50">
      {/* 1. The Logo Area (Fixed in the corner) */}
      <div className="h-16 flex items-center px-6 border-b border-border/50">
        <Link href="/" className="font-bold text-xl tracking-tighter hover:opacity-80 transition-opacity">
          META<span className="text-green-500">WORK</span>
        </Link>
      </div>

      {/* 2. The Navigation Area */}
      <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-6">
          {menuTitle}
        </h2>
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                  isActive 
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                )}
              >
                <item.icon className={cn(
                  "h-4 w-4 transition-transform group-hover:scale-110",
                  isActive ? "text-green-400" : "text-slate-500 group-hover:text-white"
                )} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 3. Bottom Action Area */}
      <div className="p-6 border-t border-border/40 space-y-3 bg-card/80">
        {isAuthenticated ? (
          <Button 
            variant="ghost" 
            onClick={() => {
                logout();
                router.push('/');
            }}
            className="w-full justify-start gap-3 text-slate-400 hover:text-red-400 hover:bg-red-400/5 rounded-xl"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm font-medium">Log Out</span>
          </Button>
        ) : (
          <>
            <Button 
              variant="ghost" 
              onClick={() => router.push('/login')}
              className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl"
            >
              <LogIn className="h-4 w-4" />
              <span className="text-sm font-medium">Sign In</span>
            </Button>
            <Button 
              onClick={() => router.push('/register')}
              className="w-full justify-start gap-3 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg shadow-green-900/20"
            >
              <UserPlus className="h-4 w-4" />
              <span className="text-sm font-medium">Get Account</span>
            </Button>
          </>
        )}
        
        {!isAuthenticated && (
          <p className="text-[10px] text-slate-500 text-center italic pt-2 opacity-60 px-2 leading-tight">
            Opening the global economy to everyone.
          </p>
        )}
      </div>
    </aside>
  );
}