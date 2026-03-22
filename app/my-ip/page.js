'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useWallet } from '@/lib/WalletContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, CheckCircle, Clock, Loader2, Trash2, AlertTriangle, Wallet } from 'lucide-react';
import algosdk from 'algosdk';
import IPEditDialog from '@/components/ip/IPEditDialog';

// Helper to prevent JSON stringify crashes on BigInts
const bigintReplacer = (_key, value) =>
  typeof value === 'bigint' ? value.toString() : value;

const IP_CATEGORIES = [
  { value: 'anime-cartoons', label: 'Anime & Cartoons' },
  { value: 'combat-sports', label: 'Combat Sports' },
  { value: 'clubs-organizations', label: 'Clubs & Organizations' },
  { value: 'photography', label: 'Photography' },
  { value: 'nature', label: 'Nature' },
  { value: 'wildlife', label: 'Wildlife' },
  { value: 'water', label: 'Water' },
  { value: 'people', label: 'People' },
  { value: 'landscapes', label: 'Landscapes' },
  { value: 'urban', label: 'Urban' },
  { value: 'mountains-hills', label: 'Mountains & Hills' },
  { value: 'animals', label: 'Animals' },
  { value: 'plants', label: 'Plants' },
  { value: 'drawings-paintings', label: 'Drawings & Paintings' },
];


function MyIPPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, getAuthHeader } = useAuth();
  const { accountAddress, isConnected, signTransactionGroup } = useWallet();

  // --- STATE ---
  const [ipAssets, setIpAssets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedIP, setSelectedIP] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Minting Steps: 1 = Details, 2 = Stakeholders
  const [mintStep, setMintStep] = useState(1);

  // Wallet Balance Check
  const [walletBalance, setWalletBalance] = useState(null);

  // Form Data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    licensable: true,
    licenseFeeUsd: 2.5,
    isPublic: true,
    image: null
  });
  const [imagePreview, setImagePreview] = useState(null);

  // Stakeholders
  const [stakeholders, setStakeholders] = useState([
    { address: '', allocationType: 2, allocationValue: 80 }
  ]);

  // --- 1. FETCH ASSETS (Strictly Filtered) ---
  const fetchIPAssets = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await fetch('/api/ip', { headers: getAuthHeader() });
      if (response.ok) {
        const data = await response.json();
        const rawAssets = data.ipAssets || [];
        const currentAppId = process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID;

        // FILTER: Keep only unminted IPs OR IPs that match the current Global Pool
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

// --- 2. WALLET BALANCE CHECK ---
const checkWalletBalance = useCallback(async () => {
  if (!accountAddress) return;
  try {
    const algod = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
    const acct = await algod.accountInformation(accountAddress).do();
    const balanceAlgo = Number(acct.amount) / 1000000;
    const minBalance = Number(acct['min-balance'] || acct.minBalance || 0) / 1000000;
    const available = balanceAlgo - minBalance;

    // Need ~0.8 ALGO for Mint (0.1 NFT + 0.1 OptIn + 0.5 MBR + Fees)
    setWalletBalance({
      total: balanceAlgo,
      available: available,
      availableFormatted: available.toFixed(2),
      isEnough: available > 0.8
    });
  } catch (e) {
    console.error('Balance check failed:', e);
  }
}, [accountAddress]);

  useEffect(() => {
    if (showCreateDialog) checkWalletBalance();
  }, [showCreateDialog, checkWalletBalance]);

  // --- 3. FORM HANDLERS ---
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const updateStakeholder = (i, f, v) => {
    const newStk = [...stakeholders];
    newStk[i] = { ...newStk[i], [f]: v };
    setStakeholders(newStk);
  };

  const resetCreateForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      licensable: true,
      licenseFeeUsd: 2.5,
      isPublic: true,
      image: null
    });
    setImagePreview(null);
    setMintStep(1);
    setStakeholders([
      { address: accountAddress || '', allocationType: 2, allocationValue: 80 }
    ]);
  };

  // --- 4. MINTING LOGIC ---
