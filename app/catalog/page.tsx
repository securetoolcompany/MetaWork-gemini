'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Box, Terminal, Search, Filter, ArrowRight, 
  Layers, Zap, ShieldCheck, Info, Loader2 
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { BlankProductCard } from '@/components/product-creator/BlankProductCard';
export default function ManufacturingCatalog() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    async function fetchCatalog() {
      try {
        const res = await fetch('/api/blank-products');
        const data = await res.json();
        setProducts(data.products || []);
      } catch (err) {
        console.error("Failed to load catalog", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCatalog();
  }, []);

  const categories = ['All', 'Streetwear', 'Accessories', 'Home & Living', '3D Print Ready'];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || p.category?.includes(activeCategory);
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      {/* TERMINAL HEADER */}
      <section className="pt-20 pb-12 px-8 border-b border-zinc-800 bg-zinc-900/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Terminal className="h-5 w-5 text-blue-400" />
            <span className="font-mono text-xs text-zinc-500 uppercase tracking-[0.3em]">
              System / Production_Assets / v4.0
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6">
            Meta<span className="text-blue-500 italic">Manufacturing</span> Catalog
          </h1>
          <p className="text-zinc-400 max-w-2xl text-lg font-light leading-relaxed">
            Browse our global network of blank assets. From organic cotton streetwear to custom-tooled 3D designs, 
            every item is ready for IP injection and blockchain-verified royalty distribution.
          </p>
        </div>
      </section>

      {/* UTILITY BAR */}
      <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-8 py-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input 
              placeholder="Search assets (eg. 'Heavy Hoodie')..." 
              className="pl-10 bg-zinc-900 border-zinc-800 rounded-none font-mono text-xs focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest border transition-all ${
                  activeCategory === cat 
                    ? 'bg-blue-600 border-blue-500 text-white' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CATALOG GRID */}
      <main className="max-w-7xl mx-auto px-8 py-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
            <span className="font-mono text-xs text-zinc-500 uppercase">Synchronizing_Catalog...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredProducts.map((product) => (
              <BlankProductCard 
                key={product.id} 
                product={product}
                isPublicView={true}
                onSelect={() => {}}  // Added to satisfy TypeScript
                onInspect={() => {}} // Added to satisfy TypeScript
                />
            ))}
          </div>
        )}
      </main>

      {/* CALL TO ACTION DOCK */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-2xl">
        <div className="bg-blue-600 p-1 shadow-[0_0_50px_rgba(37,99,235,0.4)]">
          <div className="bg-zinc-950 border border-blue-500/30 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm tracking-tight">Ready to start building?</p>
              <p className="text-[10px] text-zinc-500 font-mono uppercase">No wallet required to start designing.</p>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700 rounded-none font-bold text-xs uppercase tracking-tighter">
              Open Design Terminal <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}