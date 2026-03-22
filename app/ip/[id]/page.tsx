'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import IPDetailsConsumerView from '@/components/ip/IPConsumerDialog';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function IPAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [ipAsset, setIpAsset] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/ip/${id}`);
        const data = await response.json();
        if (data.success) setIpAsset(data.ipAsset);
      } catch (error) {
        console.error('Fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchData();
  }, [id]);

  const handleBack = () => {
    router.push('/showroom');
  };

  const handleSelect = (ip) => {
    router.push(`/my-products/create?ipAssetId=${ip._id || ip.id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
        <p className="text-sm font-mono text-gray-400">Loading IP asset...</p>
      </div>
    );
  }

  if (!ipAsset) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-lg font-mono text-white mb-6">IP Asset not found</p>
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Showroom
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617]">
      <IPDetailsConsumerView
        ip={ipAsset}
        onBack={handleBack}
        onSelect={handleSelect}
      />
    </div>
  );
}