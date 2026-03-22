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

  useEffect(() => {
    console.log('Header: Auth state changed -', {
      isAuthenticated,
      user: user?.email,
    });
  }, [isAuthenticated, user]);

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
      } else {
        toast.error('Wallet connection failed');
      }
    } catch (error) {
      toast.error('Connection cancelled');
    }
  } else {
    toast.info('Sign in first to connect wallet');
    router.push('/login');
  }
};


console.log('Header Debug:', {
  pathname,
  isShowroom,
  isAuthenticated,
  isConnected,
  user
});


  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="grid h-16 grid-cols-[auto,minmax(0,1fr),auto] items-center px-4 md:px-8 gap-4">
        <div className="flex items-center gap-3">
          <MobileSidebar />
          <h2 className="text-sm md:text-base font-medium text-muted-foreground">
            {title}
          </h2>
        </div>

        <div className="flex justify-center">
          <div className="w-full max-w-2xl">
            <GlobalSearch />
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
  {/* Dynamic button based on location and auth */}
  {loading ? (
    // Show nothing while loading (prevents flash)
    <div className="w-[180px]" /> // Empty space to prevent layout shift
  ) : isShowroom ? (
    // On showroom: show Dashboard or Get Account button
    isAuthenticated ? (
      <Link href="/">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs md:text-sm gap-2 text-muted-foreground hover:text-foreground"
        >
          <LayoutDashboard className="h-4 w-4" />
          <span className="hidden md:inline">Dashboard</span>
        </Button>
      </Link>
    ) : (
      <Link href="/register">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs md:text-sm gap-2 text-muted-foreground hover:text-foreground"
        >
          <UserPlus className="h-4 w-4" />
          <span className="hidden md:inline">Get a Free Creator Account</span>
          <span className="md:hidden">Sign Up</span>
        </Button>
      </Link>
    )
  ) : (
    // On dashboard: show Showroom button
    <Link href="/showroom" target="_blank">
      <Button
        variant="ghost"
        size="sm"
        className="text-xs md:text-sm gap-2 text-muted-foreground hover:text-foreground"
      >
        <Store className="h-4 w-4" />
        <span className="hidden md:inline">Showroom</span>
      </Button>
    </Link>
  )}

  <CartButton />
          <div className="text-[10px] md:text-xs text-muted-foreground hidden md:block">
            Auth: {isAuthenticated ? '✓' : '✗'}
          </div>

          {isAuthenticated ? (
            <Button
              onClick={handleWalletClick}
              size="sm"
              disabled={isConnecting}
              className={cn(
                'text-xs md:text-sm',
                isConnected ? 'bg-green-600 hover:bg-green-700 border-green-500/50' : 'border-primary/50'
              )}
              variant={isConnected ? "default" : "outline"}
            >
              <Wallet className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">
                {isConnecting
                  ? 'Connecting...'
                  : isConnected
                  ? truncateAddress(accountAddress)
                  : 'Connect to Mint'}
              </span>
              <span className="sm:hidden">
                {isConnecting
                  ? '...'
                  : isConnected
                  ? 'Connected'
                  : 'Mint'}
              </span>
            </Button>
          ) : (
            <Button
              onClick={() => router.push('/login')}
              size="sm"
              variant="outline"
              className="text-xs md:text-sm"
            >
              <LogIn className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Sign In</span>
              <span className="sm:hidden">Sign In</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
