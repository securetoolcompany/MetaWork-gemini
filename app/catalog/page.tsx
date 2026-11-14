'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Box, Layers, Cpu, ArrowRight, Loader2, Paintbrush, Search, ChevronLeft, ChevronRight, Database } from 'lucide-react';
import { BlankProductCard } from '@/components/product-creator/BlankProductCard';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PRODUCT_BROWSE_CATEGORIES } from '@/lib/productBrowseCategories';
import { classifyBlankProduct } from '@/lib/classifyBlankProduct';

const ITEMS_PER_PAGE = 24;

export default function MetaManufacturingPage() {
  const catalogResultsRef = useRef<HTMLDivElement>(null);
  const catalogNavRef = useRef<HTMLElement>(null);
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

  const selectBrowseCategory = useCallback((categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);

    window.requestAnimationFrame(() => {
      const target = catalogResultsRef.current;
      if (!target) return;

      const navHeight = catalogNavRef.current?.getBoundingClientRect().height || 0;
      const top =
        window.scrollY + target.getBoundingClientRect().top - navHeight - 16;
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: prefersReducedMotion ? 'instant' : 'smooth',
      });
    });
  }, []);

  const browseProducts = useMemo(() => {
    return products.map((product) => {
      const categoryIds = classifyBlankProduct(product);
      const matchingGroups = PRODUCT_BROWSE_CATEGORIES.filter((group) =>
        group.children.some((child) => categoryIds.includes(child.id))
      );
      const labels = matchingGroups.flatMap((group) => [
        group.label,
        ...group.children
          .filter((child) => categoryIds.includes(child.id))
          .map((child) => child.label),
      ]);

      return {
        product,
        categoryIds,
        groupIds: matchingGroups.map((group) => group.id),
        searchText: [
          product.name,
          product.type_name,
          ...labels,
        ].filter(Boolean).join(' ').toLowerCase(),
      };
    });
  }, [products]);

  const browseCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const item of browseProducts) {
      for (const id of [...item.categoryIds, ...item.groupIds]) {
        counts[id] = (counts[id] || 0) + 1;
      }
    }

    return counts;
  }, [browseProducts]);

  const activeBrowseGroup = PRODUCT_BROWSE_CATEGORIES.find((group) =>
    group.id === selectedCategory ||
    group.children.some((child) => child.id === selectedCategory)
  );

  const activeBrowseLabel =
    selectedCategory === 'All Products'
      ? 'All Blanks'
      : activeBrowseGroup?.children.find(
          (child) => child.id === selectedCategory
        )?.label || activeBrowseGroup?.label || 'All Blanks';

  const filteredProducts = useMemo(() => {
    const terms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

    return browseProducts
      .filter((item) => {
        const matchesCategory =
          selectedCategory === 'All Products' ||
          item.groupIds.includes(selectedCategory) ||
          item.categoryIds.includes(selectedCategory);

        return matchesCategory &&
          terms.every((term) => item.searchText.includes(term));
      })
      .map((item) => item.product);
  }, [browseProducts, selectedCategory, searchQuery]);

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
        <nav
          ref={catalogNavRef}
          aria-label="Manufacturing catalog search"
          className="sticky top-0 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex flex-col sm:flex-row gap-4 z-40 w-full"
        >
          <Button
            variant={selectedCategory === 'All Products' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSearchQuery('');
              selectBrowseCategory('All Products');
            }}
            className="h-10 rounded-full px-6"
          >
            <Database className="mr-2 h-4 w-4" />
            All Blanks ({products.length})
          </Button>

          <div className="relative w-full sm:max-w-lg sm:ml-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              aria-label="Search blank products"
              placeholder="Search products, types, or categories..."
              className="pl-11 h-10 bg-zinc-900 border-zinc-800 rounded-full text-white focus-visible:ring-blue-500 focus-visible:ring-offset-0"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
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
              <section className="space-y-6" aria-label="Browse manufacturing categories">
                <div>
                  <h2 className="text-2xl md:text-4xl font-black tracking-tight">
                    What would you like to create?
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    Explore blank products available to customize through MetaManufacturing.
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {PRODUCT_BROWSE_CATEGORIES
                    .filter((group) => browseCounts[group.id] > 0)
                    .map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        aria-pressed={activeBrowseGroup?.id === group.id}
                        onClick={() => selectBrowseCategory(group.id)}
                        className={cn(
                          'rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                          activeBrowseGroup?.id === group.id
                            ? 'border-blue-500 bg-blue-950/60'
                            : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600'
                        )}
                      >
                        <span className="block text-sm font-semibold">
                          {group.label}
                        </span>
                        <span className="mt-1 block text-xs text-zinc-400">
                          {browseCounts[group.id]} blanks
                        </span>
                        <span className="mt-3 block text-xs leading-relaxed text-zinc-500">
                          {group.children
                            .filter((child) => browseCounts[child.id] > 0)
                            .map((child) => child.label)
                            .slice(0, 3)
                            .join(' · ')}
                        </span>
                      </button>
                    ))}
                </div>

                {activeBrowseGroup && (
                  <div className="flex flex-wrap gap-2" aria-label="Subcategories">
                    <Button
                      size="sm"
                      variant={
                        selectedCategory === activeBrowseGroup.id
                          ? 'default'
                          : 'outline'
                      }
                      onClick={() => selectBrowseCategory(activeBrowseGroup.id)}
                    >
                      All {activeBrowseGroup.label}
                      {' '}({browseCounts[activeBrowseGroup.id] || 0})
                    </Button>

                    {activeBrowseGroup.children
                      .filter((child) => browseCounts[child.id] > 0)
                      .map((child) => (
                        <Button
                          key={child.id}
                          size="sm"
                          variant={
                            selectedCategory === child.id ? 'default' : 'outline'
                          }
                          onClick={() => selectBrowseCategory(child.id)}
                        >
                          {child.label} ({browseCounts[child.id]})
                        </Button>
                      ))}
                  </div>
                )}

                <div
                  ref={catalogResultsRef}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-5"
                >
                  <h3 className="text-xl font-semibold">
                    {activeBrowseLabel}
                  </h3>
                  <p className="text-sm text-zinc-400" role="status">
                    {filteredProducts.length} matching blanks
                  </p>
                </div>
              </section>

              {currentProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center">
                  <p>No blanks match your category and search.</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setSearchQuery('');
                      selectBrowseCategory('All Products');
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6">
                    {currentProducts.map((product: any) => (
                      <BlankProductCard 
                        key={product.catalogProductId || product.id || product._id} 
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