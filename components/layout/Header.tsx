'use client';

import { Button } from '@/components/ui/button';
import { Wallet, Store, LogIn, LayoutDashboard, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import MobileSidebar from './MobileSidebar';
import CartButton from '@/components/cart/CartButton';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useWallet } from '@/lib/WalletContext';
import { useEffect } from 'react';
import GlobalSearch from '@/components/search/GlobalSearch';

type HeaderProps = {
  title?: string;
};

export default function Header({ title }: HeaderProps) {
  const router = useRouter();
  const { isAuthenticated, user, loading } = useAuth();
  const { accountAddress, isConnected, connect, isConnecting } = useWallet();
  const pathname = usePathname();
  const isShowroom = pathname?.startsWith('/showroom');

  const truncateAddress = (address?: string) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleWalletClick = async () => {
    if (isConnected) {
      toast.info('Wallet connected!');
      return;
    } 
    if (isAuthenticated) {
      try {
        const address = await connect();
        if (address) {
          toast.success(`Wallet connected: ${truncateAddress(address)}`);
        }
      } catch (error) {
        toast.error('Connection cancelled');
      }
    } else {
      toast.info('Sign in first to connect wallet');
      router.push('/login');
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="grid h-16 grid-cols-[auto,minmax(0,1fr),auto] items-center px-4 md:px-8 gap-4">
        {/* Left: Title */}
        <div className="flex items-center gap-3">
          <h2 className="text-sm md:text-base font-medium text-muted-foreground truncate max-w-[100px] md:max-w-none">
            {title}
          </h2>
        </div>

        {/* Center: Search */}
        <div className="flex justify-center">
          <div className="w-full max-w-2xl">
            <GlobalSearch />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 md:gap-2 justify-end">
          {/* Dashboard/Showroom Toggle - Now visible on mobile too */}
          {!loading && (
            isShowroom ? (
              isAuthenticated ? (
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm" className="h-9 w-9 md:w-auto md:px-3 gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="hidden md:inline">Dashboard</span>
                  </Button>
                </Link>
              ) : (
                <Link href="/register">
                  <Button variant="ghost" size="sm" className="h-9 w-9 md:w-auto md:px-3 gap-2">
                    <UserPlus className="h-4 w-4" />
                    <span className="hidden md:inline">Get Account</span>
                  </Button>
                </Link>
              )
            ) : (
              <Link href="/showroom">
                <Button variant="ghost" size="sm" className="h-9 w-9 md:w-auto md:px-3 gap-2">
                  <Store className="h-4 w-4" />
                  <span className="hidden md:inline">Showroom</span>
                </Button>
              </Link>
            )
          )}

          <CartButton />

          {/* Wallet/Login */}
          {isAuthenticated ? (
            <Button
              onClick={handleWalletClick}
              size="sm"
              className={cn(
                'h-9 px-2 md:px-3',
                isConnected ? 'bg-green-600 hover:bg-green-700' : 'border-primary/50'
              )}
              variant={isConnected ? "default" : "outline"}
            >
              <Wallet className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">
                {isConnected ? truncateAddress(accountAddress) : 'Connect'}
              </span>
            </Button>
          ) : (
            <Button
              onClick={() => router.push('/login')}
              size="sm"
              variant="outline"
              className="h-9 px-2 md:px-3"
            >
              <LogIn className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Sign In</span>
            </Button>
          )}

          {/* New Mobile Menu Button */}
          <div className="md:hidden ml-1">
            <MobileSidebar />
          </div>
        </div>
      </div>
    </header>
  );
}