'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Wallet, Store, LogIn, LayoutDashboard, UserPlus, 
  ChevronDown, Info, Landmark, Box, Zap, Globe 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import MobileSidebar from './MobileSidebar';
import CartButton from '@/components/cart/CartButton';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useWallet } from '@/lib/WalletContext';
import GlobalSearch from '@/components/search/GlobalSearch';

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

  // Helper to render Menu Items using standard React calls to bypass JSX Type checking
  const renderMenuItem = (label: string, path: string, Icon: any) => {
    return React.createElement(DropdownMenuItem as any, {
      onSelect: () => router.push(path),
      className: "gap-2 cursor-pointer focus:bg-white/5 focus:text-green-400"
    }, [
      React.createElement(Icon, { key: 'icon', className: "h-4 w-4" }),
      label
    ]);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="grid h-16 grid-cols-[auto,1fr,auto] items-center px-4 md:px-8 gap-4">
        
        {/* Left Side */}
        <div className="flex items-center gap-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                // Changed size from "sm" to "default" for more height
                size="default" 
                // Added text-base (16px) or text-lg, and increased horizontal padding
                className="gap-3 text-muted-foreground hover:text-white focus-visible:ring-0 text-base md:text-lg px-5 transition-all"
              >
                Explore the Platform
                {/* Increased icon size from h-4 w-4 to h-5 w-5 */}
                <ChevronDown className="h-5 w-5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            
            {/* Using React.createElement here bypasses the "children doesn't exist" JSX error */}
            {React.createElement(DropdownMenuContent as any, {
              align: "start",
              className: "w-56 bg-slate-950 border-white/10 text-slate-300"
            }, [
              renderMenuItem("About Us", "/about-us", Info),
              renderMenuItem("What is Tokenization?", "/tokenization", Landmark),
              renderMenuItem("Product Creation", "/product-creation", Box),
              renderMenuItem("Minting Process", "/minting-process", Zap),
              renderMenuItem("Industries", "/industries", Globe),
            ])}
          </DropdownMenu>
        </div>

        {/* Center */}
        <div className="flex justify-center">
          <div className="w-full max-w-xl">
            <GlobalSearch />
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-1 md:gap-2 justify-end">
          {!loading && (
            isShowroom ? (
              isAuthenticated ? (
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm" className="gap-2"><LayoutDashboard className="h-4 w-4" /> Dashboard</Button>
                </Link>
              ) : (
                <Link href="/register">
                  <Button variant="ghost" size="sm" className="gap-2"><UserPlus className="h-4 w-4" /> Get Account</Button>
                </Link>
              )
            ) : (
              <Link href="/showroom">
                <Button variant="ghost" size="sm" className="gap-2"><Store className="h-4 w-4" /> Showroom</Button>
              </Link>
            )
          )}

          <CartButton />

          {isAuthenticated ? (
            <Button
              onClick={handleWalletClick}
              size="sm"
              className={cn('h-9 px-2 md:px-3', isConnected ? 'bg-green-600' : 'border-primary/50')}
              variant={isConnected ? "default" : "outline"}
            >
              <Wallet className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">{isConnected ? truncateAddress(accountAddress) : 'Connect'}</span>
            </Button>
          ) : (
            <Button onClick={() => router.push('/login')} size="sm" variant="outline">
              <LogIn className="h-4 w-4 md:mr-2" /> Sign In
            </Button>
          )}

          <div className="md:hidden ml-1">
            <MobileSidebar />
          </div>
        </div>
      </div>
    </header>
  );
}