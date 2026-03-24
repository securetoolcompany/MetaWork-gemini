'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import AisleHeader from '@/components/aisle-public/AisleHeader';
import AisleCollectionGrid from '@/components/aisle-public/AisleCollectionGrid';
import AisleProductCard from '@/components/aisle-public/AisleProductCard';
import AisleIPAssetsSection from '@/components/aisle-public/AisleIPAssetsSection';
import AisleAdPlacement from '@/components/aisle-public/AisleAdPlacement';
import AisleTipJar from '@/components/aisle-public/AisleTipJar';
import AisleFooter from '@/components/aisle-public/AisleFooter';
import ProductDetailDialog from '@/components/showroom/ProductDetailDialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import React from 'react';

export default function PublicAislePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const username = params.username;

  // Data States
  const [creator, setCreator] = useState(null);
  const [products, setProducts] = useState([]);
  const [communityProducts, setCommunityProducts] = useState([]); // New state for curated items
  const [ipAssets, setIpAssets] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Deep-Linking / Sync States
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  /**
   * 1. URL TO STATE SYNCHRONIZATION
   * Watches the URL for ?item=ID and opens the corresponding modal.
   * Now checks both owned and community products.
   */
  useEffect(() => {
    const itemId = searchParams.get('item');
    if (itemId && (products.length > 0 || communityProducts.length > 0 || ipAssets.length > 0)) {
      const item = products.find(p => (p._id?.toString() === itemId || p.id === itemId)) || 
                   communityProducts.find(p => (p._id?.toString() === itemId || p.id === itemId)) ||
                   ipAssets.find(ip => (ip._id?.toString() === itemId || ip.id === itemId));
      
      if (item) {
        setSelectedItem(item);
        setIsDialogOpen(true);
      }
    } else if (!itemId) {
      setIsDialogOpen(false);
    }
  }, [searchParams, products, communityProducts, ipAssets]);

  /**
   * 2. STATE TO URL SYNCHRONIZATION
   */
  const handleSelectItem = useCallback((item) => {
    const id = item._id?.toString() || item.id;
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('item', id);
    
    window.history.replaceState(null, '', `?${newParams.toString()}`);
    setSelectedItem(item);
    setIsDialogOpen(true);
  }, [searchParams]);

  /**
   * 3. CLOSE HANDLER
   */
  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('item');
    
    const url = newParams.toString() ? `?${newParams.toString()}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [searchParams]);

  // Data Fetching Logic
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/aisle/${username}`);
        if (!res.ok) throw new Error('Failed to load aisle');
        const data = await res.json();

        if (data.success) {
          setCreator(data.creator);
          setProducts(data.products || []);
          setCommunityProducts(data.communityProducts || []); // Sync new curated products
          setIpAssets(data.ipAssets || []);
          setCollections(data.collections || []);
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
        toast.error('Failed to load aisle');
      } finally {
        setLoading(false);
      }
    };

    if (username) fetchData();
  }, [username]);

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
        <h1 className="text-3xl font-bold text-white">Creator Not Found</h1>
      </div>
    );
  }

  const settings = creator.aisleSettings || {};

  return (
    <div className={`min-h-screen bg-[#0f172a] text-white`}>
      <AisleHeader creator={creator} settings={settings} />

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* Sidebar Ads */}
          {settings.adSettings?.sidebar && (
            <div className="hidden lg:block w-64 flex-shrink-0">
              <AisleAdPlacement type="sidebar" accentColor={settings.accentColor} />
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 space-y-12">
            {/* IP Assets Section */}
            <AisleIPAssetsSection
              ipAssets={ipAssets}
              accentColor={settings.accentColor}
              onItemClick={handleSelectItem}
            />

            {/* Curated Community Products Section */}
            {communityProducts.length > 0 && (
              <section className="scroll-mt-24">
                <div className="mb-6">
                  <h2 className="text-3xl font-bold">
                    {settings.communitySectionTitle || "Community Creations"}
                  </h2>
                </div>
                <div 
                  className="grid gap-6"
                  style={{ gridTemplateColumns: `repeat(${settings.productsPerRow || 4}, minmax(0, 1fr))` }}
                >
                  {communityProducts.map(product => (
                    <AisleProductCard 
                      key={product._id} 
                      product={product} 
                      accentColor={settings.accentColor}
                      onClick={() => handleSelectItem(product)} 
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Dynamic Collections Section (Handles both owned and curated products) */}
            {collections?.map((collection) => {
              // Filters from the merged list of owned and community products
              const allAisleProducts = [...products, ...communityProducts];
              const collectionProducts = allAisleProducts.filter(p =>
                collection.itemIds?.includes(p._id?.toString()) || collection.productIds?.includes(p._id?.toString())
              );
              
              if (collectionProducts.length === 0) return null;
              
              return (
                <section key={collection.id} className="scroll-mt-24">
                  <div className="mb-6">
                    <h2 className="text-3xl font-bold">{collection.name}</h2>
                    {collection.description && <p className="text-slate-400">{collection.description}</p>}
                  </div>
                  <div 
                    className="grid gap-6"
                    style={{ gridTemplateColumns: `repeat(${settings.productsPerRow || 4}, minmax(0, 1fr))` }}
                  >
                    {collectionProducts.map(product => (
                      <AisleProductCard 
                        key={product._id} 
                        product={product} 
                        accentColor={settings.accentColor}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
      <AisleFooter creator={creator} />
    </div>
  );
}