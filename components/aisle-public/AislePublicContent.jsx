'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// FIX: Add Button to the imports
import { Button } from '@/components/ui/button'; 
import { Package, ShieldCheck, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function AislePublicContent({ products = [], ipAssets = [], settings = {}, creator = {} }) {
  const accentColor = settings.accentColor || '#3b82f6';
  const productsPerRow = settings.productsPerRow || 3;
  
  // Responsive grid logic
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4'
  }[productsPerRow] || 'grid-cols-2 md:grid-cols-3';

  return (
    <div className="mt-8">
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
          {/* Render Collections First */}
          {creator.collections?.length > 0 && (
            <div className="space-y-12 mb-12">
              {creator.collections.map((col) => {
                const collectionProducts = products.filter(p => 
                  col.productIds?.map(id => id.toString()).includes(p.id?.toString())
                );
                
                if (collectionProducts.length === 0) return null;

                return (
                  <div key={col.id || col._id} className="space-y-6">
                    <div className="border-l-4 border-primary pl-4" style={{ borderColor: accentColor }}>
                      <h2 className="text-2xl font-bold text-white">{col.name}</h2>
                      {col.description && <p className="text-slate-400 text-sm">{col.description}</p>}
                    </div>
                    <div className={cn("grid gap-6", gridCols)}>
                      {collectionProducts.map((item) => (
                        <PublicItemCard key={item.id} item={item} type="product" accentColor={accentColor} />
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
  const image = item.thumbnailUrl || item.imageUrl || '/placeholder.png';
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