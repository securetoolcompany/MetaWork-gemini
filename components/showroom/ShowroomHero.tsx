'use client';

import { Users, Package, Sparkles, } from 'lucide-react';
import { Card } from '@/components/ui/card';
import AisleAdPlacement from '@/components/aisle-public/AisleAdPlacement';

type ShowroomHeroProps = {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onServerSearch?: (q: string) => void | Promise<void>;
  isSearching: boolean;
  stats: {
    totalCreators: number;
    totalProducts: number;
    totalIpAssets: number;
  };
};

export default function ShowroomHero({
  searchQuery,
  setSearchQuery,
  onServerSearch,
  isSearching,
  stats,
}: ShowroomHeroProps) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border-b border-border">
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="relative max-w-7xl mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-8">
          <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
            <Card className="p-3 bg-background/60 backdrop-blur-sm border-primary/20">
              <Users className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <div className="text-xl font-bold">
                {stats?.totalCreators || 0}
              </div>
              <div className="text-xs text-muted-foreground">Creators</div>
            </Card>

            <Card className="p-3 bg-background/60 backdrop-blur-sm border-primary/20">
              <Package className="w-5 h-5 mx-auto mb-1 text-purple-500" />
              <div className="text-xl font-bold">
                {stats?.totalProducts || 0}
              </div>
              <div className="text-xs text-muted-foreground">Products</div>
            </Card>

            <Card className="p-3 bg-background/60 backdrop-blur-sm border-primary/20">
              <Sparkles className="w-5 h-5 mx-auto mb-1 text-pink-500" />
              <div className="text-xl font-bold">
                {stats?.totalIpAssets || 0}
              </div>
              <div className="text-xs text-muted-foreground">IP Assets</div>
            </Card>
          </div>
        </div>

        <AisleAdPlacement type="header" accentColor="#3b82f6" />
      </div>
    </div>
  );
}
