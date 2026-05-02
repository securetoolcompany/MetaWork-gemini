'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Box, Layers, Cpu, ArrowRight, Loader2, Paintbrush } from 'lucide-react';
import { BlankProductCard } from '@/components/product-creator/BlankProductCard';
import Link from 'next/link';

export default function MetaManufacturingPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch the live production catalog for display only
  useEffect(() => {
    async function fetchCatalog() {
      try {
        const res = await fetch('/api/blank-products');
        const data = await res.json();
        setProducts(data.products || []);
      } catch (err) {
        console.error("Failed to sync production line", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCatalog();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-blue-500/30">
      
      {/* HERO SECTION */}
      <section className="px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
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
        <div className="max-w-7xl mx-auto px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">Ready to see specs and start building?</h3>
            <p className="text-blue-200 text-sm mt-1">Access the Product Creator to view material stats, pricing, and launch your designs.</p>
          </div>
          <Link href="/products/creator">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-zinc-100 font-bold tracking-tighter uppercase rounded-none px-8">
              Open Creator Terminal <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* VISUAL CATALOG SECTION */}
      <section className="px-8 py-20 bg-zinc-950">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <h3 className="text-2xl font-bold tracking-tight mb-2">Available Base Assets</h3>
            <p className="text-zinc-500 font-mono text-xs uppercase">Visual overview of current production line</p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              <span className="font-mono text-[10px] text-zinc-600 uppercase">Syncing_Line...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {products.map((product) => (
                <BlankProductCard 
                    key={product.id} 
                    product={product}
                    hideButtons={true}
                    onSelect={() => {}}  // Satisfies TypeScript
                    onInspect={() => {}} // Satisfies TypeScript
                    />
              ))}
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