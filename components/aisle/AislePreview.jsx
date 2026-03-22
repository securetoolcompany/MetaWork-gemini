'use client';

import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Twitter, Instagram, Globe, DollarSign, MessageCircle, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const THEME_COLORS = {
  'dark-professional': { bg: '#0f172a', card: '#1e293b', text: '#ffffff', muted: '#64748b' },
  'light-clean': { bg: '#ffffff', card: '#f8fafc', text: '#1e293b', muted: '#64748b' },
  'bold-vibrant': { bg: '#1a1a2e', card: '#16213e', text: '#ffffff', muted: '#9ca3af' },
  'monochrome': { bg: '#000000', card: '#1a1a1a', text: '#ffffff', muted: '#737373' }
};

export default function AislePreview({ settings, products = [], zoom = 75, fullscreen, onCloseFullscreen }) {
  const aisleSettings = settings?.aisleSettings || {};
  const theme = THEME_COLORS[aisleSettings.theme] || THEME_COLORS['dark-professional'];
  const accentColor = aisleSettings.accentColor || '#3b82f6';
  
  // Use passed products
  const allProducts = products;
  const collections = settings?.collections || [];

  const PreviewContent = () => {
    let showAsCollections = collections.length > 0;

    return (
      <div 
        className="rounded-lg overflow-hidden shadow-2xl border border-border"
        style={{ 
          transform: fullscreen ? 'scale(1)' : `scale(${zoom / 100})`,
          transformOrigin: 'top center',
          width: fullscreen ? '100%' : '400px',
          backgroundColor: theme.bg,
          color: theme.text,
          minHeight: fullscreen ? 'auto' : '600px',
          maxHeight: fullscreen ? 'none' : '700px',
          overflowY: 'auto'
        }}
      >
        {/* Header Styles */}
        {aisleSettings.headerStyle === 'full-banner' && (
          <div className="relative">
            <div className="h-32 bg-muted relative overflow-hidden">
                {settings?.bannerUrl ? (
                  <img src={settings.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-gray-800 to-gray-700" />
                )}
                <div className="absolute inset-0 bg-black/20" />
            </div>
            <div className="px-4 -mt-10 pb-4 relative z-10 flex items-end gap-3">
               <div className="w-20 h-20 rounded-full border-4 overflow-hidden" style={{ borderColor: theme.bg, backgroundColor: theme.card }}>
                  {settings?.avatarUrl ? (
                    <img src={settings.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground">
                      {settings?.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
               </div>
               <div className="pb-1 flex-1">
                  <h2 className="text-lg font-bold" style={{ color: theme.text }}>{settings?.username || 'Your Name'}</h2>
                  <p className="text-xs" style={{ color: theme.muted }}>{settings?.bio || 'Welcome to my aisle'}</p>
               </div>
            </div>
          </div>
        )}

        {aisleSettings.headerStyle === 'compact' && (
           <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: theme.card }}>
              <div className="w-12 h-12 rounded-full border overflow-hidden" style={{ borderColor: theme.card }}>
                  {settings?.avatarUrl ? (
                    <img src={settings.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center text-lg font-bold">
                      {settings?.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
              </div>
              <div>
                  <h2 className="font-bold text-sm" style={{ color: theme.text }}>{settings?.username || 'Your Name'}</h2>
                  <p className="text-[10px]" style={{ color: theme.muted }}>{settings?.bio || 'Welcome to my aisle'}</p>
              </div>
           </div>
        )}

        {aisleSettings.headerStyle === 'minimal' && (
           <div className="p-4 border-b flex items-center justify-center" style={{ borderColor: theme.card }}>
              <h2 className="font-bold text-lg" style={{ color: theme.text }}>{settings?.username || 'Your Name'}</h2>
           </div>
        )}

        {/* Content */}
        <div className="flex">
          <div className={cn("flex-1 p-4 space-y-4")}>
            {showAsCollections ? (
              collections.map((collection) => {
                const collectionProducts = allProducts.filter(p => collection.productIds?.includes(p.id));
                const gridCols = collection.columns === 2 ? 'grid-cols-2' : collection.columns === 4 ? 'grid-cols-4' : 'grid-cols-3';
                
                return (
                  <div key={collection.id}>
                    {collection.showHeader && (
                      <div className="mb-3">
                        <h3 className="text-sm font-semibold" style={{ color: theme.text }}>{collection.name}</h3>
                        {collection.description && (
                          <p className="text-xs mt-0.5" style={{ color: theme.muted }}>{collection.description}</p>
                        )}
                      </div>
                    )}
                    {collectionProducts.length > 0 ? (
                      <div className={cn("grid gap-2", gridCols)}>
                        {collectionProducts.map((product) => (
                           <ProductCard 
                                key={product.id}
                                product={product} 
                                theme={theme} 
                                accentColor={accentColor}
                                cardStyle={aisleSettings.cardStyle}
                                showSalesCounter={aisleSettings.showSalesCounter}
                                creatorName={settings?.username}
                              />
                        ))}
                      </div>
                    ) : (
                      <div 
                        className="border-2 border-dashed rounded-lg p-6 text-center text-xs"
                        style={{ borderColor: theme.muted + '40', color: theme.muted }}
                      >
                        No products
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: theme.text }}>All Products</h3>
                {allProducts.length === 0 ? (
                   <div className="text-center py-10 text-xs opacity-50" style={{color: theme.muted}}>No products found</div>
                ) : (
                  <div className={cn(
                    "grid gap-2",
                    aisleSettings.productsPerRow === 2 ? 'grid-cols-2' : 
                    aisleSettings.productsPerRow === 4 ? 'grid-cols-4' : 'grid-cols-3'
                  )}>
                    {allProducts.map((product) => (
                       <ProductCard 
                          key={product.id}
                          product={product} 
                          theme={theme} 
                          accentColor={accentColor}
                          cardStyle={aisleSettings.cardStyle}
                          showSalesCounter={aisleSettings.showSalesCounter}
                          creatorName={settings?.username}
                        />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (fullscreen) {
    return (
      <Dialog open={fullscreen} onOpenChange={() => onCloseFullscreen && onCloseFullscreen()}>
        <DialogContent className="max-w-6xl h-[90vh] overflow-auto p-0 border-none bg-transparent shadow-none">
          <Button className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white border-0" size="icon" onClick={onCloseFullscreen}>
            <X className="h-4 w-4" />
          </Button>
          <div className="p-8 flex items-center justify-center h-full">
            <PreviewContent />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex justify-center overflow-auto">
      <PreviewContent />
    </div>
  );
}

// ------------------------------------------------------------------
// RESTORED PRODUCT CARD LOGIC
// ------------------------------------------------------------------
function ProductCard({ product, theme, accentColor, cardStyle, showSalesCounter, creatorName }) {
  return (
    <div className="rounded-md overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col" style={{ backgroundColor: theme.card }}>
      
      {/* 1. Image Area */}
      <div className="relative aspect-square bg-black/5">
        <img 
          src={product.imageUrl || product.thumbnailUrl || '/placeholder.png'} 
          alt={product.name} 
          className="w-full h-full object-cover" 
        />
        {/* 'Live' Badge for Standard/Detailed views */}
        {cardStyle !== 'minimal' && product.status === 'live' && (
           <Badge className="absolute top-1 right-1 text-[8px] px-1 py-0 h-4 border-0" style={{ backgroundColor: accentColor }}>
             NEW
           </Badge>
        )}
      </div>

      {/* 2. Info Area */}
      <div className="p-2 flex flex-col flex-1">
        {/* Title & Price (Always Visible) */}
        <div className="flex justify-between items-start gap-1">
            <div className="text-xs font-medium truncate flex-1" style={{ color: theme.text }}>
                {product.name}
            </div>
            <div className="text-xs font-bold" style={{ color: accentColor }}>
                ${product.price}
            </div>
        </div>
        
        {/* Creator Name (Standard & Detailed) */}
        {(cardStyle === 'standard' || cardStyle === 'detailed') && (
           <div className="text-[10px] mt-0.5 opacity-70 truncate" style={{ color: theme.muted }}>
             by {creatorName || 'Artist'}
           </div>
        )}

        {/* Description (Detailed Only) */}
        {cardStyle === 'detailed' && (
          <div className="mt-1.5 text-[9px] line-clamp-2 opacity-80" style={{ color: theme.muted }}>
            {product.description || "No description available for this item."}
          </div>
        )}
        
        {/* Sales Counter (If Enabled & Not Minimal) */}
        {showSalesCounter && cardStyle !== 'minimal' && (
           <div className="mt-auto pt-2 flex items-center gap-1 text-[9px] opacity-60" style={{ color: theme.muted }}>
             <span className="w-1.5 h-1.5 rounded-full bg-green-500/50 inline-block" />
             {product.salesCount || 0} sold
           </div>
        )}
      </div>
    </div>
  );
}
