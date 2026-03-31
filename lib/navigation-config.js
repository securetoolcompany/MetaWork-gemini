// lib/navigation-config.js
import { 
  LayoutDashboard, 
  Images, 
  Coins, 
  Wand2, 
  Package, 
  Tag, 
  User, 
  Store, 
  DollarSign, 
  Settings,
  Shield
} from 'lucide-react';

export const NAVIGATION_ITEMS = [
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

export const ADMIN_NAVIGATION_ITEMS = [
  { name: 'Admin: Pricing', href: '/admin/pricing', icon: Shield },
];