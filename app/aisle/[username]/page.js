'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import AisleHeader from '@/components/aisle-public/AisleHeader';
import AislePreview from '@/components/aisle/AislePreview'; // We reuse the logic here
import { Skeleton } from '@/components/ui/skeleton';

export default function PublicAislePage() {
  const { username } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAisle() {
      try {
        setLoading(true);
        // FIXED THE URL PATH HERE
        const res = await fetch(`/api/aisle/${username}`);
        
        if (!res.ok) {
           const errText = await res.text();
           console.error("Server returned error HTML:", errText);
           throw new Error(`Server error: ${res.status}`);
        }

        const result = await res.json();
        if (result.success) {
          setData(result);
        } else {
          setError(result.error || 'Aisle not found');
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Failed to load aisle. Check console for details.');
      } finally {
        setLoading(false);
      }
    }

    if (username) fetchAisle();
  }, [username]);

  if (loading) return <div className="p-20"><Skeleton className="h-80 w-full mb-8" /><Skeleton className="h-64 w-full" /></div>;
  if (error) return <div className="text-center py-20 text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-[#0f172a] pb-20">
      {/* 1. Use the Public Header for the "Live" feel */}
      <AisleHeader creator={data.creator} settings={data.creator.aisleSettings} />

      {/* 2. Use the exact same Preview component for the content grid */}
      <div className="max-w-7xl mx-auto px-6 mt-8">
        <AislePreview 
          zoom={100}
          settings={{
            aisleSettings: data.creator.aisleSettings,
            username: data.creator.username,
            bio: data.creator.bio,
            avatarUrl: data.creator.avatar,
            bannerUrl: data.creator.banner
          }}
          products={data.products}
          ipAssets={data.ipAssets}
        />
      </div>
    </div>
  );
}