'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import ShopByProduct from '@/components/showroom/ShopByProduct';
import ShopByAisle from '@/components/showroom/ShopByAisle';
import ShopByIP from '@/components/showroom/ShopByIP';
import ShowroomHero from '@/components/showroom/ShowroomHero';
import ShowroomNav from '@/components/showroom/ShowroomNav';

const ShopByProductAny = ShopByProduct as any;
const ShopByAisleAny = ShopByAisle as any;
const ShopByIPAny = ShopByIP as any;

const isIgnoredCategory = (cat: string) => {
  if (!cat) return true;
  if (cat.includes('MFG')) return true;
  return false;
};

const CATEGORY_MAPPING: Record<string, string> = {
  'Cups & Mugs': 'Drinkware',
};

function normalizeCategories(product: any) {
  if (!product.categories || !Array.isArray(product.categories)) {
    return [];
  }

  return product.categories
    .filter((cat) => !isIgnoredCategory(cat))
    .map((cat) => CATEGORY_MAPPING[cat] || cat)
    .filter(Boolean);
}

function extractIPFilters(ipAssets: any[]) {
  const categories = new Set<string>();
  const tags = new Set<string>();
  
  ipAssets.forEach(asset => {
    if (asset.category) {
      const cats = typeof asset.category === 'string' 
        ? asset.category.split(',').map(c => c.trim()) 
        : Array.isArray(asset.category) 
          ? asset.category 
          : [asset.category];
      cats.forEach(c => c && categories.add(c));
    }
    
    if (asset.tags) {
      const assetTags = Array.isArray(asset.tags)
        ? asset.tags
        : typeof asset.tags === 'string'
          ? asset.tags.split(',').map(t => t.trim())
          : [];
      assetTags.forEach(t => t && tags.add(t.toLowerCase()));
    }
  });
  
  return {
    categories: Array.from(categories),
    tags: Array.from(tags)
  };
}

const TABS = [
  { id: 'products', label: 'Products' }, // Shortened for mobile fit
  { id: 'aisles', label: 'Aisles' },
  { id: 'ip', label: 'IP Assets' },
] as const;

