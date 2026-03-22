'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import AisleHeader from '@/components/aisle-public/AisleHeader';
import AisleCollectionGrid from '@/components/aisle-public/AisleCollectionGrid';
import AisleProductCard from '@/components/aisle-public/AisleProductCard';
import AisleIPAssetsSection from '@/components/aisle-public/AisleIPAssetsSection'; // NEW
import AisleAdPlacement from '@/components/aisle-public/AisleAdPlacement';
import AisleTipJar from '@/components/aisle-public/AisleTipJar';
import AisleFooter from '@/components/aisle-public/AisleFooter';
import { Share2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import React from 'react';

// Default aisle settings
const defaultSettings = {
  theme: 'dark-professional',
  accentColor: '#3b82f6',
  showBanner: true,
  showBio: true,
  showSocials: true,
  defaultSort: 'newest',
  productsPerRow: 3,
  cardStyle: 'standard',
  allowReviews: true,
  showSalesCounter: true,
  tipJarEnabled: false,
  tipPlacement: 'floating',
  showPoweredBy: true,
  adSettings: {
    header: true,
    sidebar: true,
    inGrid: true,
    inGridFrequency: 6
  },
  collections: []
};

export default function PublicAislePage() {
  const params = useParams();
  const username = params.username;
  
  const [creator, setCreator] = useState(null);
  const [products, setProducts] = useState([]);
  const [ipAssets, setIpAssets] = useState([]); // NEW
  const [sortedProducts, setSortedProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
  const fetchData = async () => {
    try {
      const res = await fetch(`/api/aisle/${username}`);
      if (!res.ok) throw new Error('Failed to load aisle');
      const data = await res.json();
      console.log('Aisle data', data);

      if (data.success) {
        const isOwner = data.isOwner;

        const mergedCreator = {
          ...data.creator,
          banner:
            data.creator.banner ||
            data.creator.bannerUrl ||
            data.creator.headerImage,
          avatar:
            data.creator.avatar ||
            data.creator.avatarUrl ||
            data.creator.profilePicture,
          aisleSettings: {
            theme: 'dark-professional',
            accentColor: '#3b82f6',
            headerStyle: 'full-banner',
            tipJarEnabled: true,
            showSalesCounter: true,
            defaultSort: 'newest',
            productsPerRow: 4,
            cardStyle: 'modern',
            allowReviews: true,
            adSettings: {
              header: false,
              sidebar: true,
              footer: false,
            },
            ...data.creator.aisleSettings,
          },
          collections: data.creator.collections || [],
          isOwner, // keep this
        };

        setCreator(mergedCreator);

        const liveProducts = (data.products || [])
          .filter(
            (p) =>
              (p.status === 'live' || p.status === 'active') &&
              p.isPublic !== false
          )
          .map((p) => ({
            ...p,
            name: p.name || p.title || p.productName || 'Untitled Product',
          }));

        setProducts(liveProducts);
        setCollections(data.collections || []);
        setIpAssets(data.ipAssets || []);

        const defaultSort =
          mergedCreator.aisleSettings?.defaultSort || 'newest';
        setSortedProducts(sortProducts(liveProducts, defaultSort));
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load aisle');
    } finally {
      setLoading(false);
    }
  };

  if (username) fetchData();
}, [username]);


  const sortProducts = (products, sortType) => {
    const sorted = [...products];
    switch (sortType) {
      case 'newest':
        return sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      case 'best-selling':
        return sorted.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
      case 'price-low':
        return sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
      case 'price-high':
        return sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
      default:
        return sorted;
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: `${creator.name} - MetaWork`, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Creator Not Found</h1>
          <p className="text-gray-400">This aisle doesn't exist.</p>
        </div>
      </div>
    );
  }

  const settings = creator.aisleSettings || {};
  const isOwner = creator.isOwner;
  const productCollections = creator.collections || [];
  const adSettings = settings.adSettings || {};
  
  const themeClasses = {
    'dark-professional': 'bg-[#0f172a] text-white',
    'light-modern': 'bg-white text-gray-900',
    'bold-vibrant': 'bg-[#1a1a2e] text-white',
    'monochrome': 'bg-black text-white',
    'default': 'bg-background text-foreground'
  };

  const themeClass = themeClasses[settings.theme] || themeClasses['default'];

console.log('Creator before header:', creator);

return (
    <div className={`min-h-screen ${themeClass}`}>
      {/* Header */}
      <AisleHeader 
        creator={creator} 
        settings={settings} 
        products={products} 
        collections={collections} 
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* Sidebar Ads */}
          {settings.adSettings?.sidebar && (
            <div className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-4">
                <AisleAdPlacement type="sidebar" accentColor={settings.accentColor} />
              </div>
            </div>
          )}

          {/* Main Column */}
          <div className="flex-1">
            {/* IP Assets Section - Added ID for sharing */}
            <div id="ip-assets" className="scroll-mt-24">
              <AisleIPAssetsSection
                ipAssets={ipAssets}
                accentColor={settings.accentColor}
                productsPerRow={settings.productsPerRow}
              />
            </div>

            {/* Product Collections */}
            {productCollections.length > 0 ? (
              productCollections.map((collection) => {
                const collectionProducts = products.filter(p =>
                  collection.productIds?.includes(p.id) ||
                  collection.productIds?.includes(p._id?.toString()) ||
                  collection.itemIds?.includes(p._id?.toString()) // Support itemIds from Atlas
                );
                
                if (collectionProducts.length === 0) return null;
                
                {/* Inside the productCollections.map loop in PublicAislePage */}
return (
  <section 
    key={collection.id} 
    id={collection.id} 
    className="scroll-mt-24 mb-12"
  >
    {/* Dynamic Title and Description from Atlas */}
    <div className="mb-6">
      <h2 className="text-3xl font-bold text-white mb-2">
        {collection.name}
      </h2>
      {collection.description && (
        <p className="text-slate-400 text-lg max-w-2xl">
          {collection.description}
        </p>
      )}
    </div>

    <AisleCollectionGrid
      collection={collection}
      products={collectionProducts}
      settings={settings}
    />
  </section>
);
              })
            ) : (
              /* Fallback: All Products - Added ID for sharing */
              <section id="all-products" className="scroll-mt-24 mb-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">
                    All Products 
                    <span className="text-gray-400 ml-2">({products.length})</span>
                  </h2>
                  {/* ... rest of your fallback code ... */}
                  <select
                    className="px-3 py-2 rounded-md border bg-gray-800 text-white"
                    defaultValue={settings.defaultSort}
                    onChange={(e) => setSortedProducts(sortProducts(products, e.target.value))}
                  >
                    <option value="newest">Newest</option>
                    <option value="best-selling">Best Selling</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                  </select>
                </div>
                
                {products.length === 0 ? (
                  <p className="text-gray-400 text-center py-12">No products available yet.</p>
                ) : (
                  <div 
                    className="grid gap-6"
                    style={{ gridTemplateColumns: `repeat(${settings.productsPerRow || 4}, minmax(0, 1fr))` }}
                  >
                    {sortedProducts.map((product) => (
                      <AisleProductCard
                        key={product._id}
                        product={product}
                        settings={settings}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Inline Tip Jar when sidebar disabled */}
            {settings.tipJarEnabled && !adSettings.sidebar && (
              <AisleTipJar creator={creator} accentColor={settings.accentColor} />
            )}
          </div>
        </div>
      </div>

      <AisleFooter creator={creator} />
    </div>
  );
}
