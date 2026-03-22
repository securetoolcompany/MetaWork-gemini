'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Image as ImageIcon, Search, Plus, Sparkles, TrendingUp } from 'lucide-react';
import IPConsumerDialog from '@/components/ip/IPConsumerDialog';
import IPLibraryDialog from '@/components/product-creator/IPLibraryDialog';

console.log('🧩 ACTIVE IPLibraryPanel FILE LOADED');

/**
 * IP Discovery Panel
 * Shows curated/trending IP and allows opening the full browser
 */
export default function IPLibraryPanel({
  onIPClick,
  selectedIPs,
  onRemoveIP,
  product,
  isConnected,
}) {

    console.log('🧩 IPLibraryPanel RENDERED');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [trendingIPs, setTrendingIPs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [initialIP, setInitialIP] = useState(null);

  const handleOpenDetails = (ip) => {
    setInitialIP(ip);
    setIsDialogOpen(true);
  };

  const handleClickIP = (ip) => {
    console.log('🧩 IPLibraryPanel handleClickIP:', ip);
    if (onIPClick) onIPClick(ip);
  };

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await fetch('/api/ip/library?limit=6');
        const data = await res.json();
        if (data.success) setTrendingIPs(data.ipAssets);
      } catch (e) {
        console.error('Failed to load trending IP', e);
      } finally {
        setLoading(false);
      }
    };
    fetchTrending();
  }, []);

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Discovery Header */}
      <div className="p-4 border-b space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-yellow-500" />
          Discovery
        </h3>
        <Button
          className="w-full gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0"
          variant="outline"
          onClick={() => setIsDialogOpen(true)}
        >
          <Search className="h-4 w-4" />
          Browse Full Library
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <TrendingUp className="h-3 w-3" />
            Trending Now
          </div>

          <div className="grid grid-cols-2 gap-2">
            {loading ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square bg-muted animate-pulse rounded-md" />
              ))
            ) : (
              trendingIPs.map((ip) => (
                <div
                  key={ip.id}
                  className="group relative aspect-square bg-muted rounded-md overflow-hidden cursor-pointer border hover:border-primary/50 transition-all shadow-sm hover:shadow-md"
                  onClick={() => handleOpenDetails(ip)}
                >
                  {ip.thumbnailUrl || ip.imageUrl ? (
                    <img
                      src={ip.thumbnailUrl || ip.imageUrl}
                      alt={ip.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Plus className="text-white h-8 w-8 drop-shadow-md" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                    <p className="text-[10px] text-white font-medium truncate">{ip.name}</p>
                    {ip.ownerName && (
                      <p className="text-[9px] text-gray-300 truncate">{ip.ownerName}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </ScrollArea>

        <IPLibraryDialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setInitialIP(null);
          }}
          onSelectIP={handleClickIP}
          isConnected={isConnected}
          initialIP={initialIP}
        />
    </div>
  );
}
