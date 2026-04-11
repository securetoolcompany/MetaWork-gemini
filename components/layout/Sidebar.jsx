'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, Database, ShoppingBag, Settings, 
  TrendingUp, Gift, Info, Landmark, Box, Zap, Globe, 
  Home, LogIn, LogOut, UserPlus, Store, Palette, LayoutGrid, Terminal, Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

// This is the inner content so we don't repeat code for Desktop and Mobile
const NavContent = ({ isAuthenticated, menuItems, menuTitle, pathname, logout, router }) => (
  <div className="flex flex-col h-full">
    {/* 1. Logo */}
    <div className="h-16 flex items-center px-6 border-b border-border/50">
      <Link href="/" className="font-black text-xl italic tracking-tighter">
        META<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">WORK</span>
      </Link>
    </div>

    {/* 2. Navigation */}
    <div className="p-6 flex-1 overflow-y-auto">
      <div className="flex items-center gap-2 mb-6">
        <Terminal className="h-3.5 w-3.5 text-blue-400" />
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
          {menuTitle}
        </h2>
      </div>
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
                  ? 'bg-blue-500/10 border border-blue-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <item.icon className={cn("h-4 w-4", isActive ? "text-blue-400" : "text-slate-500")} />
              <span className={cn(isActive ? "text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 italic font-bold" : "")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>

    {/* 3. Actions */}
    <div className="p-6 border-t border-border/40 space-y-3 bg-card/80">
      {isAuthenticated ? (
        <Button variant="ghost" onClick={() => { logout(); router.push('/'); }} className="w-full justify-start gap-3 text-slate-400 hover:text-red-400">
          <LogOut className="h-4 w-4" />
          <span>Terminate_Session</span>
        </Button>
      ) : (
        <>
          <Button variant="ghost" onClick={() => router.push('/login')} className="w-full justify-start gap-3 text-slate-400">
            <LogIn className="h-4 w-4" />
            <span>User_Auth</span>
          </Button>
          <Button onClick={() => router.push('/login')} className="w-full justify-start gap-3 bg-blue-600 rounded-none shadow-[0_0_20px_rgba(37,99,235,0.3)]">
            <UserPlus className="h-4 w-4" />
            <span className="font-mono text-[11px] uppercase tracking-widest">Initialize_Acct</span>
          </Button>
        </>
      )}
    </div>
  </div>
);

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading, logout } = useAuth();

  const dashboardMenuItems = [
    { icon: Home, label: 'Home', href: '/' },
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: Store, label: 'Aisle Settings', href: '/aisle-settings' },
    { icon: Palette, label: 'Product Designer', href: '/products/creator' },
   // { icon: LayoutGrid, label: 'Showroom', href: '/showroom' },
    { icon: Database, label: 'My IP Assets', href: '/my-ip' },
    { icon: ShoppingBag, label: 'My Products', href: '/my-products' },
    { icon: TrendingUp, label: 'Earnings', href: '/earnings' },
    { icon: Gift, label: 'Promotions', href: '/promotions' },
    { icon: Settings, label: 'Profile Settings', href: '/profile-settings' },
  ];

  const publicMenuItems = [
    { icon: Home, label: 'Welcome', href: '/' },
   // { icon: LayoutGrid, label: 'Showroom', href: '/showroom' },
    { icon: Info, label: 'About Us', href: '/about-us' },
    { icon: Landmark, label: 'Tokenization', href: '/tokenization' },
    { icon: Box, label: 'Product Creation', href: '/product-creation' },
    { icon: Zap, label: 'Minting Process', href: '/minting-process' },
    { icon: Globe, label: 'Industries', href: '/industries' },
  ];

  if (loading) return null;

  const menuItems = isAuthenticated ? dashboardMenuItems : publicMenuItems;
  const menuTitle = isAuthenticated ? "System / Creator" : "System / Explore";

  return (
    <>
      {/* MOBILE HAMBURGER (Visible only on small screens) */}
      <div className="md:hidden fixed top-4 left-4 z-[50]">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-zinc-950 border-zinc-800 text-blue-400 shadow-lg">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 bg-zinc-950 border-r border-zinc-800">
            <NavContent 
              isAuthenticated={isAuthenticated} 
              menuItems={menuItems} 
              menuTitle={menuTitle} 
              pathname={pathname} 
              logout={logout} 
              router={router} 
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card/50 backdrop-blur-sm sticky top-0 h-screen z-50">
        <NavContent 
          isAuthenticated={isAuthenticated} 
          menuItems={menuItems} 
          menuTitle={menuTitle} 
          pathname={pathname} 
          logout={logout} 
          router={router} 
        />
      </aside>
    </>
  );
}