'use client';

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Eye, 
  Package, 
  Image as ImageIcon, 
  TrendingUp, 
  ShoppingCart,
  ArrowRight,
  Loader2
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

// Helper to safely get ID as string
const safeId = (item) => (item?.id || item?._id)?.toString() || '';

export default function AisleDetailDialog({ aisle, open, onOpenChange }) {
  const [liveData, setLiveData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const username = aisle?.slug || aisle?.user?.username || aisle?.username;

  // 1. Fetch live data for galleries
  useEffect(() => {
    if (open && username) {
      setIsLoading(true);
      fetch(`/api/aisle/${username}`)
        .then(res => res.json())
        .then(data => {
          setLiveData(data);
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Failed to load aisle details:", err);
          setIsLoading(false);
        });
    } else {
      setLiveData(null);
    }
  }, [open, username]);

  if (!aisle) return null;

  // ==========================================
  // SYNC STATS WITH CREATOR CARD
  // ==========================================
  // This explicitly uses the same variables as CreatorCard to guarantee the numbers match.
  const totalProducts = aisle.totalProducts ?? aisle.stats?.totalProducts ?? aisle.user?.stats?.totalProducts ?? 0;
  const totalIPAssets = aisle.totalIPAssets ?? aisle.stats?.totalIPAssets ?? aisle.user?.stats?.totalIPAssets ?? 0;
  const views = aisle.metrics?.views || aisle.stats?.views || aisle.user?.stats?.views || 0;
  const sales = aisle.metrics?.sales || aisle.stats?.sales || aisle.user?.stats?.sales || 0;

  const stats = [
    { label: "Aisle Views", value: views, icon: Eye, color: "text-blue-500" },
    { label: "Products", value: totalProducts, icon: Package, color: "text-purple-500" },
    { label: "IP Assets", value: totalIPAssets, icon: ImageIcon, color: "text-orange-500" },
    { label: "Total Sales", value: sales, icon: ShoppingCart, color: "text-green-500" },
  ];

  // ==========================================
  // MIRROR IMAGE LOGIC FROM AisleProductCard.jsx
  // ==========================================
  const normalizeUrl = (url) => {
    if (!url || typeof url !== 'string') return '/placeholder.png';
    return url.startsWith('//') ? `https:${url}` : url;
  };

  const getProductImage = (item) => {
    if (!item) return '/placeholder.png';
    // Exact match of your working AisleProductCard priorities:
    const rawImageSrc = 
      item.mockupUrl || 
      item.thumbnailUrl || 
      item.mockupImages?.[0] || 
      item.imageUrl || 
      item.images?.[0] || 
      item.image;
      
    return normalizeUrl(rawImageSrc);
  };

  const getIpImage = (ip) => {
    if (!ip) return '/placeholder.png';
    return normalizeUrl(ip.image || ip.imageUrl || ip.thumbnail || ip.mainImage);
  };

  // ==========================================
  // BASE UI VARIABLES (Immediate Load)
  // ==========================================
  const creatorName = liveData?.creator?.title || aisle.title || aisle.user?.name || aisle.name || username || 'Creator';
  const headerImage = normalizeUrl(liveData?.creator?.heroImage || aisle.headerImage || aisle.aisleSettings?.bannerImage || aisle.banner || aisle.bannerUrl);
  const avatar = normalizeUrl(liveData?.creator?.logo || aisle.user?.avatar || aisle.aisleSettings?.logo || aisle.avatar);

  // ==========================================
  // HYDRATE CURATED SECTIONS FROM AISLE SETTINGS
  // ==========================================
  const settingsToUse = liveData?.creator?.aisleSettings || aisle.aisleSettings || {};
  const sections = settingsToUse.aisleSections || [];

  let featuredRaw = null;
  let productsRaw = [];
  let ipsRaw = [];

  sections.forEach(section => {
    const items = section.items || [];
    if (section.type === 'featured') {
       if (items.length > 0) featuredRaw = items[0];
    } else if (section.itemType === 'products' || section.id?.includes('product') || section.type === 'products') {
       productsRaw.push(...items);
    } else if (section.itemType === 'ip' || section.id?.includes('ip') || section.type === 'ip') {
       ipsRaw.push(...items);
    }
  });

  const hydrateItem = (item, type) => {
    if (!item) return null;
    const targetId = safeId(item) || item.productId || item.ipId;
    
    if (type === 'product') {
      return liveData?.products?.find(p => safeId(p) === targetId) || item;
    } else {
      return liveData?.ipAssets?.find(ip => safeId(ip) === targetId) || item;
    }
  };

  const displayFeatured = hydrateItem(featuredRaw, 'product') || liveData?.products?.[0];
  const displayProducts = productsRaw.map(p => hydrateItem(p, 'product')).filter(Boolean);
  const displayIPs = ipsRaw.map(ip => hydrateItem(ip, 'ip')).filter(Boolean);

  const finalProducts = displayProducts.length > 0 ? displayProducts : (liveData?.products || []);
  const finalIPs = displayIPs.length > 0 ? displayIPs : (liveData?.ipAssets || []);

  const topProduct = finalProducts[0] || null;
  const topIp = finalIPs[0] || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border shadow-2xl">
        
        {/* HEADER SECTION */}
        <DialogHeader className="relative">
          <div className="absolute inset-0 h-32 w-full overflow-hidden rounded-t-xl opacity-20">
            <img src={headerImage} className="w-full h-full object-cover blur-sm" alt="Banner" />
          </div>
          
          <div className="relative flex items-center gap-4 pt-8 pb-2 px-4 z-10">
              <div className="h-20 w-20 rounded-full border-4 border-card overflow-hidden bg-muted shadow-xl">
                <img 
                    src={avatar} 
                    className="h-full w-full object-cover" 
                    alt={creatorName}
                    onError={(e) => { e.target.src = 'https://placehold.co/400x400/1e293b/a21caf?text=No+Avatar'; }}
                />
              </div>
              <div>
                <DialogTitle className="text-3xl font-bold text-white">{creatorName}</DialogTitle>
                <p className="text-primary font-medium">@{username}</p>
              </div>
          </div>
        </DialogHeader>

        <Separator className="my-6" />

        {/* STATS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="p-4 rounded-xl bg-accent/30 border border-border/50 flex flex-col items-center text-center transition-colors hover:bg-accent/50">
              <stat.icon className={`h-5 w-5 mb-2 ${stat.color}`} />
              <span className="text-2xl font-bold tracking-tight">{stat.value.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* INVENTORY SECTION */}
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 opacity-70">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground tracking-widest uppercase">Loading Aisle Configuration...</p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-8">
              {/* Top Product */}
              <div className="space-y-4">
                <h3 className="flex items-center gap-2 font-semibold text-lg text-foreground">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Most Popular Product
                </h3>
                {topProduct ? (
                  <div className="group relative rounded-xl border border-border bg-muted/20 p-4 flex gap-4 items-center">
                    <img src={getProductImage(topProduct)} className="h-20 w-20 rounded-lg object-cover shadow-sm bg-muted" alt="" onError={(e) => { e.target.src = 'https://placehold.co/400x400/1e293b/a21caf?text=Error'; }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{topProduct.name || topProduct.title}</p>
                      <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {topProduct.views || 0}</span>
                        <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> {topProduct.sales || 0}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground italic">
                    Awaiting first product...
                  </div>
                )}
              </div>

              {/* Top IP */}
              <div className="space-y-4">
                <h3 className="flex items-center gap-2 font-semibold text-lg text-foreground">
                  <ImageIcon className="h-5 w-5 text-purple-500" />
                  Highest Licensed IP
                </h3>
                {topIp ? (
                  <div className="group relative rounded-xl border border-border bg-muted/20 p-4 flex gap-4 items-center">
                    <img src={getIpImage(topIp)} className="h-20 w-20 rounded-lg object-cover shadow-sm bg-muted" alt="" onError={(e) => { e.target.src = 'https://placehold.co/400x400/1e293b/a21caf?text=Error'; }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{topIp.title || topIp.name}</p>
                      <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 text-purple-400">
                          <TrendingUp className="h-3 w-3" /> 
                          {topIp.licenses || 0} Licenses
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground italic">
                    No IP licensing data yet.
                  </div>
                )}
              </div>
            </div>
              
            <div className="space-y-8 mt-6">
              {/* Featured Item Box */}
              {displayFeatured && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Featured Item</h4>
                  <div className="flex gap-4 items-center">
                    <img src={getProductImage(displayFeatured)} className="w-20 h-20 rounded-lg object-cover bg-muted" onError={(e) => { e.target.src = 'https://placehold.co/400x400/1e293b/a21caf?text=Error'; }} />
                    <div>
                      <p className="font-bold text-white">{displayFeatured.title || displayFeatured.name}</p>
                      <p className="text-sm text-primary">${displayFeatured.price || '59.99'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Products Gallery */}
              <div>
                <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-500" /> Products from this Aisle
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {finalProducts.length > 0 ? finalProducts.slice(0,6).map((p, i) => (
                    <div key={safeId(p) || i} className="aspect-square rounded-lg overflow-hidden border border-white/10 bg-muted">
                      <img 
                        src={getProductImage(p)} 
                        className="w-full h-full object-cover" 
                        alt={p.name || p.title}
                        loading="lazy"
                        onError={(e) => { e.target.src = 'https://placehold.co/400x400/1e293b/a21caf?text=Error'; }}
                      />
                    </div>
                  )) : (
                    <p className="text-xs text-slate-500 italic col-span-3">No products listed yet.</p>
                  )}
                </div>
              </div>

              {/* IP Assets Gallery */}
              <div>
                <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-purple-500" /> IP Assets
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {finalIPs.length > 0 ? finalIPs.slice(0,6).map((ip, i) => (
                    <div key={safeId(ip) || i} className="aspect-square rounded-lg overflow-hidden border border-white/10 bg-muted">
                      <img 
                          src={getIpImage(ip)} 
                          className="w-full h-full object-cover" 
                          alt={ip.title || ip.name}
                          loading="lazy"
                          onError={(e) => { e.target.src = 'https://placehold.co/400x400/1e293b/a21caf?text=Error'; }}
                        />
                    </div>
                  )) : (
                    <p className="text-xs text-slate-500 italic col-span-3">No IP assets listed yet.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Footer Actions */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
           <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">Aisle Status</span>
              <Badge variant="outline" className="mt-1 text-green-500 border-green-500/20 bg-green-500/5 px-3 py-1">
                Verified MetaWork Creator
              </Badge>
           </div>
           <Button 
             size="lg"
             onClick={() => window.location.href = `/aisle/${username}`}
             className="w-full sm:w-auto px-8 bg-primary hover:scale-105 transition-transform"
           >
             Enter Aisle <ArrowRight className="ml-2 h-4 w-4" />
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}