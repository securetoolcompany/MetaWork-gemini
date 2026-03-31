'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Images,
  Palette,
  Package,
  DollarSign,
  Settings,
  Store,
  Tag,
  User,
  Wallet,
  LogOut,
  LogIn,
  Coins,
  Wand2,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { useWallet } from '@/lib/WalletContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'My IP', href: '/my-ip', icon: Images },
  { name: 'Claim Revenue', href: '/claim', icon: Coins },
  { name: 'Product Creator', href: '/products/creator', icon: Wand2 },
  { name: 'My Products', href: '/my-products', icon: Package },
  { name: 'Promotions', href: '/promotions', icon: Tag },
  { name: 'Profile Settings', href: '/profile-settings', icon: User },
  { name: 'Aisle Settings', href: '/aisle-settings', icon: Store },
  { name: 'Earnings', href: '/earnings', icon: DollarSign },
  { name: 'Account Management', href: '/account-management', icon: Settings },
];

const adminNavigation = [
  { name: 'Admin: Pricing', href: '/admin/pricing', icon: Shield },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { accountAddress, isConnected, disconnect } = useWallet();

  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleLogout = async () => {
    await logout();
    await disconnect();
    router.push('/login');
  };

  return (
    <div className="hidden md:flex h-screen w-60 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
          MetaWork
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
        
        {/* Admin Navigation - only show for admin users */}
        {user?.isAdmin && (
          <>
            <div className="my-4 border-t border-border" />
            {adminNavigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-yellow-500/20 text-yellow-600 shadow-md'
                      : 'text-yellow-600/70 hover:bg-yellow-500/10 hover:text-yellow-600'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User Section */}
      <div className="border-t border-border p-4 space-y-3">
        {/* Wallet Status */}
        {isConnected && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-green-500/10 text-green-500 text-xs">
            <Wallet className="w-3.5 h-3.5" />
            <span className="font-mono">{truncateAddress(accountAddress)}</span>
          </div>
        )}
        
        {/* User Account */}
        {isAuthenticated ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 px-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  {user?.image ? (
                    <img src={user.image} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <User className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium truncate">{user?.name || user?.email || 'User'}</p>
                  <p className="text-xs text-muted-foreground">{user?.membershipTier || 'Free'}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {user?.email && (
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  {user.email}
                </DropdownMenuItem>
              )}
              {user?.walletAddress && (
                <DropdownMenuItem disabled className="text-xs text-muted-foreground font-mono">
                  {truncateAddress(user.walletAddress)}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => router.push('/login')}
          >
            <LogIn className="w-4 h-4 mr-2" />
            Sign In
          </Button>
        )}

        {/* Promo Card */}
        <div className="rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-4 border border-blue-500/20">
          <p className="text-xs font-medium text-foreground mb-1">Creator Pro</p>
          <p className="text-xs text-muted-foreground">Unlock premium features</p>
        </div>
      </div>
    </div>
  );
}
