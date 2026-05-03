'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Box, Layers, Cpu, ArrowRight, Loader2, Paintbrush, Search, ChevronLeft, ChevronRight, Database } from 'lucide-react';
import { BlankProductCard } from '@/components/product-creator/BlankProductCard';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Bring in the exact mapping logic from the creator page
const CATEGORY_ID_MAP: Record<string, string[]> = {
  Activewear: ['leggings', 'sports bra', 'athletic', 'joggers', 'active'],
  Fightwear: ['rash guard', 'bjj', 'mma', 'boxing', 'fighter', 'martial'],
  Formalwear: ['dress', 'blazer', 'formal', 'suit'],
  Headwear: ['hat', 'beanie', 'cap', 'snapback', 'headband', 'visor'],
  Patches: ['patch', 'patches', 'embroidered'],
  'Phone Cases': ['iphone', 'samsung', 'case', 'airpods', 'magsafe'],
  'Purses Tote Bags': ['bag', 'tote', 'purse', 'handbag'],
  Schoolwear: ['school uniform', 'varsity', 'college'],
  Streetwear: [
    'hoodie',
    'sweatshirt',
    'tee',
    't-shirt',
    'tank',
    'men',
    'women',
    'unisex',
    'longsleeve',
    'sweater',
  ],
  Swimwear: ['swimsuit', 'swim', 'bikini', 'trunks', 'boardshort'],
  Bedroom: ['pillow', 'blanket', 'duvet', 'sheet', 'slipper'],
  Kitchen: ['apron', 'mug', 'coaster', 'towel'],
  'Magnets Stickers': ['magnet', 'sticker'],
  Pets: ['pet', 'dog', 'cat'],
  'Posters Wall Art': ['poster', 'canvas', 'framed', 'flag', 'wall art'],
  Tech: ['mouse pad', 'laptop sleeve', 'ipad'],
  Backpacks: ['backpack', 'bag'],
  Study: ['notebook', 'stationery'],
};

const TOP_LEVEL_GROUPS: Record<string, string[]> = {
  'Apparel Accessories': [
    'Activewear',
    'Fightwear',
    'Formalwear',
    'Headwear',
    'Patches',
    'Phone Cases',
    'Purses Tote Bags',
    'Schoolwear',
    'Streetwear',
    'Swimwear',
  ],
  'Home Office': [
    'Bedroom',
    'Kitchen',
    'Magnets Stickers',
    'Pets',
    'Posters Wall Art',
    'Tech',
  ],
  'School University': ['Backpacks', 'Study'],
};

const ITEMS_PER_PAGE = 24;

