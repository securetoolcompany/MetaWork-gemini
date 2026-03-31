'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import ShopByProduct from '@/components/showroom/ShopByProduct';
import ShopByAisle from '@/components/showroom/ShopByAisle';
import ShopByIP from '@/components/showroom/ShopByIP';
import ShowroomHero from '@/components/showroom/ShowroomHero';
import ShowroomNav from '@/components/showroom/ShowroomNav';

// === helpers and config (copied from old page.js) ===



const isIgnoredCategory = (cat) => {
  if (!cat) return true;
  if (cat.includes('MFG')) return true;
  return false;
};

const CATEGORY_MAPPING = {
  'Cups & Mugs': 'Drinkware',
};

function normalizeCategories(product) {
  if (!product.categories || !Array.isArray(product.categories)) {
    return [];
  }

  return product.categories
    .filter((cat) => !isIgnoredCategory(cat))
    .map((cat) => CATEGORY_MAPPING[cat] || cat)
    .filter(Boolean);
}

// ===== IP ASSET CATEGORIES & FILTERS =====
const IP_CATEGORIES = [
  { value: 'anime-cartoons', label: 'Anime & Cartoons', icon: '🎨' },
  { value: 'combat-sports', label: 'Combat Sports', icon: '🥊' },
  { value: 'clubs-organizations', label: 'Clubs & Organizations', icon: '🏢' },
  { value: 'photography', label: 'Photography', icon: '📸' },
  { value: 'nature', label: 'Nature', icon: '🌿' },
  { value: 'wildlife', label: 'Wildlife', icon: '🦁' },
  { value: 'water', label: 'Water', icon: '🌊' },
  { value: 'people', label: 'People', icon: '👥' },
  { value: 'landscapes', label: 'Landscapes', icon: '🏞️' },
  { value: 'urban', label: 'Urban', icon: '🌆' },
  { value: 'mountains-hills', label: 'Mountains & Hills', icon: '⛰️' },
  { value: 'animals', label: 'Animals', icon: '🐾' },
  { value: 'plants', label: 'Plants', icon: '🌱' },
  { value: 'drawings-paintings', label: 'Drawings & Paintings', icon: '🖼️' },
];

