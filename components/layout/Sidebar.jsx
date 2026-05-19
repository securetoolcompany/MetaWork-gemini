'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Settings, TrendingUp, Gift, Info,
  Box, Zap, Globe, Home, LogIn, LogOut, UserPlus, Store,
  Palette, LayoutGrid, Terminal, Menu, ChevronDown, Dumbbell,
  GraduationCap, Coffee, HeartHandshake, ShoppingCart,
  Wrench, FileText, DollarSignIcon, Wallet, Shield, Coins,
  FolderOpen, Package, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NavItem = ({ item, pathname }) => {
  const isExactActive = pathname === item.href;
  const isChildActive = item.subItems?.some(sub => pathname === sub.href);
  const isActive = isExactActive || isChildActive;
  const [isOpen, setIsOpen] = useState(isActive);

  if (item.subItems) {
    return (
      <div className="space-y-1">
        <div
          className={cn(
            'w-full flex items-center justify-between pr-3 rounded-xl text-sm font-medium transition-all group',
            isActive && !isExactActive
              ? 'bg-blue-500/5 border border-blue-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          )}
        >
          <Link
            href={item.href || '#'}
            onClick={(e) => {
              if (!item.href) {
                e.preventDefault();
                setIsOpen(!isOpen);
              } else {
                setIsOpen(true);
              }
            }}
            className="flex-1 flex items-center gap-3 px-3 py-2.5"
          >
            <item.icon className={cn("h-4 w-4", isActive ? "text-blue-400" : "text-slate-500")} />
            <span className={cn(isActive ? "text-white font-bold" : "")}>{item.label}</span>
          </Link>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="p-1 hover:bg-white/10 rounded-md transition-colors"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform text-slate-500", isOpen ? "rotate-180" : "")} />
          </button>
        </div>

        {isOpen && (
          <div className="pl-9 pr-3 space-y-1 mt-1 border-l border-zinc-800 ml-5">
            {item.subItems.map((sub) => {
              const isSubActive = pathname === sub.href;
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                    isSubActive
                      ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'
                  )}
                >
                  {sub.icon && <sub.icon className="h-3 w-3" />}
                  <span className={isSubActive ? "italic font-bold" : ""}>{sub.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
        isExactActive
          ? 'bg-blue-500/10 border border-blue-500/20'
          : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
      )}
    >
      <item.icon className={cn("h-4 w-4", isExactActive ? "text-blue-400" : "text-slate-500")} />
      <span className={cn(isExactActive ? "text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 italic font-bold" : "")}>
        {item.label}
      </span>
    </Link>
  );
};

const NavContent = ({ isAuthenticated, menuItems, menuTitle, pathname, logout, router }) => (
  <div className="flex flex-col h-full bg-zinc-950">
    <div className="h-16 flex items-center px-6 border-b border-zinc-800/50">
      <Link href="/" className="font-black text-xl italic tracking-tighter">
        META<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">WORK</span>
      </Link>
    </div>

    <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-2 mb-6">
        <Terminal className="h-3.5 w-3.5 text-blue-400" />
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
          {menuTitle}
        </h2>
      </div>
      <nav className="space-y-1.5">
        {menuItems.map((item) => (
          <NavItem key={item.label} item={item} pathname={pathname} />
        ))}
      </nav>
    </div>

    <div className="p-6 border-t border-zinc-800/50 space-y-3 bg-zinc-950">
      {isAuthenticated ? (
        <Button
          variant="ghost"
          onClick={() => { logout(); router.push('/'); }}
          className="w-full justify-start gap-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" />
          <span className="font-mono text-xs">Terminate_Session</span>
        </Button>
      ) : (
        <>
          <Button
            variant="ghost"
            onClick={() => router.push('/login')}
            className="w-full justify-start gap-3 text-slate-400 hover:bg-white/5 border border-zinc-800"
          >
            <LogIn className="h-4 w-4" />
            <span className="font-mono text-xs">User_Auth</span>
          </Button>
          <Button
            onClick={() => router.push('/login')}
            className="w-full justify-start gap-3 bg-blue-600 hover:bg-blue-700 rounded-none shadow-[0_0_20px_rgba(37,99,235,0.3)]"
          >
            <UserPlus className="h-4 w-4" />
            <span className="font-mono text-[11px] uppercase tracking-widest">
              Initialize_Acct
            </span>
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
    // 1. Dashboard
    { icon: LayoutDashboard, label: 'Global Dashboard', href: '/dashboard' },

    // 2. IP & Assets — full lifecycle group
    {
      icon: FolderOpen,
      label: 'IP / Assets',
      href: '/my-ip',
      subItems: [
        { icon: FolderOpen,  label: 'Manage IP Assets',       href: '/my-ip' },
        { icon: Shield,      label: 'Minting Authentication', href: '/mint-authentication' },
        { icon: Coins,       label: 'Revenue Tokenization',   href: '/revenue-tokenization' },
      ],
    },

    // 3. Products
    {
      icon: Package,
      label: 'Manage Products',
      href: '/my-products',
      subItems: [
        { icon: Package, label: 'My Products',    href: '/my-products' },
        { icon: Palette, label: 'Create Product', href: '/products/creator' },
      ],
    },

    // 4. Sales & Marketing — includes public profile
    {
      icon: Store,
      label: 'Sales / Marketing',
      href: '/sales',
      subItems: [
        { icon: Store,       label: 'Aisle Creator',          href: '/aisle-settings' },
        { icon: Gift,        label: 'Promotions & Marketing', href: '/promotions' },
        { icon: TrendingUp,  label: 'Earnings',               href: '/earnings' },
        { icon: User,        label: 'Profile Editor',         href: '/profile-settings' },
      ],
    },

    // 5. Account Management — now points to the real page
    { icon: Settings, label: 'Account Management', href: '/account-management' },
  ];

  const publicMenuItems = [
    { icon: Home, label: 'System Home', href: '/' },
    {
      icon: Terminal,
      label: 'MetaWork Overview',
      href: '/metawork-overview',
      subItems: [
        { icon: Zap,   label: 'Asset Tokenization',  href: '/metawork-overview/minting-process' },
        { icon: Box,   label: 'MetaManufacturing',   href: '/metawork-overview/product-creation' },
        { icon: Store, label: 'MetaCommerce Engine', href: '/metawork-overview/selling' },
      ]
    },
    {
      icon: Wrench,
      label: 'The Toolbox',
      href: '/tools',
      subItems: [
        { icon: Box,           label: 'Manufacturing Catalog', href: '/catalog' },
        { icon: DollarSignIcon, label: 'Tokenization',         href: '/tutorials/minting' },
        { icon: Wallet,        label: 'Secure Wallet',         href: '/wallet-guide' },
      ]
    },
    {
      icon: Globe,
      label: 'Industries We Serve',
      href: '/industries',
      subItems: [
        { icon: Dumbbell,      label: 'Gyms & Fitness',  href: '/industries/gyms-fitness' },
        { icon: GraduationCap, label: 'Education',       href: '/industries/education' },
        { icon: Coffee,        label: 'Food & Beverage', href: '/industries/food-beverage' },
        { icon: Palette,       label: 'Creators & IP',   href: '/industries/creators' },
        { icon: Gift,          label: 'B2B & Promo',     href: '/industries/gifts-promo' },
        { icon: ShoppingCart,  label: 'Retailers & LGS', href: '/industries/retailers' },
        { icon: HeartHandshake, label: 'Non-Profits',    href: '/industries/non-profits' },
      ]
    },
    { icon: LayoutGrid, label: 'Global Showroom', href: '/showroom' },
    { icon: Info,       label: 'About Us',        href: '/about-us' },
    { icon: FileText,   label: 'Official Whitepaper', href: '/whitepaper' },
  ];

  if (loading) return null;

  const menuItems = isAuthenticated ? dashboardMenuItems : publicMenuItems;
  const menuTitle = isAuthenticated ? "System / Creator" : "System / Explore";

  return (
    <>
      <div className="md:hidden fixed top-4 left-4 z-[50]">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="bg-zinc-950 border-zinc-800 text-blue-400 shadow-lg hover:bg-zinc-900"
            >
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

      <aside className="hidden md:flex w-64 flex-col border-r border-zinc-800/50 bg-zinc-950 sticky top-0 h-screen z-50">
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