export default function MetaManufacturingPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Products');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch the live production catalog
  useEffect(() => {
    async function fetchCatalog() {
      try {
        const res = await fetch('/api/blank-products');
        const data = await res.json();
        
        // Map products exactly like the creator page does to ensure tags exist
        const rawItems = data.products || [];
        const mappedProducts = rawItems.map((p: any) => ({
            ...p,
            name: p.catalogProductName || p.name || 'Unknown Product',
            thumbnailUrl: p.printfulImage || p.printfulThumbnail || p.thumbnailUrl || p.variants?.[0]?.files?.[0]?.previewUrl,
        }));

        setProducts(mappedProducts);
      } catch (err) {
        console.error("Failed to sync production line", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCatalog();
  }, []);

  // Filter Logic (Identical to Creator Page)
  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Search Query
    if (searchQuery) {
      list = list.filter((p) =>
        String(p.name).toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Category Filter
    if (selectedCategory !== 'All Products') {
      let targetKeywords: string[] = [];

      if (TOP_LEVEL_GROUPS[selectedCategory]) {
        // It's a top-level group (e.g., 'Apparel Accessories')
        TOP_LEVEL_GROUPS[selectedCategory].forEach((sub) => {
          targetKeywords = [...targetKeywords, ...(CATEGORY_ID_MAP[sub] || [])];
        });
      } else {
        // It's a specific sub-category
        targetKeywords = CATEGORY_ID_MAP[selectedCategory] || [];
      }

      list = list.filter((p) => {
        const nameLower = String(p.name).toLowerCase();
        const tags = (p.printfulCategories || []).map((t: string) => String(t).toLowerCase());
        
        // Custom search to catch Printful tags or direct string matches in the name
        return targetKeywords.some(
          (kw) =>
            tags.includes(kw.toLowerCase()) ||
            new RegExp(kw.toLowerCase(), 'i').test(nameLower)
        );
      });
    }

    return list;
  }, [products, selectedCategory, searchQuery]);

  // Pagination Math
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const currentProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery]);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-blue-500/30">
      
      {/* HERO SECTION */}
      <section className="px-8 pt-24 pb-16 max-w-[1920px] mx-auto w-full border-b border-zinc-800/50">
        <div className="flex items-center gap-3 mb-6">
          <Box className="h-6 w-6 text-blue-400" />
          <h2 className="text-sm font-mono text-blue-400 uppercase tracking-[0.3em]">Module // MetaManufacturing</h2>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1] mb-8">
          Your IP, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Physical Reality.</span>
        </h1>
        
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-6 text-xl text-zinc-400 font-light leading-relaxed">
            <p>
              MetaManufacturing bridges the gap between digital ideation and physical commerce. Through our global fulfillment network, your tokenized IP is injected into high-quality blank goods on-demand.
            </p>
            <p className="text-sm font-mono text-zinc-500 uppercase">
              // Zero Inventory // Global Fulfillment // Automated Royalties
            </p>
          </div>
          
          <div className="bg-zinc-900/50 border border-zinc-800 p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
                <Layers className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Standard Print-on-Demand</h4>
                <p className="text-xs text-zinc-500">Apparel, headwear, and lifestyle accessories ready for instant design injection.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded bg-indigo-500/10 flex items-center justify-center shrink-0">
                <Cpu className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h4 className="font-bold text-sm">3D & Custom Tooled</h4>
                <p className="text-xs text-zinc-500">Complex geometries and custom-designed products printed via 3D additive manufacturing.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THE BRIDGE CTA */}
      <section className="bg-blue-600 border-y border-blue-500">
        <div className="max-w-[1920px] mx-auto px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">Ready to see specs and start building?</h3>
            <p className="text-blue-200 text-sm mt-1">Access the Product Creator to view material stats and launch your designs.</p>
          </div>
          <Link href="/products/creator">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-zinc-100 font-bold tracking-tighter uppercase rounded-none px-8">
              Open Creator Terminal <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* VISUAL CATALOG SECTION */}
      <section className="bg-zinc-950 flex-1 flex flex-col">
        
        {/* EXACT SAME STICKY NAV FROM CREATOR PAGE */}
        <nav className="sticky top-0 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex flex-col md:flex-row items-center gap-4 md:gap-10 z-40 w-full">
            <div className="flex items-center gap-4 w-full md:w-auto">
            <Button
                variant={selectedCategory === 'All Products' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                setSelectedCategory('All Products');
                setSearchQuery('');
                }}
                className={cn(
                'font-bold h-10 px-6 rounded-full border-zinc-800 transition-all w-full md:w-auto',
                selectedCategory === 'All Products'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'text-zinc-300 bg-transparent hover:bg-zinc-900'
                )}
            >
                <Database className="mr-2 h-4 w-4" />
                All Blanks
            </Button>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full md:w-auto pb-2 md:pb-0">
            {Object.keys(TOP_LEVEL_GROUPS).map((group) => (
                <Button
                key={group}
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategory(group)}
                className={cn(
                    'text-xs font-bold h-10 px-4 rounded-full transition-colors whitespace-nowrap',
                    selectedCategory === group
                    ? 'bg-blue-900/40 text-blue-400'
                    : 'text-zinc-300 hover:bg-zinc-800'
                )}
                >
                {group}
                </Button>
            ))}
            </div>

            <div className="flex-1 w-full relative max-w-lg md:ml-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
                placeholder="Search catalog..."
                className="pl-11 h-10 bg-zinc-900 border-zinc-800 rounded-full text-white focus-visible:ring-blue-500 focus-visible:ring-offset-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            </div>
        </nav>

        {/* CATALOG GRID */}
        <div className="max-w-[1920px] mx-auto w-full p-6 md:p-12 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
              <span className="font-mono text-xs text-zinc-600 uppercase">Syncing_Production_Line...</span>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-zinc-100">
                  {selectedCategory}
                </h2>
                <span className="font-mono text-xs text-zinc-500">{filteredProducts.length} Assets Found</span>
              </div>

              {currentProducts.length === 0 ? (
                <div className="py-20 text-center font-mono text-sm text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
                  NO_ASSETS_MATCHING_CRITERIA
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6">
                    {currentProducts.map((product: any) => (
                      <BlankProductCard 
                        key={product.id} 
                        product={product}
                        hideButtons={true} 
                        onSelect={() => {}}
                        onInspect={() => {}}
                      />
                    ))}
                  </div>

                  {/* PAGINATION CONTROLS */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 pt-12">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                      </Button>
                      <span className="font-mono text-xs text-zinc-500">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      >
                        Next <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="px-8 py-24 border-t border-zinc-800/50 text-center bg-zinc-900/20">
        <Paintbrush className="h-12 w-12 text-zinc-700 mx-auto mb-6" />
        <h2 className="text-3xl font-bold mb-4 tracking-tighter">Your ideas. Our infrastructure.</h2>
        <p className="text-zinc-500 mb-10 max-w-lg mx-auto text-sm">
          Select a blank product, inject your tokenized IP, and push it to the global MetaCommerce network in minutes.
        </p>
        <Link href="/products/creator">
          <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-none px-12 font-mono uppercase tracking-widest text-xs">
            Start Designing
          </Button>
        </Link>
      </section>

    </div>
  );
}