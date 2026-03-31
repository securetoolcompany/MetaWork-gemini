'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Image as ImageIcon, Search, Plus, Sparkles, TrendingUp } from 'lucide-react';
import IPLibraryDialog from '@/components/product-creator/IPLibraryDialog';
import { useIsMobile } from '@/hooks/use-mobile'; // Assuming this is the correct path for your hook
import { cn } from '@/lib/utils';

export default function IPLibraryPanel({
  onIPClick,
  selectedIPs,
  onRemoveIP,
  product,
  isConnected,
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [trendingIPs, setTrendingIPs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialIP, setInitialIP] = useState(null);
  const isMobile = useIsMobile();

  const handleOpenDetails = (ip) => {
    setInitialIP(ip);
    setIsDialogOpen(true);
  };

  const handleClickIP = (ip) => {
    if (onIPClick) onIPClick(ip);
  };

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await fetch('/api/ip/library?limit=8');
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
    <div className="flex flex-col h-full bg-card border-b md:border-r border-border">
      {/* Header: More compact on mobile to save vertical space */}
      <div className="p-3 md:p-4 border-b flex md:flex-col items-center md:items-start justify-between gap-3">
        <h3 className="font-semibold flex items-center gap-2 text-sm md:text-base whitespace-nowrap">
          <Sparkles className="h-4 w-4 text-yellow-500" />
          <span className="hidden xs:inline">IP Discovery</span>
          <span className="xs:hidden">Discovery</span>
        </h3>
        
        <Button
          className="h-8 md:h-10 md:w-full gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 text-xs"
          onClick={() => setIsDialogOpen(true)}
        >
          <Search className="h-3.5 w-3.5 md:h-4 md:w-4" />
          {isMobile ? 'Browse' : 'Browse Full Library'}
        </Button>
      </div>

      {/* Content Area: Horizontal scroll on mobile, Vertical on desktop */}
      <ScrollArea className={cn("w-full", isMobile ? "h-32 whitespace-nowrap" : "flex-1")}>
        <div className={cn("p-3", isMobile ? "flex gap-3" : "space-y-4")}>
          
          {!isMobile && (
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <TrendingUp className="h-3 w-3" />
              Trending Now
            </div>
          )}

          {/* Dynamic Grid vs Flex layout */}
          <div className={cn(
            "grid gap-2", 
            isMobile ? "flex flex-row" : "grid-cols-2"
          )}>
            {loading ? (
              [1, 2, 3, 4].map((i) => (
                <div 
                  key={i} 
                  className={cn("bg-muted animate-pulse rounded-md", isMobile ? "h-20 w-20 shrink-0" : "aspect-square")} 
                />
              ))
            ) : (
              trendingIPs.map((ip) => (
                <div
                  key={ip.id}
                  className={cn(
                    "group relative bg-muted rounded-md overflow-hidden cursor-pointer border hover:border-primary/50 transition-all shadow-sm",
                    isMobile ? "h-20 w-20 shrink-0" : "aspect-square"
                  )}
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
                      <ImageIcon className="h-4 w-4 md:h-6 md:w-6" />
                    </div>
                  )}

                  {/* Overlay Actions: Simplified for Mobile */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Plus className="text-white h-5 w-5 md:h-8 md:w-8 drop-shadow-md" />
                  </div>

                  {/* Text: Hidden on mobile scroll view to maximize image visibility */}
                  {!isMobile && (
                    <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                      <p className="text-[10px] text-white font-medium truncate">{ip.name}</p>
                      {ip.ownerName && (
                        <p className="text-[9px] text-gray-300 truncate">{ip.ownerName}</p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        {isMobile && <ScrollBar orientation="horizontal" />}
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