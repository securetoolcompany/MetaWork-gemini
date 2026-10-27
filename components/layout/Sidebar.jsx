'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { AccountLink as Link } from '@/components/auth/AccountAccessProvider';
import {
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import {
  LayoutDashboard,
  Settings,
  TrendingUp,
  Gift,
  Info,
  Box,
  Zap,
  Globe,
  Home,
  LogIn,
  LogOut,
  UserPlus,
  Store,
  Palette,
  Terminal,
  Menu,
  ChevronDown,
  Dumbbell,
  GraduationCap,
  BookOpen,
  Compass,
  Coffee,
  HeartHandshake,
  ShoppingCart,
  Wrench,
  FileText,
  Wallet,
  Shield,
  Coins,
  FolderOpen,
  Package,
  User,
  Factory,
  Swords,
  Music,
  Star,
  Sparkles,
  HandCoins,
  Landmark,
  ClipboardList,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';

const shopMenuItem = {
  icon: ShoppingCart,
  label: 'Shop',
  href: '/showroom',
  subItems: [
    {
      icon: Package,
      label: 'Products',
      href: '/showroom?tab=products',
    },
    {
      icon: Store,
      label: 'Aisles',
      href: '/showroom?tab=aisles',
    },
    {
      icon: FolderOpen,
      label: 'IP Assets',
      href: '/showroom?tab=ip',
    },
  ],
};

const learnMenuItem = {
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
};

const industriesMenuItem = {
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
};

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
  shopMenuItem,
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
  learnMenuItem,
  industriesMenuItem,
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

function matchesHref(href, pathname, searchParams) {
  if (!href) return false;

  const [targetPath, targetQuery] = href.split('?');

  if (pathname !== targetPath) return false;
  if (!targetQuery) return true;

  const targetParams = new URLSearchParams(targetQuery);

  return Array.from(targetParams.entries()).every(([key, value]) => {
    const currentValue =
      searchParams.get(key) ||
      (pathname === '/showroom' && key === 'tab' ? 'products' : null);

    return currentValue === value;
  });
}

function NavItem({
  item,
  pathname,
  searchParams,
  onNavigate,
}) {
  const isExactActive = matchesHref(
    item.href,
    pathname,
    searchParams
  );

  const isChildActive = Boolean(
    item.subItems?.some((sub) =>
      matchesHref(sub.href, pathname, searchParams)
    )
  );

  const isActive = isExactActive || isChildActive;
  const [isOpen, setIsOpen] = useState(isActive);
  const Icon = item.icon;

  useEffect(() => {
    if (isActive) {
      setIsOpen(true);
    }
  }, [isActive, pathname]);

  if (item.subItems?.length) {
    return (
      <div className="space-y-1">
        <div
          className={cn(
            'group flex w-full items-center justify-between rounded-xl border pr-2 text-sm font-medium transition-colors',
            isActive
              ? 'border-blue-500/20 bg-blue-500/5 text-white'
              : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
          )}
        >
          <Link
            href={item.href}
            onClick={() => {
              setIsOpen(true);
              onNavigate?.();
            }}
            className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5"
          >
            <Icon
              className={cn(
                'h-4 w-4 shrink-0',
                isActive ? 'text-blue-400' : 'text-slate-500'
              )}
              aria-hidden="true"
            />
            <span className={isActive ? 'font-bold' : ''}>
              {item.label}
            </span>
          </Link>

          <button
            type="button"
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${item.label}`}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((open) => !open)}
            className="rounded-md p-2 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 text-slate-500 transition-transform',
                isOpen && 'rotate-180'
              )}
              aria-hidden="true"
            />
          </button>
        </div>

        {isOpen && (
          <div className="ml-5 mt-1 space-y-1 border-l border-zinc-800 pl-4 pr-1">
            {item.subItems.map((sub) => {
              const isSubActive = matchesHref(
                sub.href,
                pathname,
                searchParams
              );

              const SubIcon = sub.icon;

              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  onClick={() => onNavigate?.()}
                  aria-current={isSubActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                    isSubActive
                      ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                      : 'border-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300'
                  )}
                >
                  {SubIcon && (
                    <SubIcon
                      className="h-3 w-3 shrink-0"
                      aria-hidden="true"
                    />
                  )}

                  <span className={isSubActive ? 'font-bold' : ''}>
                    {sub.label}
                  </span>
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
      onClick={() => onNavigate?.()}
      aria-current={isExactActive ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
        isExactActive
          ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
          : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          isExactActive ? 'text-blue-400' : 'text-slate-500'
        )}
        aria-hidden="true"
      />
      <span className={isExactActive ? 'font-bold' : ''}>
        {item.label}
      </span>
    </Link>
  );
}

function NavContent({
  isAuthenticated,
  menuItems,
  menuTitle,
  pathname,
  searchParams,
  logout,
  router,
  onNavigate,
}) {
  const handleSignOut = async () => {
    await logout();
    onNavigate?.();
    router.push('/');
  };

  const goToLogin = () => {
    onNavigate?.();
    router.push('/login');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950">
      <div className="flex h-16 shrink-0 items-center border-b border-zinc-800/50 px-6">
        <Link
          href="/"
          onClick={() => onNavigate?.()}
          className="text-xl font-black italic tracking-tighter"
        >
          META
          <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            WORK
          </span>
        </Link>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-center gap-2">
          <Terminal
            className="h-3.5 w-3.5 text-blue-400"
            aria-hidden="true"
          />
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            {menuTitle}
          </h2>
        </div>

        <nav
          aria-label={menuTitle}
          className="space-y-1.5"
        >
          {menuItems.map((item) => (
            <NavItem
              key={item.label}
              item={item}
              pathname={pathname}
              searchParams={searchParams}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </div>

      <div className="shrink-0 space-y-3 border-t border-zinc-800/50 bg-zinc-950 p-6">
        {isAuthenticated ? (
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start gap-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs">Sign Out</span>
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              onClick={goToLogin}
              className="w-full justify-start gap-3 border border-zinc-800 text-slate-400 hover:bg-white/5"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs">Sign In</span>
            </Button>

            <Button
              onClick={goToLogin}
              className="w-full justify-start gap-3 rounded-none bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:bg-blue-700"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              <span className="text-[11px] font-semibold uppercase tracking-widest">
                Create Account
              </span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const { isAuthenticated, loading, logout, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin =
    user?.isAdmin === true || user?.role === 'admin';

  const dashboardMenuItems = [
    {
      icon: LayoutDashboard,
      label: 'Dashboard',
      href: '/dashboard',
    },
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
    shopMenuItem,
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
    {
      icon: HandCoins,
      label: 'Payouts & Claims',
      href: '/claim',
    },
    learnMenuItem,
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

  if (loading) return null;

  const menuItems = isAuthenticated
    ? dashboardMenuItems
    : publicMenuItems;

  const menuTitle = isAuthenticated
    ? 'Your Workspace'
    : 'Explore MetaWork';

  const navProps = {
    isAuthenticated,
    menuItems,
    menuTitle,
    pathname,
    searchParams,
    logout,
    router,
  };

  return (
    <>
      <div className="fixed left-4 top-4 z-[50] md:hidden">
        <Sheet
          open={mobileOpen}
          onOpenChange={setMobileOpen}
        >
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Open navigation"
              className="border-zinc-800 bg-zinc-950 text-blue-400 shadow-lg hover:bg-zinc-900"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </Button>
          </SheetTrigger>

          <SheetContent
            side="left"
            className="w-64 border-r border-zinc-800 bg-zinc-950 p-0"
          >
            <NavContent
              {...navProps}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      <aside className="sticky top-0 z-50 hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-800/50 bg-zinc-950 md:flex">
        <NavContent {...navProps} />
      </aside>
    </>
  );
}

export default function Sidebar() {
  return (
    <Suspense fallback={null}>
      <SidebarContent />
    </Suspense>
  );
}