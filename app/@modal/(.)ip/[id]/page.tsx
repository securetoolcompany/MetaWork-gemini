'use client';

import * as React from 'react';
import { use } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import IPDetailsConsumerView from '@/components/ip/IPConsumerDialog';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function IPAssetModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [ipAsset, setIpAsset] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/ip/${id}`);
        const data = await res.json();
        if (data.success) setIpAsset(data.ipAsset);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchData();
  }, [id]);

  const handleClose = () => router.back();
  const handleSelect = (ip: any) =>
    router.push(`/products/creator?ipId=${ip.id || ip._id}`);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden">
        <DialogTitle className="sr-only">IP Asset Details</DialogTitle>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm font-mono text-muted-foreground">
              Loading...
            </p>
          </div>
        ) : !ipAsset ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <AlertTriangle className="w-12 h-12 text-destructive" />
            <p className="text-sm font-mono">Asset not found</p>
          </div>
        ) : (
          <IPDetailsConsumerView
            ip={ipAsset}
            onBack={handleClose}
            onSelect={handleSelect}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
