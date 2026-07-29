'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useWallet } from '@/lib/WalletContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, CheckCircle, Clock, Loader2, Wallet, Trash2 } from 'lucide-react';
import IPEditDialog from '@/components/ip/IPEditDialog';
import InsufficientCreditsModal from '@/components/credits/InsufficientCreditsModal';

function MyIPPage() {
  const router = useRouter();
  const { isAuthenticated, getAuthHeader } = useAuth();
  const { isConnected, connect } = useWallet();

  const [ipAssets, setIpAssets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [assetTab, setAssetTab] = useState('token');
  const [selectedIP, setSelectedIP] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);

  const fetchIPAssets = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await fetch('/api/ip', { headers: getAuthHeader() });
      if (response.ok) {
        const data = await response.json();
        const rawAssets = data.ipAssets || [];
        const currentAppId = process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID;
        const cleanAssets = rawAssets.filter(
          (ip) =>
            !ip.revenuePoolAppId ||
            String(ip.revenuePoolAppId) === String(currentAppId)
        );
        setIpAssets(cleanAssets);
      }
    } catch (error) {
      console.error('Failed to fetch IP assets:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getAuthHeader]);

  useEffect(() => {
    if (isAuthenticated) fetchIPAssets();
  }, [isAuthenticated, fetchIPAssets]);

  const handleMintNew = () => {
    if (!isConnected) { connect(); return; }
    router.push(assetTab === 'auth' ? '/upload-ip?mode=auth' : '/upload-ip?mode=token');
  };

  const visibleAssets = ipAssets.filter(
    (ip) => (ip.assetType ?? 'token') === assetTab
  );

  const getStatusBadge = (ip) => {
    if (ip.status === 'active')
      return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Active</Badge>;
    if (ip.status === 'pending_pool_create')
      return <Badge className="bg-yellow-500 text-white"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Syncing</Badge>;
    return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> {ip.status}</Badge>;
  };

  const resolveImageUrl = (ip) => {
    const rawUrl = ip.imageUrl || ip.ipAsset?.imageUrl || ip.image || '';
    if (!rawUrl) return '/placeholder.png';
    if (rawUrl.startsWith('http')) return rawUrl;
    if (rawUrl.startsWith('ipfs://')) {
      const cid = rawUrl.replace('ipfs://', '').split('?')[0];
      return `https://coffee-far-haddock-423.mypinata.cloud/ipfs/${cid}`;
    }
    if (rawUrl.match(/^(Qm[a-zA-Z0-9]{44}|b[a-zA-Z2-7]{58})$/)) {
      return `https://coffee-far-haddock-423.mypinata.cloud/ipfs/${rawUrl}`;
    }
    return '/placeholder.png';
  };

  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (e, ip) => {
    e.stopPropagation();
    if (!confirm(`Delete "${ip.name}"? This cannot be undone.`)) return;
    setDeletingId(ip._id || ip.id);
    try {
      const res = await fetch(`/api/ip/${ip._id || ip.id}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error(await res.text());
      setIpAssets((prev) =>
        prev.filter((a) => (a._id || a.id) !== (ip._id || ip.id))
      );
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-8 text-center space-y-4">
        <div className="bg-muted p-4 rounded-full">
          <Wallet className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold">Please Sign In</h2>
        <p className="text-muted-foreground">
          You need to be signed in to manage your Intellectual Property.
        </p>
        <Button onClick={() => router.push('/login')}>Sign In</Button>
      </div>
    );
  }

  const emptyMessage = assetTab === 'auth'
    ? { heading: 'No Authenticated Documents', sub: 'Authenticate a deed, diploma, contract, or certificate to create an immutable on-chain record.' }
    : { heading: 'No IP Assets Found', sub: 'Mint your first piece of intellectual property — artwork, music, video, logos, and more.' };

  return (
    <div className="flex flex-col h-full bg-background min-h-screen">
      <div className="flex-1 p-4 md:p-8 space-y-6 overflow-auto">

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Intellectual Property</h1>
            <p className="text-muted-foreground">Manage and monetize your creative assets</p>
          </div>
          <Button onClick={handleMintNew}>
            <Plus className="w-4 h-4 mr-2" />
            {assetTab === 'auth' ? 'Authenticate Document' : 'Mint New IP'}
          </Button>
        </div>

        {/* Tab Toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden w-fit">
          <button
            type="button"
            onClick={() => setAssetTab('token')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors
              ${assetTab === 'token'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
          >
            🎨 IP Assets
          </button>
          <button
            type="button"
            onClick={() => setAssetTab('auth')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-l border-border
              ${assetTab === 'auth'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
          >
            📄 Authenticated Docs
          </button>
        </div>

        {/* Asset Grid */}
        {visibleAssets.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-xl">
            <div className="p-4 bg-muted inline-block rounded-full mb-4">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold">{emptyMessage.heading}</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">{emptyMessage.sub}</p>
            <Button className="mt-6" onClick={handleMintNew}>
              <Plus className="w-4 h-4 mr-2" />
              {assetTab === 'auth' ? 'Authenticate Document' : 'Mint New IP'}
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleAssets.map((ip) => (
              <Card
                key={ip._id || ip.id}
                className="group overflow-hidden hover:shadow-lg transition-all duration-300 border-muted cursor-pointer"
                onClick={() => { setSelectedIP(ip); setDialogOpen(true); }}
              >
                <div className="aspect-square relative bg-muted overflow-hidden">
                  <img
                    src={resolveImageUrl(ip)}
                    alt={ip.name || 'Asset'}
                    onLoad={(e) => {
                      e.currentTarget.classList.remove('opacity-0');
                      e.currentTarget.classList.add('opacity-100');
                    }}
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder.png';
                      e.currentTarget.classList.remove('opacity-0');
                      e.currentTarget.classList.add('opacity-100');
                    }}
                    className="w-full h-full object-cover opacity-0 transition-opacity duration-300"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    {getStatusBadge(ip)}
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="mb-2">
                    <h3 className="font-bold truncate" title={ip.name}>{ip.name}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{ip.category}</p>
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono truncate">
                    {assetTab === 'auth'
                      ? `TX: ${ip.txId || 'Pending...'}`
                      : `ID: ${ip.revenueTokenAssetId || 'Pending...'}`}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                      onClick={(e) => { e.stopPropagation(); setSelectedIP(ip); setDialogOpen(true); }}
                    >
                      View Details
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/40"
                      onClick={(e) => handleDelete(e, ip)}
                      disabled={deletingId === (ip._id || ip.id)}
                      title="Delete IP asset"
                    >
                      {deletingId === (ip._id || ip.id)
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {selectedIP && (
          <IPEditDialog
            key={selectedIP._id || selectedIP.id}
            ipAsset={selectedIP}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onSaved={(updated) => {
              // If dialog signals deletion
              if (updated?._deleted) {
                setIpAssets(prev =>
                  prev.filter(a =>
                    (a._id || a.id) !== (selectedIP._id || selectedIP.id)
                  )
                );
                return;
              }

              // Normal save path
              setIpAssets(prev =>
                prev.map(a =>
                  (a._id || a.id) === (updated._id || updated.id) ? updated : a
                )
              );
            }}
          />
        )}
      </div>

      <InsufficientCreditsModal open={showCreditsModal} onClose={() => setShowCreditsModal(false)} />
    </div>
  );
}

export default function MyIPPageWrapper() {
  return (
    <Suspense fallback={null}>
      <MyIPPage />
    </Suspense>
  );
}