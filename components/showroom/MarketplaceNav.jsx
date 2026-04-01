'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sparkles, Home, User } from 'lucide-react';

export default function MarketplaceNav() {
  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/marketplace" className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              MetaWork
            </span>
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-4">
            <Link href="/marketplace">
              <Button variant="ghost" size="sm" className="gap-2">
                <Home className="w-4 h-4" />
                Marketplace
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="gap-2">
                <User className="w-4 h-4" />
                Creator Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
