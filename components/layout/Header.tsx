// @ts-nocheck
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Wallet,
  Store,
  LogIn,
  LayoutDashboard,
  UserPlus,
  Languages,
} from 'lucide-react';
import MobileSidebar from './MobileSidebar';
import CartButton from '@/components/cart/CartButton';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useWallet } from '@/lib/WalletContext';
import GlobalSearch from '@/components/search/GlobalSearch';

declare global {
  interface Window {
    doGTranslate?: (lang: string) => void;
  }
}

const LANGUAGES = [
  { code: 'en|en', label: 'English' },
  { code: 'en|es', label: 'Español' },
  { code: 'en|fr', label: 'Français' },
  { code: 'en|it', label: 'Italiano' },
];

export default function Header({ title }: { title?: string }) {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const { accountAddress, isConnected, connect } = useWallet();
  const pathname = usePathname();
  const isShowroom = pathname?.startsWith('/showroom');

  const truncateAddress = (address?: string) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleWalletClick = async () => {
    if (isConnected) return;
    if (isAuthenticated) {
      try {
        await connect();
      } catch (error) {
        // Connection cancelled
      }
    } else {
      router.push('/login');
    }
  };

  const handleLanguageChange = (code: string) => {
    const lang = code.split('|')[1];
    document.cookie = `googtrans=/en/${lang}; path=/`;
    document.cookie = `googtrans=/en/${lang}; domain=${window.location.hostname}; path=/`;
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur w-full">
      <div className="grid h-16 grid-cols-[256px,1fr,auto] items-center px-4 md:px-8 gap-4">
        <div className="hidden md:block" />

        <div className="flex justify-center">
          <div className="w-full max-w-xl">
            <GlobalSearch />
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 justify-end">

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Languages className="h-4 w-4" />
                <span className="hidden md:inline">Translate</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                >
                  {lang.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {!loading &&
            (isShowroom ? (
              <Link href={isAuthenticated ? '/dashboard' : '/register'}>
                <Button variant="ghost" size="sm" className="gap-2">
                  {isAuthenticated ? (
                    <LayoutDashboard className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  <span className="hidden md:inline">
                    {isAuthenticated ? 'Dashboard' : 'Get Account'}
                  </span>
                </Button>
              </Link>
            ) : (
              <Link href="/showroom">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Store className="h-4 w-4" />
                  <span className="hidden md:inline">Showroom</span>
                </Button>
              </Link>
            ))}

          <CartButton />

          <Button
            onClick={isAuthenticated ? handleWalletClick : () => router.push('/login')}
            size="sm"
            variant={isConnected ? 'default' : 'outline'}
            className={cn('h-9 px-2 md:px-3', isConnected && 'bg-green-600')}
          >
            {isAuthenticated ? (
              <Wallet className="h-4 w-4 md:mr-2" />
            ) : (
              <LogIn className="h-4 w-4 md:mr-2" />
            )}
            <span className="hidden md:inline">
              {isAuthenticated
                ? isConnected
                  ? truncateAddress(accountAddress)
                  : 'Connect'
                : 'Sign In'}
            </span>
          </Button>

          <div className="md:hidden">
            <MobileSidebar />
          </div>
        </div>
      </div>
    </header>
  );
}