'use client';

import React from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button'; 
import { Package, ShieldCheck, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const getDisplayImage = (item) => {
    if (!item) return '/placeholder.png';
    if (item.mockupUrl && item.mockupUrl !== '') return item.mockupUrl;
    if (item.mockups && item.mockups.length > 0) return item.mockups[item.mockups.length - 1];
    if (item.imageUrl && item.imageUrl !== '') return item.imageUrl;
    if (item.thumbnailUrl && item.thumbnailUrl !== '') return item.thumbnailUrl;
    if (item.images && item.images.length > 0) return item.images[0];
    return '/placeholder.png';
  };

export default function AislePublicContent({ products = [], ipAssets = [], settings = {}, creator = {} }) {
  const accentColor = settings.accentColor || '#3b82f6';
  const productsPerRow = settings.productsPerRow || 3;
  
  // Responsive grid logic
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4'
  }[productsPerRow] || 'grid-cols-2 md:grid-cols-3';

  // --- DATA LOOKUP FOR SPOTLIGHT ---
  const spotlight = settings?.featuredSpotlight || settings?.aisleSettings?.featuredSpotlight;
  
  // Make sure we are strictly comparing strings
  const featuredItem = spotlight?.enabled ? (
    spotlight.type === 'product' 
      ? products.find(p => (p.id?.toString() || p._id?.toString()) === spotlight.itemId?.toString())
      : ipAssets.find(a => (a.id?.toString() || a._id?.toString()) === spotlight.itemId?.toString())
  ) : null;

  // Add this temporary console log so we can see what's happening
  console.log("SPOTLIGHT DATA:", spotlight);
  console.log("FOUND FEATURED ITEM:", featuredItem);

  return (
    <div className="mt-8">
      {/* --- FEATURED SPOTLIGHT SECTION --- */}
      {featuredItem && (
        <div className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-px flex-1 bg-slate-800"></div>
            <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">Featured Spotlight</span>
            <div className="h-px flex-1 bg-slate-800"></div>
          </div>
          
          <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 group">
            <div className="grid md:grid-cols-2 gap-0">
              <div className="aspect-square md:aspect-video relative overflow-hidden">
                <img 
                  src={featuredItem.imageUrl || featuredItem.thumbnailUrl} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                  alt="Featured"
                />
              </div>
              <div className="p-8 md:p-12 flex flex-col justify-center">
                <Badge className="w-fit mb-4" style={{ backgroundColor: accentColor }}>
                  {spotlight.type === 'product' ? 'FEATURED PRODUCT' : 'FEATURED IP'}
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  {featuredItem.title || featuredItem.name}
                </h2>
                <p className="text-slate-400 mb-8 line-clamp-3 text-lg">
                  {featuredItem.description}
                </p>
                {/* Find the existing button and replace it with this: */}
                <Button 
                  asChild
                  size="lg" 
                  className="w-full md:w-fit font-bold px-8 py-6 text-lg text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: accentColor }}
                >
                  <Link 
                    href={spotlight.type === 'product' 
                      ? `/products/${featuredItem.id || featuredItem._id}` 
                      : `/ip/${featuredItem.id || featuredItem._id}`
                    }
                  >
                    View Featured Item
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Tabs defaultValue="all" className="w-full">
        <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
          <TabsList className="bg-transparent gap-8 h-auto p-0">
            <TabsTrigger 
              value="all" 
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-4 text-slate-400 data-[state=active]:text-white font-semibold transition-none border-primary"
              style={{ '--primary': accentColor }}
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              All Items
            </TabsTrigger>
            
            <TabsTrigger 
              value="products" 
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-4 text-slate-400 data-[state=active]:text-white font-semibold transition-none border-primary"
              style={{ '--primary': accentColor }}
            >
              <Package className="w-4 h-4 mr-2" />
              Products ({products.length})
            </TabsTrigger>

            <TabsTrigger 
              value="ip" 
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-4 text-slate-400 data-[state=active]:text-white font-semibold transition-none border-primary"
              style={{ '--primary': accentColor }}
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              IP Assets ({ipAssets.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* --- ALL ITEMS TAB --- */}
        <TabsContent value="all" className="mt-0 outline-none">
          
          {/* FIX: Look for collections in settings.collections instead of creator.collections */}
          {(settings.collections || []).length > 0 && (
            <div className="space-y-12 mb-12">
              {settings.collections.map((col) => {
                
                // FIX: Match col.itemIds with the actual product IDs
                const collectionProducts = products.filter(p => {
                  const pId = (p.id || p._id)?.toString();
                  return col.itemIds?.some(id => id.toString() === pId);
                });
                
                if (collectionProducts.length === 0) return null;

                return (
                  <div key={col.id || col._id} className="space-y-6">
                    <div className="border-l-4 border-primary pl-4" style={{ borderColor: accentColor }}>
                      <h2 className="text-2xl font-bold text-white">{col.name}</h2>
                      {col.description && <p className="text-slate-400 text-sm">{col.description}</p>}
                    </div>
                    <div className={cn("grid gap-6", gridCols)}>
                      {collectionProducts.map((item) => (
                        <PublicItemCard 
                          key={(item.id || item._id).toString()} 
                          item={item} 
                          type="product" 
                          accentColor={accentColor} 
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Standard "All Items" Grid */}
          <div className="border-t border-slate-800 pt-8 mt-8">
            <h3 className="text-lg font-semibold text-slate-400 mb-6 px-2">All Assets</h3>
            <div className={cn("grid gap-6", gridCols)}>
              {products.map((item) => (
                <PublicItemCard key={item.id || item._id} item={item} type="product" accentColor={accentColor} />
              ))}
              {ipAssets.map((item) => (
                <PublicItemCard key={item.id || item._id} item={item} type="ip" accentColor={accentColor} />
              ))}
            </div>
          </div>
          
          {products.length === 0 && ipAssets.length === 0 && <EmptyState />}
        </TabsContent>

        {/* --- PRODUCTS TAB --- */}
        <TabsContent value="products" className="mt-0 outline-none">
          <div className={cn("grid gap-6", gridCols)}>
            {products.map((item) => (
              <PublicItemCard key={item.id || item._id} item={item} type="product" accentColor={accentColor} />
            ))}
          </div>
        </TabsContent>

        {/* --- IP ASSETS TAB --- */}
        <TabsContent value="ip" className="mt-0 outline-none">
          <div className={cn("grid gap-6", gridCols)}>
            {ipAssets.map((item) => (
              <PublicItemCard key={item.id || item._id} item={item} type="ip" accentColor={accentColor} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PublicItemCard({ item, type, accentColor }) {
  const title = item.title || item.name || 'Untitled';
  const image = getDisplayImage(item);
  const price = item.price || item.licensingFee || '0.00';

  return (
    <div className="group bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all">
      <div className="aspect-square relative overflow-hidden bg-slate-800">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
        />
        <Badge className="absolute top-3 right-3 border-none" style={{ backgroundColor: accentColor }}>
          {type === 'ip' ? 'IP ASSET' : 'PRODUCT'}
        </Badge>
      </div>
      
      <div className="p-4">
        <h3 className="font-bold text-white truncate mb-1">{title}</h3>
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold" style={{ color: accentColor }}>
            ${typeof price === 'object' ? price.$numberDecimal || price.toString() : price}
          </span>
          <Button variant="link" className="p-0 h-auto text-xs text-slate-400 hover:text-white">
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-32 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
      <Package className="w-12 h-12 mx-auto mb-4 text-slate-700" />
      <h3 className="text-xl font-medium text-slate-400">No items found</h3>
      <p className="text-slate-500 text-sm mt-1">This creator hasn't listed any items yet.</p>
    </div>
  );
}