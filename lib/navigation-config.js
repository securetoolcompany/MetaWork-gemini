// lib/navigation-config.js
import {
  Images,
  Coins,
  Wand2,
  Package,
  Tag,
  User,
  Store,
  DollarSign,
  Settings,
  Shield,
  ShieldCheck,
  Layers,
} from 'lucide-react';

export const NAVIGATION_ITEMS = [
  // IP & Blockchain
  { name: 'Manage IP Assets',        href: '/my-ip',                  icon: Images },
  { name: 'Minting Authentication',  href: '/mint-authentication',    icon: ShieldCheck },
  { name: 'Revenue Tokenization',    href: '/revenue-tokenization',   icon: Layers },
  { name: 'Claim Revenue',           href: '/claim',                  icon: Coins },
  // Products
  { name: 'Product Creator',         href: '/products/creator',       icon: Wand2 },
  { name: 'Manage Products',         href: '/my-products',            icon: Package },
  // Sales & Marketing
  { name: 'Promotions',              href: '/promotions',             icon: Tag },
  { name: 'Profile Editor',          href: '/profile-settings',       icon: User },
  { name: 'Aisle Settings',          href: '/aisle-settings',         icon: Store },
  // Account
  { name: 'Earnings',                href: '/earnings',               icon: DollarSign },
  { name: 'Account Management',      href: '/account-management',     icon: Settings },
];

export const ADMIN_NAVIGATION_ITEMS = [
  { name: 'Admin: Pricing', href: '/admin/pricing', icon: Shield },
];