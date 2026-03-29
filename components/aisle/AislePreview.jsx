'use client';

import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, MapPin, Mail, Phone, Globe, Share2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import AisleIPAssetCard from '@/components/aisle-public/AisleIPAssetCard';
import AisleProductCard from '@/components/aisle-public/AisleProductCard';

const THEME_COLORS = {
  'dark-professional': { bg: '#0f172a', card: '#1e293b', text: '#ffffff', muted: '#64748b' },
  'light-clean': { bg: '#ffffff', card: '#f8fafc', text: '#1e293b', muted: '#64748b' },
  'bold-vibrant': { bg: '#1a1a2e', card: '#16213e', text: '#ffffff', muted: '#9ca3af' },
  'monochrome': { bg: '#000000', card: '#1a1a1a', text: '#ffffff', muted: '#737373' }
};

export default function AislePreview({ settings, products = [], ipAssets =  [], zoom = 75, fullscreen, onCloseFullscreen }) {
  const aisleSettings = settings?.aisleSettings || {};
  const theme = THEME_COLORS[aisleSettings.theme] || THEME_COLORS['dark-professional'];
  const accentColor = aisleSettings.accentColor || '#3b82f6';
  
  const headerStyle = aisleSettings.headerStyle || 'full-banner';
  const cardStyle = aisleSettings.cardStyle || 'standard';
  
  const allProducts = products;
  const collections = settings?.collections || [];
  const sections = aisleSettings.sections?.length > 0 
  ? aisleSettings.sections 
  : (aisleSettings.collections || []);

  const PreviewContent = () => {
    const useDynamicSections = sections.length > 0;
    const showAsCollections = !useDynamicSections && collections.length > 0;
    const locationStr = [aisleSettings.location, aisleSettings.country].filter(Boolean).join(', ');

    // 1. Reusable contact badges
    const ContactBadges = ({ justify = 'start' }) => {
      if (!locationStr && !aisleSettings.email && !aisleSettings.phone && !aisleSettings.website) return null;
      return (
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] opacity-90 justify-${justify}`} style={{ color: theme.text }}>
          {locationStr && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /><span>{locationStr}</span></div>}
          {aisleSettings.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" /><span>{aisleSettings.email}</span></div>}
          {aisleSettings.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /><span>{aisleSettings.phone}</span></div>}
          {aisleSettings.website && <div className="flex items-center gap-1"><Globe className="w-3 h-3" /><span>{aisleSettings.website.replace(/^https?:\/\//, '')}</span></div>}
        </div>
      );
    };

    // 2. Action Buttons - Show only in Preview Modal
    const MockActionButtons = ({ justify = 'start' }) => {
      if (zoom === 100 && !fullscreen) return null;
      return (
        <div className={`flex gap-2 mt-3 justify-${justify} w-full sm:w-auto`}>
          <Button size="sm" className="h-7 px-3 gap-1.5 border-none hover:opacity-90" style={{ backgroundColor: accentColor, color: '#ffffff' }}>
            <User className="w-3 h-3" />
            <span className="text-[10px] font-medium">Visit My Profile</span>
          </Button>
          <Button size="sm" className="h-7 px-3 gap-1.5 border-none hover:opacity-90" style={{ backgroundColor: accentColor, color: '#ffffff' }}>
            <Share2 className="w-3 h-3" />
            <span className="text-[10px] font-medium">Share My Aisle</span>
          </Button>
        </div>
      );
    };

    // 3. Grid Logic (Responsive for Live vs Preview)
    const responsiveGridClass = aisleSettings.productsPerRow === 2 
      ? 'grid-cols-2' 
      : aisleSettings.productsPerRow === 4 
        ? 'grid-cols-2 md:grid-cols-4' 
        : 'grid-cols-2 md:grid-cols-3';

    return (
      <div 
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          (fullscreen || zoom !== 100) ? "rounded-lg shadow-2xl border border-border" : "w-full"
        )}
        style={{ 
          transform: (fullscreen || zoom === 100) ? 'none' : `scale(${zoom / 100})`,
          transformOrigin: 'top center',
          width: (fullscreen || zoom === 100) ? '100%' : '400px',
          backgroundColor: theme.bg,
          color: theme.text,
          minHeight: (fullscreen || zoom === 100) ? 'auto' : '600px',
          maxHeight: (fullscreen || zoom === 100) ? 'none' : '700px',
          overflowY: (fullscreen || zoom === 100) ? 'visible' : 'auto'
        }}
      >
        {/* Header - Hides on the Live Page */}
        {(fullscreen || zoom !== 100) && (
          <div className="relative mb-4">
            {headerStyle === 'full-banner' && (
              <>
                <div className="h-32 bg-muted relative overflow-hidden">
                    {settings?.bannerUrl ? <img src={settings.bannerUrl} alt="Banner" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-r from-gray-800 to-gray-700" />}
                    <div className="absolute inset-0 bg-black/20" />
                </div>
                <div className="px-4 -mt-10 relative z-10 flex flex-col gap-2">
                   <div className="w-20 h-20 rounded-full border-4 overflow-hidden" style={{ borderColor: theme.bg, backgroundColor: theme.card }}>
                      {settings?.avatarUrl ? <img src={settings.avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl font-bold">{settings?.username?.charAt(0)}</div>}
                   </div>
                   <div>
                      <h2 className="text-lg font-bold truncate">{settings?.username || 'Your Name'}</h2>
                      {settings?.bio && <p className="text-xs opacity-80">{settings.bio}</p>}
                      <ContactBadges />
                      <MockActionButtons />
                   </div>
                </div>
              </>
            )}
            {/* ... other header style support would go here ... */}
          </div>
        )}

        <div className="flex">
          <div className="flex-1 p-4 space-y-8">
            {/* DYNAMIC SECTIONS */}
            {useDynamicSections ? (
              sections.filter(s => s.enabled).map((section) => {
                let items = [];
                if (section.displayType === 'all-products') items = allProducts;
                else if (section.displayType === 'all-ip-assets') items = ipAssets;
                // ... other section logic mapping ...
                
                return (
                  <div key={section.id}>
                    <h3 className="text-base font-bold mb-4" style={{ color: theme.text }}>{section.title}</h3>
                    <div className={cn("grid gap-4", responsiveGridClass)}>
                      {items.map(item => (
                        item.licensingFee !== undefined ? (
                          <AisleIPAssetCard 
                            key={item._id} 
                            asset={item} 
                            accentColor={accentColor} // Pass accent color
                            cardStyle={cardStyle}     // Pass card style
                          />
                        ) : (
                          <AisleProductCard 
                            key={item._id} 
                            product={item} 
                            accentColor={accentColor} // Pass accent color
                            cardStyle={cardStyle}     // Pass card style
                            showReviews={aisleSettings.showReviews}
                            showSalesCounter={aisleSettings.showSalesCounter}
                          />
                        )
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              /* DEFAULT FALLBACK: ALL ITEMS */
              <div>
                <h3 className="text-base font-bold mb-6" style={{ color: theme.text }}>All Items</h3>
                <div className={cn("grid gap-4", responsiveGridClass)}>
                  {allProducts.map(p => <AisleProductCard key={p._id} product={p} />)}
                  {ipAssets.map(a => <AisleIPAssetCard key={a._id} asset={a} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (fullscreen) {
    return (
      <Dialog open={fullscreen} onOpenChange={(isOpen) => !isOpen && onCloseFullscreen && onCloseFullscreen()}>
        <DialogContent className="max-w-6xl h-[90vh] overflow-auto p-0 border-none bg-transparent shadow-none">
          <DialogTitle className="sr-only">Aisle Preview</DialogTitle>
          <Button className="absolute top-4 right-4 z-[100] bg-black/50 text-white" size="icon" onClick={onCloseFullscreen}><X className="h-4 w-4" /></Button>
          <div className="p-8 flex items-center justify-center h-full relative"><PreviewContent /></div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex justify-center relative w-full">
      {zoom !== 100 && <div className="absolute inset-0 z-50 cursor-default" />}
      <PreviewContent />
    </div>
  );
}