'use client';

import { use, useEffect, useState } from 'react';
import ProductDetailDialog from '@/components/showroom/ProductDetailDialog';
import IPConsumerDialog from '@/components/ip/IPConsumerDialog';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function UnifiedView({ params }) {
  const unwrapped = use(params);
  const { id } = unwrapped;

  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Try product first
        let res = await fetch(`/api/products/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.product) {
            setAsset({ ...data.product, _kind: 'product' });
            return;
          }
        }

        // Fallback to IP
        res = await fetch(`/api/ip/${id}`);
        const ipData = await res.json();
        if (ipData.success && ipData.ipAsset) {
          setAsset({ ...ipData.ipAsset, _kind: 'ip' });
          return;
        }

        setAsset(null);
      } catch (e) {
        console.error('UnifiedView load error:', e);
        setAsset(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-xs font-mono text-muted-foreground">
          LOADING_ASSET…
        </p>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-3 p-8">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <p className="text-sm font-mono">ASSET_NOT_FOUND</p>
      </div>
    );
  }

  if (asset._kind === 'product') {
    return <ProductDetailDialog initialData={asset} />;
  }

  // IP path
  return (
    <IPConsumerDialog
      ip={asset}
      onBack={() => window.history.back()}
      onSelect={(ip) => {
        window.location.href = `/my-products/create?ipAssetId=${ip._id || ip.id}`;
      }}
    />
  );
}