// Extract unique categories and tags from IP assets
function extractIPFilters(ipAssets) {
  const categories = new Set();
  const tags = new Set();
  
  ipAssets.forEach(asset => {
    // Handle category (can be string or comma-separated)
    if (asset.category) {
      const cats = typeof asset.category === 'string' 
        ? asset.category.split(',').map(c => c.trim()) 
        : Array.isArray(asset.category) 
          ? asset.category 
          : [asset.category];
      cats.forEach(c => c && categories.add(c));
    }
    
    // Handle tags (array or comma-separated string)
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


// === main client component ===

const TABS = [
  { id: 'products', label: 'Shop by Product' },
  { id: 'aisles', label: 'Shop by Aisle' },
  { id: 'ip', label: 'Shop by IP Assets' },
] as const;

export default function ShowroomClient() {
    console.log('SHOWROOM_CLIENT_MOUNT');
  const [activeTab, setActiveTab] = useState<'products' | 'aisles' | 'ip'>(
    'products'
  );
  const [data, setData] = useState({
    products: [] as any[],
    aisles: [] as any[],
    ipAssets: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (q: string) => {
    setIsSearching(true);
    try {
      // TODO: implement search logic
    } finally {
      setIsSearching(false);
    }
  };

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
          products: allItems.filter(
            (item) =>
              item.id?.startsWith('prod_') ||
              item.externalProductId ||
              item.legacyProductId ||
              item.source === 'wp_export'
          ),
          aisles: allItems.filter(
            (item) =>
              item.id?.startsWith('aisle_') ||
              (item.slug && !item.legacyProductId)
          ),
          ipAssets: allItems.filter(
            (item) => item.id?.startsWith('ip_') || item.nftAssetId
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
      // Auto-select category from URL parameter
      setActiveTab('products');
      
      // Add the category to active filters if it exists in our products
      const categoryExists = data.products.some(p => 
        p.categories?.includes(activeCategory)
      );
      
      if (categoryExists && !productFilters.activeCategories.includes(activeCategory)) {
        setProductFilters(prev => ({
          ...prev,
          activeCategories: [activeCategory]
        }));
      }
    }
  }, [activeCategory, data.products]);


    // Compute available IP filters and filtered IP assets
  const ipData = useMemo(() => {
    const filters = extractIPFilters(data.ipAssets);
    
    const filteredAssets = data.ipAssets.filter(asset => {
      // 1. Asset Type Filter (matches state.type)
      if (ipFilters.type.length > 0) {
        const assetCategories = typeof asset.category === 'string'
          ? asset.category.split(',').map((c: string) => c.trim())
          : Array.isArray(asset.category) ? asset.category : [];
        
        if (!ipFilters.type.some(selected => assetCategories.includes(selected))) {
          return false;
        }
      }

      // 2. Theme Filter (matches state.theme)
      if (ipFilters.theme.length > 0) {
        const assetTags = Array.isArray(asset.tags)
          ? asset.tags
          : typeof asset.tags === 'string' ? asset.tags.split(',').map((t: string) => t.trim()) : [];
        
        const normalizedTags = assetTags.map((t: string) => t.toLowerCase().trim());
        
        if (!ipFilters.theme.some(selected => normalizedTags.includes(selected.toLowerCase().trim()))) {
          return false;
        }
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
    const productCreators = data.products
      .map((p) => p.creatorId || p.userId)
      .filter(Boolean);
    const ipCreators = data.ipAssets
      .map((ip) => ip.ownerId)
      .filter(Boolean);
    const uniqueCreators = new Set([...productCreators, ...ipCreators]);

    return {
      totalCreators: uniqueCreators.size,
      totalProducts: data.products.length,
      totalIpAssets: data.ipAssets.length,
    };
  }, [data.products, data.ipAssets]);

    const filteredAisles = useMemo(() => {
    return data.aisles.filter((aisle) => {
      // Audience
      if (aisleFilters.audience.length > 0) {
        const a = Array.isArray(aisle.audience) ? aisle.audience : [];
        const hasMatch = aisleFilters.audience.some((x) => a.includes(x));
        if (!hasMatch) return false;
      }

      // Style
      if (aisleFilters.style.length > 0) {
        const s = Array.isArray(aisle.styles) ? aisle.styles : [];
        const hasMatch = aisleFilters.style.some((x) => s.includes(x));
        if (!hasMatch) return false;
      }

      // Medium
      if (aisleFilters.medium.length > 0) {
        const m = Array.isArray(aisle.mediums) ? aisle.mediums : [];
        const hasMatch = aisleFilters.medium.some((x) => m.includes(x));
        if (!hasMatch) return false;
      }

      // Use Case
      if (aisleFilters.useCase.length > 0) {
        const u = Array.isArray(aisle.useCases) ? aisle.useCases : [];
        const hasMatch = aisleFilters.useCase.some((x) => u.includes(x));
        if (!hasMatch) return false;
      }

      return true;
    });
  }, [data.aisles, aisleFilters]);


  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-emerald-500 font-mono text-xs animate-pulse">
          ESTABLISHING_SHOWROOM_CONNECTION...
        </div>
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

      {/* STICKY NAV */}
<div className="sticky top-16 z-30 bg-background">
  <div className="container mx-auto px-6 flex justify-center">
    <div className="inline-flex p-1 bg-[#0f172a] rounded-lg border border-white/5 shadow-2xl">
  {TABS.map((tab) => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${
        activeTab === tab.id
          ? 'bg-[#1e293b] text-white shadow-lg'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      {tab.label}
    </button>
  ))}
</div>

  </div>
</div>


      <div className="container mx-auto px-6 pb-32">
                {activeTab === 'products' && (
          <ShopByProduct 
            items={data.products}
            activeCategories={productFilters.activeCategories}
            onCategoryToggle={(category) => 
              setProductFilters(prev => ({
                ...prev,
                activeCategories: prev.activeCategories.includes(category)
                  ? prev.activeCategories.filter(c => c !== category)
                  : [...prev.activeCategories, category]
              }))
            }
            onClearCategories={() =>
              setProductFilters(prev => ({ ...prev, activeCategories: [] }))
            }
          />
        )}


          {activeTab === 'ip' && (
          <ShopByIP 
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
            onClearAll={() => {
              setIpFilters({
                type: [],
                style: [],
                usage: [],
                theme: []
              });
            }}
          />
        )}

        {activeTab === 'aisles' && (
  <ShopByAisle
    items={filteredAisles}
    filters={aisleFilters}
    onToggleFilter={(groupId, value) =>
      setAisleFilters((prev) => {
        const current = prev[groupId] || [];
        return {
          ...prev,
          [groupId]: current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value],
        };
      })
    }
    onClearAll={() =>
      setAisleFilters({
        audience: [],
        style: [],
        medium: [],
        useCase: [],
      })
    }
  />
)}




      </div>
    </div>
  );
}
