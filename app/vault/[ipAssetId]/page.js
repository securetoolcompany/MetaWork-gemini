'use client';

import { use, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';
import { useWallet } from '@/lib/WalletContext';
import { toast } from 'sonner';
import IPConsumerDialog from '@/components/ip/IPConsumerDialog';
import {
  ArrowLeft, Shield, Lock, Wallet, Users,
  Coins, Loader2, AlertTriangle, Copy, Share2
} from 'lucide-react';
import Link from 'next/link';
import {
  StakeholderConfigForm,
  VaultReviewModal,
  StakeholderClaimDashboard,
  VaultStatusDisplay
} from '@/components/vault';

export default function VaultPage({ params }) {
  const unwrappedParams = use(params);
  const ipAssetId = unwrappedParams.ipAssetId;
  
  const { user, isAuthenticated } = useAuth();
  const { accountAddress, isConnected, connect } = useWallet();
  
  const [ipAsset, setIpAsset] = useState(null);
  const [vault, setVault] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProposing, setIsProposing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewMode, setReviewMode] = useState('propose');
  const [pendingStakeholders, setPendingStakeholders] = useState([]);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') setShareUrl(window.location.href);
    if (ipAssetId) fetchData();
  }, [ipAssetId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const ipResponse = await fetch(`/api/ip/${ipAssetId}`);
      const ipData = await ipResponse.json();
      if (ipData.success) setIpAsset(ipData.ipAsset);

      const vaultResponse = await fetch(`/api/vault?ipAssetId=${ipAssetId}`);
      if (vaultResponse.ok) {
        const vaultData = await vaultResponse.json();
        setVault(vaultData.vault);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Logic Helpers
  const isOwner = (isConnected && accountAddress === ipAsset?.ownerWallet) || 
                  (isAuthenticated && user?.id === ipAsset?.ownerId);
  const isMinted = (ipAsset?.status === 'active' || ipAsset?.status === 'minted') && ipAsset?.revenueTokenAssetId;

  // Handler functions (copyShareLink, handlePropose, etc. stay here...)
  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied!');
  };

  const handlePropose = (stakeholders) => {
    setPendingStakeholders(stakeholders);
    setReviewMode('propose');
    setShowReviewModal(true);
  };

  // handleConfirmPropose, handleFinalize, handleConfirmFinalize, handleClaim would go here...

  // --- RENDERING LOGIC ---

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-mono text-muted-foreground animate-pulse">SYNCHRONIZING VAULT DATA...</p>
      </div>
    );
  }

  // 2. Not Found State
  if (!ipAsset) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4 h-screen flex flex-col justify-center">
        <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
        <h2 className="text-xl font-bold font-mono">ASSET_NOT_FOUND</h2>
        <Button asChild variant="outline" className="w-full">
          <Link href="/my-ip">RETURN TO REGISTRY</Link>
        </Button>
      </div>
    );
  }

  // 3. THE RECEPTIONIST: If not owner, show Consumer Card
  if (!isOwner) {
    return (
      <div className="min-h-screen bg-background">
        <IPConsumerDialog ip={ipAsset} onBack={() => window.history.back()} />
      </div>
    );
  }

  // 4. OWNER UI: The Revenue Vault
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <Link href="/my-ip" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mb-2">
              <ArrowLeft className="w-4 h-4" />
              Back to My IP
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Shield className="w-7 h-7 text-primary" />
              Revenue Vault
            </h1>
            <p className="text-muted-foreground">Token distribution for "{ipAsset.name}"</p>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            {isConnected ? (
              <Badge variant="outline" className="font-mono">
                {accountAddress?.substring(0, 8)}...{accountAddress?.substring(50)}
              </Badge>
            ) : (
              <Button onClick={connect} size="sm"><Wallet className="w-4 h-4 mr-2" />Connect Wallet</Button>
            )}
            {vault && (
              <Button variant="outline" size="sm" onClick={copyShareLink}>
                <Share2 className="w-4 h-4 mr-2" /> Share Vault
              </Button>
            )}
          </div>
        </div>

        {/* Not Minted Warning */}
        {!isMinted ? (
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="py-8 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
              <h2 className="text-xl font-bold">IP Not Minted</h2>
              <p className="text-muted-foreground mt-2">Mint this IP to unlock revenue vault configuration.</p>
              <Button asChild className="mt-4"><Link href="/my-ip">Go Mint This IP</Link></Button>
            </CardContent>
          </Card>
        ) : (
          /* Minted: Show Tabs (Configure/Status/Claim) */
          <Tabs defaultValue={vault?.finalized ? 'status' : 'configure'}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="configure" disabled={vault?.finalized}>Configure</TabsTrigger>
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="claim">Claim</TabsTrigger>
            </TabsList>

            <TabsContent value="configure" className="mt-6">
               {/* Vault logic based on finalized state... */}
            </TabsContent>
            {/* Status and Claim Tabs Content... */}
          </Tabs>
        )}
      </div>

      {/* Review Modal */}
      <VaultReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        // ... all other props
      />
    </div>
  );
}