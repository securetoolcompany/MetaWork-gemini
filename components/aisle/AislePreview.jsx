'use client';

import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProductDialog } from '@/app/providers/ProductDialogProvider';

const THEME_COLORS = {
  'dark-professional': { bg: '#0f172a', card: '#1e293b', text: '#ffffff', muted: '#64748b' },
  'light-clean': { bg: '#ffffff', card: '#f8fafc', text: '#1e293b', muted: '#64748b' },
  'bold-vibrant': { bg: '#1a1a2e', card: '#16213e', text: '#ffffff', muted: '#9ca3af' },
  'monochrome': { bg: '#000000', card: '#1a1a1a', text: '#ffffff', muted: '#737373' }
};

export default function AislePreview({ settings, products = [], zoom = 75, fullscreen, onCloseFullscreen }) {
  const { openProduct } = useProductDialog();
  const aisleSettings = settings?.aisleSettings || {};
  const theme = THEME_COLORS[aisleSettings.theme] || THEME_COLORS['dark-professional'];
  const accentColor = aisleSettings.accentColor || '#3b82f6';
  
  const allProducts = products;
  const collections = settings?.collections || [];
  
  // NEW: Grab sections from settings to power the drag-and-drop layout!
  const sections = aisleSettings.sections || [];

  const PreviewContent = () => {
    // If the user has built layout sections, use those. Otherwise fallback to collections/all products.
    const useDynamicSections = sections.length > 0;
    const showAsCollections = !useDynamicSections && collections.length > 0;

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
          <div className={cn("flex-1 p-4 space-y-6")}>
            
            {/* --- NEW: FEATURED SPOTLIGHT --- */}
            {aisleSettings.featuredSpotlight?.enabled && aisleSettings.featuredSpotlight?.itemId && (
              (() => {
                const featuredItem = allProducts.find(p => (p.id || p._id?.toString()) === aisleSettings.featuredSpotlight.itemId);
                if (!featuredItem) return null;
                
                const displayTitle = featuredItem.name || featuredItem.title || 'Untitled Item';
                
                return (
                  <div 
                    className="mb-8 rounded-xl overflow-hidden border border-border shadow-lg flex flex-col cursor-pointer hover:shadow-xl transition-all hover:scale-[1.01]" 
                    style={{ backgroundColor: theme.card }}
                    onClick={() => openProduct(featuredItem.id || featuredItem._id?.toString())}
                  >
                    <div className="w-full aspect-video md:aspect-[21/9] relative bg-black/5">
                      <img 
                        src={featuredItem.imageUrl || featuredItem.thumbnailUrl || '/placeholder.png'} 
                        alt={displayTitle} 
                        className="w-full h-full object-cover" 
                      />
                      <Badge className="absolute top-3 left-3 text-xs px-2 py-1" style={{ backgroundColor: accentColor, color: '#fff' }}>
                        Featured Spotlight
                      </Badge>
                    </div>
                    <div className="p-4 flex flex-col justify-center">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h2 className="text-xl font-bold mb-1" style={{ color: theme.text }}>{displayTitle}</h2>
                          {featuredItem.description && (
                            <p className="text-xs line-clamp-2 opacity-80" style={{ color: theme.muted }}>
                              {featuredItem.description}
                            </p>
                          )}
                        </div>
                        <div className="text-lg font-bold" style={{ color: accentColor }}>
                          ${featuredItem.price || '0.00'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
            
            {/* DYNAMIC SECTIONS LAYOUT (Matches your drag & drop!) */}
            {useDynamicSections ? (
              sections.filter(s => s.enabled).map((section) => {
                // Filter products based on section type
                let sectionProducts = [];
                if (section.displayType === 'all-products' || section.displayType === 'all-ip-assets') {
                  sectionProducts = allProducts;
                } else if (section.displayType === 'category') {
                  sectionProducts = allProducts.filter(p => {
                    const cats = Array.isArray(p.categories) ? p.categories : (p.category ? [p.category] : []);
                    return cats.includes(section.category);
                  });
                } else if (section.displayType === 'collection') {
                  const col = collections.find(c => c.id === section.collectionId);
                  if (col) {
                    sectionProducts = allProducts.filter(p => col.itemIds?.includes(p.id || p._id?.toString()));
                  }
                }

                // Apply itemsPerSection limit
                if (aisleSettings.itemsPerSection) {
                  sectionProducts = sectionProducts.slice(0, aisleSettings.itemsPerSection);
                }

                const gridCols = aisleSettings.productsPerRow === 2 ? 'grid-cols-2' : aisleSettings.productsPerRow === 4 ? 'grid-cols-4' : 'grid-cols-3';

                return (
                  <div key={section.id}>
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold" style={{ color: theme.text }}>{section.title}</h3>
                      {section.description && <p className="text-xs mt-0.5" style={{ color: theme.muted }}>{section.description}</p>}
                    </div>
                    {sectionProducts.length > 0 ? (
                      <div className={cn("grid gap-2", gridCols)}>
                        {sectionProducts.map((product) => (
                           <ProductCard 
                                key={product.id || product._id}
                                product={product} 
                                theme={theme} 
                                accentColor={accentColor}
                                cardStyle={aisleSettings.cardStyle}
                                showSalesCounter={aisleSettings.showSalesCounter}
                                creatorName={settings?.username}
                                openProduct={openProduct}
                              />
                        ))}
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-6 text-center text-xs" style={{ borderColor: theme.muted + '40', color: theme.muted }}>
                        No items in this section
                      </div>
                    )}
                  </div>
                );
              })
            ) : showAsCollections ? (
              /* LEGACY COLLECTIONS LAYOUT */
              collections.map((collection) => {
                // FIX 1 & 2: Use itemIds instead of productIds, and check both _id and id
                const collectionProducts = allProducts.filter(p => {
                    const pId = p.id || p._id?.toString();
                    return collection.itemIds?.includes(pId);
                });
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
                                key={product.id || product._id}
                                product={product} 
                                theme={theme} 
                                accentColor={accentColor}
                                cardStyle={aisleSettings.cardStyle}
                                showSalesCounter={aisleSettings.showSalesCounter}
                                creatorName={settings?.username}
                                openProduct={openProduct}
                              />
                        ))}
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-6 text-center text-xs" style={{ borderColor: theme.muted + '40', color: theme.muted }}>
                        No items in this collection
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              /* DEFAULT FALLBACK: ALL PRODUCTS */
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: theme.text }}>All Items</h3>
                {allProducts.length === 0 ? (
                   <div className="text-center py-10 text-xs opacity-50" style={{color: theme.muted}}>No items found</div>
                ) : (
                  <div className={cn(
                    "grid gap-2",
                    aisleSettings.productsPerRow === 2 ? 'grid-cols-2' : 
                    aisleSettings.productsPerRow === 4 ? 'grid-cols-4' : 'grid-cols-3'
                  )}>
                    {allProducts.map((product) => (
                       <ProductCard 
                          key={product.id || product._id}
                          product={product} 
                          theme={theme} 
                          accentColor={accentColor}
                          cardStyle={aisleSettings.cardStyle}
                          showSalesCounter={aisleSettings.showSalesCounter}
                          creatorName={settings?.username}
                          openProduct={openProduct}
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
function ProductCard({ product, theme, accentColor, cardStyle, showSalesCounter, creatorName, openProduct }) {
  // FIX 3: Catch both 'name' and 'title' (WordPress uses title)
  const displayTitle = product.name || product.title || 'Untitled Item';
  
  return (
    <div 
      className="rounded-md overflow-hidden hover:shadow-lg transition-transform hover:-translate-y-1 h-full flex flex-col cursor-pointer" 
      style={{ backgroundColor: theme.card }}
      onClick={() => openProduct && openProduct(product.id || product._id?.toString())}
    >
      
      {/* 1. Image Area */}
      <div className="relative aspect-square bg-black/5">
        <img 
          src={product.imageUrl || product.thumbnailUrl || '/placeholder.png'} 
          alt={displayTitle} 
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
                {displayTitle}
            </div>
            <div className="text-xs font-bold" style={{ color: accentColor }}>
                ${product.price || '0.00'}
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