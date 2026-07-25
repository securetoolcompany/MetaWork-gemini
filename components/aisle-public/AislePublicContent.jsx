'use client';

import React, { useEffect, useState } from 'react';
import { Package, Sparkles, Quote, Eye, ShoppingBag, Zap } from 'lucide-react';
import { useProductDialog } from '@/app/providers/ProductDialogProvider'; 

import AisleProductCard from './AisleProductCard';
import AisleIPAssetCard from './AisleIPAssetCard';

const safeId = (item) => (item?.id || item?._id)?.toString() || '';

export default function AislePublicContent({ products = [], ipAssets = [], settings = {}, creator = {} }) {
  const { openDialog } = useProductDialog();
  const accentColor = settings.accentColor || '#10b981';
  
  const layoutSections = settings.aisleSections || [];
  const isFeaturedEnabled = settings.featuredItemEnabled;
  const featuredId = settings.featuredItemId;
  const featuredType = settings.featuredItemType;

  // Resolve the full object for the Featured Item
  let featuredItem = null;
  if (isFeaturedEnabled && featuredId) {
    if (featuredType === 'products' || featuredType === 'community') {
      featuredItem = products.find(p => safeId(p) === String(featuredId));
    } else if (featuredType === 'ip') {
      featuredItem = ipAssets.find(a => safeId(a) === String(featuredId));
    } else if (featuredType === 'collections') {
      featuredItem = settings.collections?.find(c => safeId(c) === String(featuredId));
      if (featuredItem) featuredItem.isCollection = true;
    }
  }

  const isProduct = featuredType === 'products' || featuredType === 'community' || (featuredItem && featuredItem.price !== undefined && !featuredItem.isCollection);

  const formatStat = (num) => {
    if (!num) return '0';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  const getDisplayImage = (item) => {
    if (!item) return '/placeholder.png';
    const candidates = [
      item.mockupImages?.[0],
      item.images?.[0],
      item.mockupUrl,
      item.thumbnailUrl,
      item.imageUrl,
      item.image,
    ];
    for (const val of candidates) {
      if (!val) continue;
      let url = typeof val === 'object' ? (val.secure_url || val.url) : val;
      if (!url) continue;
      return url.startsWith('//') ? `https:${url}` : url;
    }
    return '/placeholder.png';
  };

  const [liveViewCount, setLiveViewCount] = useState(featuredItem?.viewCount ?? 0);

  useEffect(() => {
    if (!featuredItem) return;
    const id = safeId(featuredItem);
    if (!id) return;

    const isIP = featuredType === 'ip';
    const endpoint = isIP ? `/api/ip-assets/${id}` : `/api/products/${id}`;

    fetch(endpoint, { method: 'POST' })
      .then(r => r.json())
      .then(() => fetch(endpoint))
      .then(r => r.json())
      .then(data => {
        if (data?.product?.viewCount !== undefined) setLiveViewCount(data.product.viewCount);
        if (data?.ipAsset?.viewCount !== undefined) setLiveViewCount(data.ipAsset.viewCount);
      })
      .catch(() => {});
  }, [safeId(featuredItem)]);

  return (
    <div className="mt-4 md:mt-8 space-y-16 md:space-y-32">
      {/* FEATURED HERO */}
      {featuredItem && (
        <section className="relative w-full max-w-[1600px] mx-auto group px-4 md:px-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full opacity-[0.04] blur-[80px] md:blur-[140px] pointer-events-none rounded-full" style={{ backgroundColor: accentColor }} />

          <div className="relative z-10 p-6 md:p-16 rounded-[2rem] md:rounded-[4rem] bg-slate-950/40 border border-white/5 shadow-2xl backdrop-blur-md">
            
            <div className="flex flex-col md:flex-row items-center md:items-center gap-4 md:gap-8 w-full mb-10 md:mb-14 relative">
               <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-full opacity-60 blur-xl animate-pulse" style={{ backgroundColor: accentColor }} />
                  <div className="relative px-4 py-2 md:px-6 md:py-3 rounded-full border border-white/20 bg-slate-950/90 backdrop-blur-2xl flex items-center gap-2 md:gap-3 shadow-2xl">
                    <Sparkles className="w-3 h-3 md:w-4 md:h-4 animate-spin-slow" style={{ color: accentColor }} />
                    <span className="text-[8px] md:text-[10px] font-black tracking-[0.3em] md:tracking-[0.5em] text-white uppercase whitespace-nowrap">
                      Featured Selection
                    </span>
                  </div>
               </div>

               <h2 className="text-2xl sm:text-3xl md:text-5xl lg:text-7xl font-black text-white tracking-tighter uppercase italic text-center md:text-left drop-shadow-2xl break-words w-full md:w-auto">
                  {featuredItem.title || featuredItem.name}
               </h2>
               <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent hidden xl:block" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 items-start relative z-10">
              
              <div className="lg:col-span-4 flex flex-col items-center lg:items-start relative order-2 lg:order-1">
                <div className="w-full max-w-[280px] md:max-w-[340px] transition-all duration-700 hover:scale-[1.04] cursor-pointer relative z-10 mx-auto lg:mx-0">
                   {isProduct ? (
                      <AisleProductCard product={featuredItem} accentColor={accentColor} />
                    ) : featuredItem.isCollection ? (
                      <div className="bg-[#111] p-6 rounded-2xl border border-white/10 text-center shadow-lg aspect-square flex flex-col items-center justify-center">
                        <Package className="w-12 h-12 mb-4 text-muted-foreground" />
                        <h3 className="text-xl font-bold text-white">{featuredItem.title}</h3>
                        <p className="text-muted-foreground text-sm mt-2">Curated Collection</p>
                      </div>
                    ) : (
                      <AisleIPAssetCard item={featuredItem} accentColor={accentColor} />
                    )}
                </div>
              </div>

              <div className="lg:col-span-8 flex flex-col space-y-6 md:space-y-10 order-1 lg:order-2">
                <div className="relative group/media overflow-hidden rounded-[1.5rem] md:rounded-[3.5rem] border border-white/10 shadow-2xl bg-black">
                  <div className="aspect-video relative z-10 overflow-hidden">
                    <img 
                      src={getDisplayImage(featuredItem)} 
                      className="w-full h-full object-cover transition duration-[1.5s] group-hover/media:scale-105"
                      alt="Featured Showcase"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />
                  </div>
                </div>

                <div className="flex flex-col space-y-6 md:space-y-8 px-2 md:px-4">
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 md:gap-4">
                    {/*<div className="px-3 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-2 md:gap-3">
                        {isProduct ? <ShoppingBag className="w-3 h-3 md:w-4 md:h-4 text-emerald-400" /> : <Zap className="w-3 h-3 md:w-4 md:h-4 text-amber-400" />}
                        <span className="text-[9px] md:text-[11px] font-black text-white uppercase tracking-wider md:tracking-widest">
                          {formatStat(featuredItem.salesCount)} {isProduct ? 'Units' : 'Mints'}
                        </span>
                    </div>*/}
                    <div className="px-3 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-2 md:gap-3">
                        <div className="relative">
                          <div className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-red-500 rounded-full animate-ping" />
                          <Eye className="w-3 h-3 md:w-4 md:h-4 text-sky-400" />
                        </div>
                        <span className="text-[9px] md:text-[11px] font-black text-white uppercase tracking-wider md:tracking-widest">
                          {formatStat(liveViewCount)} Views
                        </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 md:mt-16 pt-8 md:pt-12 border-t border-white/10 relative">
              <div className="absolute -top-4 md:-top-5 left-1/2 -translate-x-1/2 px-4 md:px-6">
                 <Quote className="w-8 h-8 md:w-10 md:h-10 text-white/10" />
              </div>
              <div className="max-w-5xl mx-auto text-center">
                <p className="text-slate-300 text-base md:text-2xl leading-relaxed font-light italic px-2">
                  &ldquo;{featuredItem.description || "Experience the pinnacle of creator-driven merchandise."}&rdquo;
                </p>
              </div>
            </div>

          </div>
        </section>
      )}

      {/* MODULAR BUILDER SECTIONS */}
      <div className="space-y-16 md:space-y-32 pb-20 md:pb-32 px-4 md:px-8">
        {layoutSections.length > 0 ? (
          layoutSections.map((section) => {
            let populatedItems = [];
            
            (section.items || []).forEach(savedItem => {
              if (savedItem.itemType === 'products' || savedItem.itemType === 'community') {
                const p = products.find(p => safeId(p) === savedItem.id);
                if (p) populatedItems.push(p);
              } 
              else if (savedItem.itemType === 'ip') {
                const a = ipAssets.find(a => safeId(a) === savedItem.id);
                if (a) populatedItems.push(a);
              } 
              else if (savedItem.itemType === 'collections') {
                const col = settings.collections?.find(c => safeId(c) === savedItem.id);
                if (col && col.productIds) {
                  col.productIds.forEach(pid => {
                    const p = products.find(p => safeId(p) === String(pid));
                    if (p) populatedItems.push(p);
                  });
                }
              }
            });

            populatedItems = Array.from(new Set(populatedItems));

            if (populatedItems.length === 0) return null;

            return (
              <section key={section.id} className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="flex items-center gap-4 md:gap-12 mb-8 md:mb-16">
                   <h3 className="text-2xl md:text-5xl font-black text-white tracking-tighter" style={{ borderLeft: `8px solid ${accentColor}`, paddingLeft: '1rem' }}>
                    {section.title}
                   </h3>
                   <div className="h-px flex-1 bg-gradient-to-r from-slate-800 via-slate-900 to-transparent" />
                </div>
                
                <div className="grid gap-6 md:gap-12 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {populatedItems.map((item, idx) => {
                    const isIPAsset = item.licensingFee !== undefined || item.vaultType !== undefined;
                    return isIPAsset 
                      ? <AisleIPAssetCard key={`${safeId(item)}-${idx}`} item={item} accentColor={accentColor} />
                      : <AisleProductCard key={`${safeId(item)}-${idx}`} product={item} accentColor={accentColor} />;
                  })}
                </div>
              </section>
            );
          })
        ) : (
          <div className="py-20 md:py-60 flex flex-col items-center justify-center opacity-10">
            <Package className="w-12 h-12 md:w-20 md:h-20 mb-4 stroke-1" />
            <p className="font-bold tracking-[0.5em] uppercase text-[8px] md:text-[10px]">Awaiting Catalog Data</p>
          </div>
        )}
      </div>
    </div>
  );
}