export default function ShowroomClient() {
  const [activeTab, setActiveTab] = useState<'products' | 'aisles' | 'ip'>('products');
  const [data, setData] = useState({
    products: [] as any[],
    aisles: [] as any[],
    ipAssets: [] as any[],
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const searchParams = useSearchParams();
  const activeCategory = searchParams.get('category') || '';

  const [ipFilters, setIpFilters] = useState({
    type: [] as string[],
    style: [] as string[],
    usage: [] as string[],
    theme: [] as string[]
  });

  const [productFilters, setProductFilters] = useState({
    activeCategories: [] as string[],
  });

  const [aisleFilters, setAisleFilters] = useState({
    audience: [] as string[],
    style: [] as string[],
    medium: [] as string[],
    useCase: [] as string[],
  });

  useEffect(() => {
    const fetchShowroomData = async () => {
      try {
        const response = await fetch('/api/showroom');
        const rawData = await response.json();
        const allItems = Array.isArray(rawData) ? rawData : [];
        
        setData({
          products: allItems.filter(item => 
            item.type === 'product' || item.id?.startsWith('prod_')
          ),
          aisles: allItems.filter(item => 
            // Accept either the explicit type tag OR the ID prefix
            item.type === 'aisle' || item.id?.startsWith('aisle_') || item.aisleSettings
          ),
          ipAssets: allItems.filter(item => 
            item.type === 'ip' || item.id?.startsWith('ip_')
          ),
        });
      } catch (error) {
        console.error('❌ SHOWROOM_FETCH_ERROR:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchShowroomData();
  }, []);

  useEffect(() => {
    if (activeCategory) {
      setActiveTab('products');
      const categoryExists = data.products.some(p => p.categories?.includes(activeCategory));
      if (categoryExists && !productFilters.activeCategories.includes(activeCategory)) {
        setProductFilters(prev => ({
          ...prev,
          activeCategories: [activeCategory]
        }));
      }
    }
  }, [activeCategory, data.products]);

  const ipData = useMemo(() => {
    const filters = extractIPFilters(data.ipAssets);
    const filteredAssets = data.ipAssets.filter(asset => {
      if (ipFilters.type.length > 0) {
        const assetCategories = typeof asset.category === 'string'
          ? asset.category.split(',').map((c: string) => c.trim())
          : Array.isArray(asset.category) ? asset.category : [];
        if (!ipFilters.type.some(selected => assetCategories.includes(selected))) return false;
      }
      if (ipFilters.theme.length > 0) {
        const assetTags = Array.isArray(asset.tags)
          ? asset.tags
          : typeof asset.tags === 'string' ? asset.tags.split(',').map((t: string) => t.trim()) : [];
        const normalizedTags = assetTags.map((t: string) => t.toLowerCase().trim());
        if (!ipFilters.theme.some(selected => normalizedTags.includes(selected.toLowerCase().trim()))) return false;
      }
      return true;
    });

    return {
      availableCategories: filters.categories,
      availableTags: filters.tags,
      filteredAssets: filteredAssets,
    };
  }, [data.ipAssets, ipFilters]);

  const stats = useMemo(() => {
    const productCreators = data.products.map((p) => p.creatorId || p.userId).filter(Boolean);
    const ipCreators = data.ipAssets.map((ip) => ip.ownerId).filter(Boolean);
    const uniqueCreators = new Set([...productCreators, ...ipCreators]);
    return {
      totalCreators: uniqueCreators.size,
      totalProducts: data.products.length,
      totalIpAssets: data.ipAssets.length,
    };
  }, [data.products, data.ipAssets]);

  const filteredAisles = useMemo(() => {
    return data.aisles.filter((aisle) => {
      if (aisleFilters.audience.length > 0) {
        const a = Array.isArray(aisle.audience) ? aisle.audience : [];
        if (!aisleFilters.audience.some((x) => a.includes(x))) return false;
      }
      if (aisleFilters.style.length > 0) {
        const s = Array.isArray(aisle.styles) ? aisle.styles : [];
        if (!aisleFilters.style.some((x) => s.includes(x))) return false;
      }
      if (aisleFilters.medium.length > 0) {
        const m = Array.isArray(aisle.mediums) ? aisle.mediums : [];
        if (!aisleFilters.medium.some((x) => m.includes(x))) return false;
      }
      if (aisleFilters.useCase.length > 0) {
        const u = Array.isArray(aisle.useCases) ? aisle.useCases : [];
        if (!aisleFilters.useCase.some((x) => u.includes(x))) return false;
      }
      return true;
    });
  }, [data.aisles, aisleFilters]);

  const handleSearch = async (q: string) => {
    setIsSearching(true);
    try { /* Implement Search Logic */ } finally { setIsSearching(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-emerald-500 font-mono text-xs animate-pulse">ESTABLISHING_SHOWROOM_CONNECTION...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-emerald-500/30">
      <ShowroomHero
        stats={stats}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onServerSearch={handleSearch}
        isSearching={isSearching}
      />

      {/* STICKY NAV - MOBILE OPTIMIZED */}
      <div className="sticky top-16 z-30 bg-[#020617]/80 backdrop-blur-md border-b border-white/5 py-3">
        <div className="container mx-auto px-4 flex justify-center">
          <div className="inline-flex w-full max-w-md p-1 bg-[#0f172a] rounded-xl border border-white/5 shadow-2xl">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA - ADJUSTED PADDING FOR MOBILE */}
      <div className="container mx-auto px-4 md:px-6 pt-8 pb-32">
        {activeTab === 'products' && (
          <ShopByProductAny
            items={data.products}
            activeCategories={productFilters.activeCategories}
            onCategoryToggle={(category: string) => 
              setProductFilters(prev => ({
                ...prev,
                activeCategories: prev.activeCategories.includes(category)
                  ? prev.activeCategories.filter(c => c !== category)
                  : [...prev.activeCategories, category]
              }))
            }
            onClearCategories={() => setProductFilters(prev => ({ ...prev, activeCategories: [] }))}
          />
        )}

        {activeTab === 'ip' && (
          <ShopByIPAny 
            items={ipData.filteredAssets}
            filters={ipFilters} 
            onToggleFilter={(groupId: string, value: string) => {
              setIpFilters(prev => {
                const currentGroup = (prev as any)[groupId] || [];
                const nextGroup = currentGroup.includes(value)
                  ? currentGroup.filter((v: string) => v !== value)
                  : [...currentGroup, value];
                return { ...prev, [groupId]: nextGroup };
              });
            }}
            onClearAll={() => setIpFilters({ type: [], style: [], usage: [], theme: [] })}
          />
        )}

        {activeTab === 'aisles' && (
          <ShopByAisleAny
            items={filteredAisles}
            filters={aisleFilters}
            onToggleFilter={(groupId: string, value: string) =>
              setAisleFilters((prev: any) => {
                const current = prev[groupId] || [];
                return {
                  ...prev,
                  [groupId]: current.includes(value)
                    ? current.filter((v: any) => v !== value)
                    : [...current, value],
                };
              })
            }
            onClearAll={() => setAisleFilters({ audience: [], style: [], medium: [], useCase: [] })}
          />
        )}
      </div>
    </div>
  );
}