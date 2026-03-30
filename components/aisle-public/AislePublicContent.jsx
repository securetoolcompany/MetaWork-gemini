'use client';

import React from 'react';
import { 
  Package, 
  Sparkles, 
  Quote, 
  Eye, 
  Share2, 
  ShoppingBag, 
  Zap 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProductDialog } from '@/app/providers/ProductDialogProvider'; 

import AisleProductCard from './AisleProductCard';
import AisleIPAssetCard from './AisleIPAssetCard';

const safeId = (item) => (item?.id || item?._id)?.toString() || '';

export default function AislePublicContent({ products = [], ipAssets = [], settings = {}, creator = {} }) {
  const { openDialog } = useProductDialog();
  const accentColor = settings.accentColor || '#3b82f6';
  const layoutSections = settings.sections || [];
  
  // --- FEATURED SPOTLIGHT DATA ---
  const spotlight = settings?.featuredSpotlight;
  const isProduct = spotlight?.type === 'product';
  const mediaType = spotlight?.mediaType || 'video';

  const featuredItem = spotlight?.enabled ? (
    isProduct 
      ? products.find(p => safeId(p) === spotlight.itemId?.toString())
      : ipAssets.find(a => safeId(a) === spotlight.itemId?.toString())
  ) : null;

  const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const videoId = getYoutubeId(spotlight?.videoUrl);

  const formatStat = (num) => {
    if (!num) return '0';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  return (
    <div className="mt-8 space-y-32">
      {/* --- CINEMATIC FEATURED HERO --- */}
      {featuredItem && (
        <section className="relative w-full max-w-[1600px] mx-auto group">
          
          {/* Dynamic Background Aura */}
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full opacity-[0.04] blur-[140px] pointer-events-none rounded-full"
            style={{ backgroundColor: accentColor }}
          />

          <div className="relative z-10 p-10 md:p-16 rounded-[4rem] bg-slate-950/40 border border-white/5 shadow-2xl backdrop-blur-md">
            
            {/* 1) THE HEADER BEAM: BADGE + TITLE (Sits over both columns) */}
            <div className="flex flex-row items-center gap-8 w-full mb-14 relative">
               {/* NATURAL PULSING BADGE: No overflow-hidden on parents to allow glow to bleed */}
               <div className="relative shrink-0">
                  <div 
                    className="absolute inset-0 rounded-full opacity-60 blur-2xl transition duration-1000 animate-pulse"
                    style={{ backgroundColor: accentColor }}
                  />
                  <div className="relative px-6 py-3 rounded-full border border-white/20 bg-slate-950/90 backdrop-blur-2xl flex items-center gap-3 shadow-2xl">
                    <Sparkles className="w-4 h-4 animate-spin-slow" style={{ color: accentColor }} />
                    <span className="text-[10px] font-black tracking-[0.5em] text-white uppercase whitespace-nowrap">
                      Featured Selection
                    </span>
                  </div>
               </div>

               {/* SINGLE LINE TITLE: Responsive scaling */}
               <h2 className="text-3xl md:text-5xl lg:text-7xl font-black text-white tracking-tighter uppercase italic whitespace-nowrap drop-shadow-2xl">
                  {featuredItem.title || featuredItem.name}
               </h2>

               <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent hidden xl:block" />
            </div>

            {/* 2) MAIN ASSET GRID: ALIGNED TOPS */}
            <div className="grid lg:grid-cols-12 gap-12 items-start relative z-10">
              
              {/* LEFT COLUMN: INTERACTIVE CARD (4/12) */}
              <div className="lg:col-span-4 flex flex-col items-center lg:items-start relative">
                <div className="w-full max-w-[340px] transition-all duration-700 hover:scale-[1.04] hover:-rotate-1 cursor-pointer relative z-10">
                   {isProduct ? (
                      <AisleProductCard product={featuredItem} accentColor={accentColor} />
                    ) : (
                      <AisleIPAssetCard asset={featuredItem} accentColor={accentColor} />
                    )}
                </div>
              </div>

              {/* RIGHT COLUMN: MEDIA + DATA STACK (8/12) */}
              <div className="lg:col-span-8 flex flex-col space-y-10">
                
                {/* Visual Stage */}
                <div className="relative group/media overflow-hidden rounded-[3.5rem] border border-white/10 shadow-2xl bg-black">
                  {mediaType === 'video' && videoId ? (
                    <div className="aspect-video relative z-10">
                      <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${videoId}?rel=0&showinfo=0&modestbranding=1`}
                        title="Presentation"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="aspect-video relative z-10 overflow-hidden">
                      <img 
                        src={featuredItem.mockupUrl || featuredItem.imageUrl || '/placeholder.png'} 
                        className="w-full h-full object-cover transition duration-[1.5s] group-hover/media:scale-105"
                        alt="Product Showcase"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />
                    </div>
                  )}
                </div>

                {/* THE BRIDGE: PUNCHLINE & STATS */}
                <div className="flex flex-col space-y-8 px-4">
                  <p className="text-3xl md:text-4xl font-medium tracking-tight text-slate-400 italic">
                    {spotlight.punchline || "Performance meets institutional design."}
                  </p>

                  <div className="flex flex-wrap gap-4">
                    {/* Acquisition Stat */}
                    <div className="px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
                        {isProduct ? <ShoppingBag className="w-4 h-4 text-emerald-400" /> : <Zap className="w-4 h-4 text-amber-400" />}
                        <span className="text-[11px] font-black text-white uppercase tracking-widest">
                          {formatStat(featuredItem.salesCount || 14)} {isProduct ? 'Units Sold' : 'Active Mints'}
                        </span>
                    </div>

                    {/* View Stat with Pulse */}
                    <div className="px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
                        <div className="relative">
                          <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                          <Eye className="w-4 h-4 text-sky-400" />
                        </div>
                        <span className="text-[11px] font-black text-white uppercase tracking-widest">
                          {formatStat(featuredItem.viewCount || 1240)} Global Views
                        </span>
                    </div>

                    {/* Community Engagement Stat */}
                    <div className="px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
                        <Share2 className="w-4 h-4 text-purple-400" />
                        <span className="text-[11px] font-black text-white uppercase tracking-widest">
                          {formatStat(featuredItem.shareCount || 42)} Community Shares
                        </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3) BASEMENT: FULL-WIDTH DESCRIPTION */}
            <div className="mt-16 pt-12 border-t border-white/10 relative">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-6">
                 <Quote className="w-10 h-10 text-white/5" />
              </div>
              <div className="max-w-5xl mx-auto text-center">
                <p className="text-slate-300 text-xl md:text-2xl leading-relaxed font-light italic">
                  &ldquo;{spotlight.customDescription || featuredItem.description}&rdquo;
                </p>
                <div className="mt-12 flex justify-center">
                   <div className="h-1.5 w-32 rounded-full opacity-20" style={{ backgroundColor: accentColor }} />
                </div>
              </div>
            </div>

          </div>
        </section>
      )}

      {/* --- DYNAMIC CATALOG SECTIONS --- */}
      <div className="space-y-32 pb-32 px-4 md:px-8">
        {layoutSections.length > 0 ? (
          layoutSections.filter(s => s.enabled !== false).map((section) => {
            let sectionItems = [];
            
            if (section.displayType === 'all-products') {
              sectionItems = products;
            } else if (section.displayType === 'all-ip-assets') {
              sectionItems = ipAssets;
            } else if (section.displayType === 'collection') {
              const col = settings.collections?.find(c => safeId(c) === String(section.collectionId));
              if (col) {
                const itemIds = (col.itemIds || []).map(id => String(id));
                sectionItems = [...products, ...ipAssets].filter(item => itemIds.includes(safeId(item)));
              }
            }

            if (sectionItems.length === 0) return null;

            return (
              <section key={section.id} className="animate-in fade-in slide-in-from-bottom-12 duration-1000">
                <div className="flex items-center gap-12 mb-16">
                   <h3 className="text-4xl lg:text-5xl font-black text-white uppercase tracking-tighter" style={{ borderLeft: `12px solid ${accentColor}`, paddingLeft: '2rem' }}>
                    {section.title}
                   </h3>
                   <div className="h-px flex-1 bg-gradient-to-r from-slate-800 via-slate-900 to-transparent" />
                </div>
                <div className="grid gap-12 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {sectionItems.map(item => (
                    item.licensingFee !== undefined 
                      ? <AisleIPAssetCard key={safeId(item)} asset={item} accentColor={accentColor} />
                      : <AisleProductCard key={safeId(item)} product={item} accentColor={accentColor} />
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          <div className="py-60 flex flex-col items-center justify-center opacity-10">
            <Package className="w-20 h-20 mb-4 stroke-1" />
            <p className="font-bold tracking-[0.5em] uppercase text-[10px]">Awaiting Catalog Data</p>
          </div>
        )}
      </div>
    </div>
  );
}