const handleCreateIP = async (e) => {
    e.preventDefault();
    if (!isConnected) return toast.error('Please connect your wallet');
    if (walletBalance && !walletBalance.isEnough) return toast.error('Insufficient ALGO balance');

    if (mintStep === 1) {
      if (!formData.image || !formData.name || !formData.category) return toast.error('Missing required fields');
      if (stakeholders[0] && !stakeholders[0].address) {
        setStakeholders([{ address: accountAddress, allocationType: 2, allocationValue: 80 }, ...stakeholders.slice(1)]);
      }
      return setMintStep(2);
    }

    const validStakeholders = stakeholders
      .filter((s) => s.address && s.allocationValue > 0)
      .map((s) => ({ address: s.address, percentage: s.allocationValue, name: 'Stakeholder' }));

    const totalAllocated = validStakeholders.reduce((sum, s) => sum + Number(s.percentage), 0);
    if (totalAllocated > 80) return toast.error('Total allocation cannot exceed 80%');

    setIsCreating(true);
    const authHeaders = getAuthHeader();

    try {
      // --- STAGE A: IPFS UPLOAD ---
      toast.loading('Step 1/3: Pinning image to IPFS...', { id: 'mint' });
      const imageFolder = new FormData();
      imageFolder.append('file', formData.image);

      const pinataRes = await fetch('/api/ipfs/upload', {
        method: 'POST',
        body: imageFolder,
        headers: authHeaders
      });

      if (!pinataRes.ok) throw new Error('Failed to upload image to IPFS');
      const { ipfsHash } = await pinataRes.json();
      const imageCid = `ipfs://${ipfsHash}`;

// --- STAGE B: DATABASE & NFT PREP ---
      toast.loading('Step 2/3: Preparing Minting Transaction...', { id: 'mint' });
      
      const mintPayload = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        image: imageCid,
        stakeholders: validStakeholders, // Correctly uses the filtered array from line 203
        walletAddress: accountAddress
      };

      const res1 = await fetch('/api/ip/mint-v2', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          ...authHeaders 
        },
        body: JSON.stringify(mintPayload)
      });

      // 1. Parse the JSON exactly ONCE
      const data1 = await res1.json();

      // 2. Check if the response was successful
      if (!res1.ok) {
        throw new Error(data1.error || 'Failed to prepare minting');
      }
      
      // Now data1 is safe to use for the next steps...

      // --- STAGE C: SIGNING NFT ---
      toast.loading('Step 2/3: Sign NFT Creation...', { id: 'mint' });
      const signedNft = await signTransactionGroup([
        new Uint8Array(Buffer.from(data1.transaction, 'base64'))
      ]);
      if (!signedNft?.length) throw new Error('NFT signing cancelled');

      // --- STAGE D: POOL CREATION ---
      toast.loading('Step 3/3: Creating Revenue Pool...', { id: 'mint' });
      const res2 = await fetch('/api/ip/mint-v2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          step: 'confirm_nft',
          ipAssetId: data1.ipAssetId,
          signedTxn: Buffer.from(signedNft[0]).toString('base64')
        }, bigintReplacer)
      });

      if (!res2.ok) throw new Error((await res2.json()).error);
      const data2 = await res2.json();

      const poolTxns = data2.transactions.map(t => new Uint8Array(Buffer.from(t, 'base64')));
      const signedPool = await signTransactionGroup(poolTxns);
      if (!signedPool?.length) throw new Error('Pool signing cancelled');

      const res3 = await fetch('/api/ip/mint-v2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          step: 'confirm_pool',
          ipAssetId: data1.ipAssetId,
          signedTxns: signedPool.map(t => Buffer.from(t).toString('base64'))
        }, bigintReplacer)
      });

      if (!res3.ok) throw new Error((await res3.json()).error);

      toast.success('Minted Successfully! 🎉', { id: 'mint' });
      resetCreateForm();
      setShowCreateDialog(false);
      fetchIPAssets();

    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Mint failed', { id: 'mint' });
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusBadge = (ip) => {
    if (ip.status === 'active')
      return (
        <Badge className="bg-green-500">
          <CheckCircle className="w-3 h-3 mr-1" /> Active
        </Badge>
      );
    if (ip.status === 'pending_pool_create')
      return (
        <Badge className="bg-yellow-500 text-white">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Syncing
        </Badge>
      );
    return (
      <Badge variant="outline">
        <Clock className="w-3 h-3 mr-1" /> {ip.status}
      </Badge>
    );
  };

  // --- 5. RENDER ---
  // 1. Handle Loading State first
  if (isLoading || (typeof loading !== 'undefined' && loading)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // 2. Handle Unauthenticated State
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

  // 3. Main Dashboard Render (Authenticated)
  return (
    <div className="flex flex-col h-full bg-background min-h-screen">
      <div className="flex-1 p-4 md:p-8 space-y-6 overflow-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Intellectual Property
            </h1>
            <p className="text-muted-foreground">
              Manage and monetize your creative assets
            </p>
          </div>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button onClick={resetCreateForm}>
                <Plus className="w-4 h-4 mr-2" /> Mint New IP
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              {/* ... Dialog Content remains the same ... */}
              <DialogHeader>
                <DialogTitle>
                  {mintStep === 1
                    ? 'Mint IP: Details'
                    : 'Mint IP: Stakeholders'}
                </DialogTitle>
              </DialogHeader>

              {/* Wallet Warning */}
              {walletBalance && !walletBalance.isEnough && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Low Balance</p>
                    <p>
                      You have {walletBalance.availableFormatted} ALGO
                      available. Minting requires ~0.80 ALGO to cover network
                      fees and storage.
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleCreateIP} className="space-y-6 py-4">
                {mintStep === 1 ? (
                  <div className="space-y-4">
                    {/* Image Upload */}
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
                      {imagePreview ? (
                        <div className="relative group">
                          <img
                            src={imagePreview}
                            className="max-h-48 mx-auto rounded shadow-sm"
                            alt="Preview"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="absolute bottom-2 right-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              setImagePreview(null);
                              setFormData((p) => ({ ...p, image: null }));
                            }}
                          >
                            Change
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            id="image-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageChange}
                          />
                          <Label
                            htmlFor="image-upload"
                            className="cursor-pointer flex flex-col items-center gap-2"
                          >
                            <div className="p-3 bg-muted rounded-full">
                              <Plus className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">
                              Click to upload image
                            </span>
                          </Label>
                        </div>
                      )}
                    </div>

                    {/* Basic Info */}
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          placeholder="e.g. CyberPunk Character #01"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              name: e.target.value
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={formData.category}
                          onValueChange={(v) =>
                            setFormData({ ...formData, category: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {IP_CATEGORIES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          placeholder="Describe your asset..."
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              description: e.target.value
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Stakeholders */}
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex justify-between items-center text-sm text-blue-800">
                      <span>MetaWork Platform Fee</span>
                      <Badge variant="secondary">20%</Badge>
                    </div>

                    <div className="space-y-3">
                      {stakeholders.map((s, i) => (
                        <div
                          key={i}
                          className="flex gap-2 items-end border p-3 rounded bg-card"
                        >
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Wallet Address</Label>
                            <Input
                              value={s.address}
                              onChange={(e) =>
                                updateStakeholder(
                                  i,
                                  'address',
                                  e.target.value
                                )
                              }
                              placeholder="Algo Address"
                              className="font-mono text-xs"
                            />
                          </div>
                          <div className="w-24 space-y-1">
                            <Label className="text-xs">Share %</Label>
                            <Input
                              type="number"
                              value={s.allocationValue}
                              onChange={(e) =>
                                updateStakeholder(
                                  i,
                                  'allocationValue',
                                  Number(e.target.value)
                                )
                              }
                            />
                          </div>
                          {i > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setStakeholders(
                                  stakeholders.filter((_, idx) => idx !== i)
                                )
                              }
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setStakeholders([
                          ...stakeholders,
                          { address: '', allocationValue: 0 }
                        ])
                      }
                      className="w-full border-dashed"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add Stakeholder
                    </Button>
                  </div>
                )}

                <DialogFooter className="gap-2">
                  {mintStep === 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setMintStep(1)}
                    >
                      Back
                    </Button>
                  )}
                  <Button type="submit" disabled={isCreating} className="w-full sm:w-auto">
                    {isCreating ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : mintStep === 1 ? (
                      'Next: Stakeholders'
                    ) : (
                      'Confirm & Mint'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Asset Grid */}
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : ipAssets.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-xl">
            <div className="p-4 bg-muted inline-block rounded-full mb-4">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold">No Assets Found</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              You haven&apos;t minted any intellectual property yet. Click
              &quot;Mint New IP&quot; to get started.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ipAssets.map((ip) => (
              <Card 
  key={ip.id} 
  className="group overflow-hidden hover:shadow-lg transition-all duration-300 border-muted cursor-pointer"
onClick={() => {
  setSelectedIP(ip);        // Set the selected IP
  setDialogOpen(true);      // Open the dialog
}}

>
  <div className="aspect-square relative bg-muted overflow-hidden">
<img 
  src={(() => {
    // 1. Try multiple potential image sources
    const rawUrl = ip.imageUrl || ip.ipAsset?.imageUrl || ip.image || "";
    
    // Debug logging (remove after fixing)
    console.log('IP Image Debug:', { 
      id: ip.id, 
      rawUrl, 
      fullIp: ip 
    });
    
    // 2. Return placeholder if no URL
    if (!rawUrl) return "/placeholder.png";
    
    // 3. Handle full web links (Cloudinary, IPFS gateways, etc)
    if (rawUrl.startsWith('http')) return rawUrl;
    
    // 4. Handle IPFS protocol format
    if (rawUrl.startsWith('ipfs://')) {
      const cid = rawUrl.replace("ipfs://", "").split('?')[0];
      return `https://coffee-far-haddock-423.mypinata.cloud/ipfs/${cid}`;
    }
    
    // 5. Handle raw CID (no protocol prefix)
    // Check if it looks like a valid IPFS CID (starts with Qm or b)
    if (rawUrl.match(/^(Qm[a-zA-Z0-9]{44}|b[a-zA-Z2-7]{58})$/)) {
      return `https://coffee-far-haddock-423.mypinata.cloud/ipfs/${rawUrl}`;
    }
    
    // 6. If it contains 'cloudinary' anywhere, treat as Cloudinary URL
    if (rawUrl.includes('cloudinary')) {
      return rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    }
    
    // 7. Fallback to placeholder
    console.warn('Image URL format not recognized:', rawUrl);
    return "/placeholder.png";
  })()} 
  alt={ip.name || "Asset"} 
  onLoad={(e) => {
    e.currentTarget.classList.remove('opacity-0'); 
    e.currentTarget.classList.add('opacity-100');
  }}
  onError={(e) => {
    // Fallback to placeholder on error
    console.error('Image failed to load:', e.currentTarget.src);
    e.currentTarget.src = "/placeholder.png";
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
    <div className="flex justify-between items-start mb-2">
      <div>
        <h3 className="font-bold truncate" title={ip.name}>
          {ip.name}
        </h3>
        <p className="text-sm text-muted-foreground capitalize flex items-center gap-1">
          {ip.category}
        </p>
      </div>
    </div>
    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono truncate">
      ID: {ip.revenueTokenAssetId || 'Pending...'}
    </div>
    
    {/* Add action buttons */}
    <div className="mt-3 flex gap-2">
<Button 
  size="sm" 
  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-base font-semibold"
  onClick={(e) => {
    e.stopPropagation();
    setSelectedIP(ip);
    setDialogOpen(true);
  }}
>
  View Details
</Button>

    </div>
  </CardContent>
</Card>

            ))}
          </div>
        )}
        {/* IP Edit Dialog */}
{selectedIP && (
  <IPEditDialog
    ipAsset={selectedIP}
    open={dialogOpen}
    onOpenChange={setDialogOpen}
  />
)}

      </div>
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