'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Settings, TrendingUp, Gift, Info,
  Box, Zap, Globe, Home, LogIn, LogOut, UserPlus, Store,
  Palette, LayoutGrid, Terminal, Menu, ChevronDown, Dumbbell,
  GraduationCap, BookOpen, Compass, Coffee, HeartHandshake, ShoppingCart,
  Wrench, FileText, DollarSignIcon, Wallet, Shield, Coins,
  FolderOpen, Package, User, Factory, Swords, Music, Star, Sparkles, 
  HandCoins, Landmark, Layers3, ClipboardList
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
          <span className="font-mono text-xs">Sign Out</span>
        </Button>
      ) : (
        <>
          <Button
            variant="ghost"
            onClick={() => router.push('/login')}
            className="w-full justify-start gap-3 text-slate-400 hover:bg-white/5 border border-zinc-800"
          >
            <LogIn className="h-4 w-4" />
            <span className="font-mono text-xs">Sign In</span>
          </Button>
          <Button
            onClick={() => router.push('/login')}
            className="w-full justify-start gap-3 bg-blue-600 hover:bg-blue-700 rounded-none shadow-[0_0_20px_rgba(37,99,235,0.3)]"
          >
            <UserPlus className="h-4 w-4" />
            <span className="font-mono text-[11px] uppercase tracking-widest">
              Create Account
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
  const { isAuthenticated, loading, logout, user } = useAuth();

  const isAdmin = user?.isAdmin === true || user?.role === 'admin';
    const dashboardMenuItems = [
    {
      icon: LayoutDashboard,
      label: 'Dashboard',
      href: '/dashboard',
    },

    // 1. Create products, publish to your Aisle, and manage sales.
    {
      icon: Palette,
      label: 'Create & Sell',
      href: '/my-products',
      subItems: [
        {
          icon: Palette,
          label: 'Create a Product',
          href: '/products/creator',
        },
        {
          icon: Package,
          label: 'My Products',
          href: '/my-products',
        },
        {
          icon: FolderOpen,
          label: 'My IP',
          href: '/my-ip',
        },
        {
          icon: Store,
          label: 'My Aisle',
          href: '/aisle-settings',
        },
        {
          icon: Gift,
          label: 'Promotions & Marketing',
          href: '/promotions',
        },
        {
          icon: ShoppingCart,
          label: 'My Sales',
          href: '/sales',
        },
        {
          icon: TrendingUp,
          label: 'My Earnings',
          href: '/earnings',
        },
      ],
    },

    // 2. Shopping remains available after signing in.
    {
      icon: ShoppingCart,
      label: 'Shop',
      href: '/showroom',
    },

    // 3. Explore and track revenue-sharing participation.
    {
      icon: TrendingUp,
      label: 'Invest',
      href: '/tokenized-funds',
      subItems: [
        {
          icon: Landmark,
          label: 'Explore Revenue Products',
          href: '/tokenized-funds',
        },
        {
          icon: Coins,
          label: 'Nillion Nodes',
          href: '/tokenized-funds/nillion',
        },
      ],
    },

    // 4. Tools for issuing, structuring, and managing assets.
    {
      icon: Wrench,
      label: 'Business Tools',
      href: '/tools',
      subItems: [
        {
          icon: Wrench,
          label: 'Explore the Toolbox',
          href: '/tools',
        },
        {
          icon: Coins,
          label: 'Revenue Tokenization',
          href: '/revenue-tokenization',
        },
        {
          icon: Shield,
          label: 'Minting Authentication',
          href: '/mint-authentication',
        },
        {
          icon: Box,
          label: 'Manufacturing Catalog',
          href: '/catalog',
        },
      ],
    },

    // Shared destination for creator and investor claims.
    {
      icon: HandCoins,
      label: 'Payouts & Claims',
      href: '/claim',
    },

    {
      icon: GraduationCap,
      label: 'Learn',
      href: '/academy',
      subItems: [
        {
          icon: GraduationCap,
          label: 'MetaWork Academy',
          href: '/academy',
        },
        {
          icon: BookOpen,
          label: 'Free Lesson Library',
          href: '/academy/library',
        },
        {
          icon: Compass,
          label: 'Learning Pathways',
          href: '/academy/pathways/start-here',
        },
        {
          icon: HeartHandshake,
          label: 'Schools & Programs',
          href: '/academy/programs',
        },
        {
          icon: Wallet,
          label: 'Wallet Guide',
          href: '/wallet-guide',
        },
      ],
    },

    {
      icon: Settings,
      label: 'Account',
      href: '/account-management',
      subItems: [
        {
          icon: Settings,
          label: 'Account Management',
          href: '/account-management',
        },
        {
          icon: User,
          label: 'Edit Public Profile',
          href: '/profile-settings',
        },
      ],
    },

    // Preserve the existing admin-only navigation.
    ...(isAdmin
      ? [
          {
            icon: Shield,
            label: 'Admin',
            href: '/admin/pool',
            subItems: [
              {
                icon: Landmark,
                label: 'Pool Dashboard',
                href: '/admin/pool',
              },
              {
                icon: ClipboardList,
                label: 'Order Management',
                href: '/admin/orders',
              },
            ],
          },
        ]
      : []),
  ];

  const publicMenuItems = [
  {
    icon: Home,
    label: 'Choose Your Pathway',
    href: '/',
  },
  {
    icon: Palette,
    label: 'Create & Sell',
    href: '/metawork-overview/product-creation',
    subItems: [
      {
        icon: Factory,
        label: 'How Product Creation Works',
        href: '/metawork-overview/product-creation',
      },
      {
        icon: Palette,
        label: 'Create a Product',
        href: '/products/creator',
      },
      {
        icon: Store,
        label: 'Set Up Your Aisle',
        href: '/aisle-settings',
      },
      {
        icon: FolderOpen,
        label: 'Manage Your IP',
        href: '/my-ip',
      },
      {
        icon: TrendingUp,
        label: 'Your Earnings',
        href: '/earnings',
      },
    ],
  },
  {
    icon: ShoppingCart,
    label: 'Shop',
    href: '/showroom',
    subItems: [
      {
        icon: LayoutGrid,
        label: 'Explore the Showroom',
        href: '/showroom',
      },
      {
        icon: Store,
        label: 'How Creator Aisles Work',
        href: '/metawork-overview/selling',
      },
    ],
  },
  {
    icon: TrendingUp,
    label: 'Invest',
    href: '/tokenized-funds',
    subItems: [
      {
        icon: Landmark,
        label: 'Explore Revenue Products',
        href: '/tokenized-funds',
      },
      {
        icon: Coins,
        label: 'Nillion Nodes',
        href: '/tokenized-funds/nillion',
      },
      {
        icon: BookOpen,
        label: 'Understand Tokenization',
        href: '/metawork-overview/tokenization',
      },
      {
        icon: HandCoins,
        label: 'Claim Distributions',
        href: '/claim',
      },
    ],
  },
  {
    icon: Wrench,
    label: 'Business Tools',
    href: '/tools',
    subItems: [
      {
        icon: Wrench,
        label: 'Explore the Toolbox',
        href: '/tools',
      },
      {
        icon: Coins,
        label: 'Revenue Tokenization',
        href: '/revenue-tokenization',
      },
      {
        icon: Shield,
        label: 'Minting Authentication',
        href: '/mint-authentication',
      },
      {
        icon: Package,
        label: 'Manage Products',
        href: '/my-products',
      },
      {
        icon: Store,
        label: 'Sales & Marketing',
        href: '/sales',
      },
      {
        icon: Box,
        label: 'Manufacturing Catalog',
        href: '/catalog',
      },
    ],
  },
  {
    icon: GraduationCap,
    label: 'Learn',
    href: '/academy',
    subItems: [
      {
        icon: GraduationCap,
        label: 'MetaWork Academy',
        href: '/academy',
      },
      {
        icon: BookOpen,
        label: 'Free Lesson Library',
        href: '/academy/library',
      },
      {
        icon: Compass,
        label: 'Learning Pathways',
        href: '/academy/pathways/start-here',
      },
      {
        icon: HeartHandshake,
        label: 'Schools & Programs',
        href: '/academy/programs',
      },
      {
        icon: Wallet,
        label: 'Wallet Guide',
        href: '/wallet-guide',
      },
    ],
  },
  {
    icon: Globe,
    label: 'Industries We Serve',
    href: '/industries',
    subItems: [
      {
        icon: Swords,
        label: 'Fighters',
        href: '/industries/fighters',
      },
      {
        icon: Zap,
        label: 'Extreme Athletes',
        href: '/industries/extreme-athletes',
      },
      {
        icon: Dumbbell,
        label: 'Gyms & Fitness',
        href: '/industries/gyms-fitness',
      },
      {
        icon: Music,
        label: 'Musicians',
        href: '/industries/musicians',
      },
      {
        icon: Star,
        label: 'Influencers',
        href: '/industries/influencers',
      },
      {
        icon: Palette,
        label: 'Creators & IP',
        href: '/industries/creators',
      },
      {
        icon: GraduationCap,
        label: 'Education',
        href: '/industries/education',
      },
      {
        icon: HeartHandshake,
        label: 'Non-Profits',
        href: '/industries/non-profits',
      },
      {
        icon: Coffee,
        label: 'Food & Beverage',
        href: '/industries/food-beverage',
      },
      {
        icon: Sparkles,
        label: 'Beauty & Personal Care',
        href: '/industries/beauty-personal-care',
      },
      {
        icon: ShoppingCart,
        label: 'Retailers & LGS',
        href: '/industries/retailers',
      },
      {
        icon: Gift,
        label: 'B2B & Promo',
        href: '/industries/gifts-promo',
      },
    ],
  },
  {
    icon: Info,
    label: 'About MetaWork',
    href: '/about-us',
    subItems: [
      {
        icon: Info,
        label: 'About Us',
        href: '/about-us',
      },
      {
        icon: FileText,
        label: 'Whitepaper',
        href: '/whitepaper',
      },
    ],
  },
];

  if (loading) return null;

  const menuItems = isAuthenticated ? dashboardMenuItems : publicMenuItems;
  const menuTitle = isAuthenticated ? 'Your Workspace' : 'Explore MetaWork';

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