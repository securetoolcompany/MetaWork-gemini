'use client';

import { useRef, useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Upload, Info, Globe, Lock, Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useWallet } from '@/lib/WalletContext';
import { useAuth } from '@/lib/AuthContext';
import InsufficientCreditsModal from '@/components/credits/InsufficientCreditsModal';
import { getTransactionParams } from "@/lib/algorand";
import algosdk from "algosdk";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ── Shared category taxonomy (mirrors showroom IP_FILTER_GROUPS) ──────────────
export const IP_CATEGORY_GROUPS = [
  { id: 'type',  icon: '📦', label: 'Asset Type',   options: ['Illustration', 'Logo & Icon', 'Pattern & Texture', 'Typography', '3D Model', 'Photography'] },
  { id: 'style', icon: '✨', label: 'Visual Style',  options: ['Anime & Manga', 'Cyberpunk', 'Minimalist', 'Vintage & Retro', 'Street Art', 'Realistic', 'Cartoon'] },
  { id: 'usage', icon: '🎯', label: 'Best For',      options: ['Merch Designs', 'Social Media', 'Game Assets', 'Apparel Print', 'Brand Identity'] },
  { id: 'theme', icon: '🌌', label: 'Theme',         options: ['Esports & Gaming', 'Nature & Wildlife', 'Sci-Fi & Fantasy', 'Spiritual', 'Corporate'] },
];

export default function UploadIPPage() {
  return (
    <Suspense fallback={null}>
      <UploadIPInner />
    </Suspense>
  );
}

function UploadIPInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accountAddress, signTransactionGroup } = useWallet();
  const { getAuthHeader } = useAuth();
  const mode = searchParams.get('mode') || 'token'; // 'auth' or 'token'
  const tokenizationEndpoint = '/api/ip/revenue-tokenization';

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: [],          // array of selected values across all groups
    pricingModel: 'per-use',
    isPublic: true,
    licensingFee: 2.5,
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [charCount, setCharCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [stakeholderDialogOpen, setStakeholderDialogOpen] = useState(false);
  const [stakeholderDraft, setStakeholderDraft] = useState([]);
  const [stakeholderError, setStakeholderError] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({
    type: true,
    style: false,
    usage: false,
    theme: false,
  });

  const [stakeholders, setStakeholders] = useState([
    { address: '', percentage: 100, name: 'Creator' },
  ]);

  const tokenizationOperationKeyRef = useRef(null);

  useEffect(() => {
    if (!accountAddress) return;
    setStakeholders((prev) => {
      if (!prev.length) {
        return [{ address: accountAddress, percentage: 100, name: 'Creator' }];
      }
      const next = [...prev];
      if (!next[0].address) next[0].address = accountAddress;
      if (!next[0].name) next[0].name = 'Creator';
      return next;
    });
  }, [accountAddress]);

  const openStakeholderDialog = () => {
    const draft = stakeholders.map((stakeholder, index) => ({
      name: stakeholder.name || (index === 0 ? 'Creator' : ''),
      address: index === 0 ? accountAddress || stakeholder.address : stakeholder.address,
      percentage: String(stakeholder.percentage ?? ''),
    }));

    setStakeholderDraft(
      draft.length > 0
        ? draft
        : [{
            name: 'Creator',
            address: accountAddress || '',
            percentage: '100',
          }],
    );
    setStakeholderError('');
    setStakeholderDialogOpen(true);
  };

  const updateStakeholderDraft = (index, patch) => {
    setStakeholderDraft((previous) => {
      const next = previous.map((stakeholder, rowIndex) =>
        rowIndex === index
          ? { ...stakeholder, ...patch }
          : stakeholder,
      );

      const collaboratorBps = next.slice(1).reduce(
        (sum, stakeholder) => {
          const percentage = String(stakeholder.percentage ?? '').trim();

          if (!/^\d+(?:\.\d{1,2})?$/.test(percentage)) {
            return sum;
          }

          const [whole, fraction = ''] = percentage.split('.');

          return (
            sum +
            Number(whole) * 100 +
            Number(fraction.padEnd(2, '0'))
          );
        },
        0,
      );

      next[0] = {
        ...next[0],
        name: 'Creator',
        address: accountAddress || next[0].address || '',
        percentage: (Math.max(0, 10000 - collaboratorBps) / 100).toFixed(2),
      };

      return next;
    });

    setStakeholderError('');
  };

  const addStakeholderDraft = () => {
    setStakeholderDraft((previous) => [
      ...previous,
      {
        name: '',
        address: '',
        percentage: '',
      },
    ]);

    setStakeholderError('');
  };

  const removeStakeholderDraft = (index) => {
    if (index === 0) return;

    setStakeholderDraft((previous) => {
      const next = previous.filter((_, rowIndex) => rowIndex !== index);

      const collaboratorBps = next.slice(1).reduce(
        (sum, stakeholder) => {
          const percentage = String(stakeholder.percentage ?? '').trim();

          if (!/^\d+(?:\.\d{1,2})?$/.test(percentage)) {
            return sum;
          }

          const [whole, fraction = ''] = percentage.split('.');

          return (
            sum +
            Number(whole) * 100 +
            Number(fraction.padEnd(2, '0'))
          );
        },
        0,
      );

      next[0] = {
        ...next[0],
        name: 'Creator',
        address: accountAddress || next[0].address || '',
        percentage: (Math.max(0, 10000 - collaboratorBps) / 100).toFixed(2),
      };

      return next;
    });

    setStakeholderError('');
  };

  const stakeholderDraftTotalBps = stakeholderDraft.reduce(
    (sum, stakeholder) => {
      const percentage = String(stakeholder.percentage ?? '').trim();

      if (!/^\d+(?:\.\d{1,2})?$/.test(percentage)) {
        return sum;
      }

      const [whole, fraction = ''] = percentage.split('.');

      return (
        sum +
        Number(whole) * 100 +
        Number(fraction.padEnd(2, '0'))
      );
    },
    0,
  );

  const saveStakeholders = () => {
    const preparedStakeholders = stakeholderDraft.map((stakeholder, index) => ({
      name: (stakeholder.name || (index === 0 ? 'Creator' : '')).trim(),
      address: (
        index === 0 ? accountAddress : stakeholder.address || ''
      ).trim(),
      percentage: String(stakeholder.percentage ?? '').trim(),
    }));

    const missingStakeholder = preparedStakeholders.find(
      (stakeholder) =>
        !stakeholder.address ||
        !stakeholder.percentage,
    );

    if (missingStakeholder) {
      setStakeholderError(
        'Every stakeholder must include a wallet address and allocation percentage.',
      );
      return;
    }

    const invalidPercentage = preparedStakeholders.find(
      (stakeholder) =>
        !/^\d+(?:\.\d{1,2})?$/.test(stakeholder.percentage),
    );

    if (invalidPercentage) {
      setStakeholderError(
        'Stakeholder percentages must be non-negative values with at most two decimal places.',
      );
      return;
    }

    const canonicalStakeholders = preparedStakeholders.map((stakeholder) => {
      const [whole, fraction = ''] = stakeholder.percentage.split('.');

      return {
        ...stakeholder,
        bps: Number(whole) * 100 + Number(fraction.padEnd(2, '0')),
      };
    });

    const invalidStakeholder = canonicalStakeholders.find(
      (stakeholder) =>
        !algosdk.isValidAddress(stakeholder.address) ||
        !Number.isSafeInteger(stakeholder.bps) ||
        stakeholder.bps <= 0,
    );

    if (invalidStakeholder) {
      setStakeholderError(
        'Each stakeholder needs a valid Algorand wallet address and allocation greater than 0%.',
      );
      return;
    }

    const normalizedAddresses = canonicalStakeholders.map((stakeholder) =>
      stakeholder.address.toUpperCase(),
    );

    if (new Set(normalizedAddresses).size !== normalizedAddresses.length) {
      setStakeholderError('Duplicate stakeholder addresses are not allowed.');
      return;
    }

    const totalBps = canonicalStakeholders.reduce(
      (sum, stakeholder) => sum + stakeholder.bps,
      0,
    );

    if (totalBps !== 10000) {
      setStakeholderError('Stakeholder allocations must total exactly 100.00%.');
      return;
    }

    setStakeholders(
      canonicalStakeholders.map(({ bps, ...stakeholder }) => ({
        ...stakeholder,
        percentage: Number(stakeholder.percentage),
      })),
    );
    setStakeholderDialogOpen(false);
    setStakeholderError('');
  };

  const totalStakeholderPercentage = stakeholders.reduce(
    (sum, s) => sum + Number(s.percentage || 0),
    0
  );

  const toggleCategory = (val) => {
    setFormData((prev) => ({
      ...prev,
      category: prev.category.includes(val)
        ? prev.category.filter((c) => c !== val)
        : [...prev.category, val],
    }));
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error('File too large', {
        description: 'Maximum file size is 50MB',
      });
      return;
    }
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(selectedFile);
  };

  const handleDescriptionChange = (e) => {
    const text = e.target.value;
    if (text.length <= 500) {
      setFormData((prev) => ({ ...prev, description: text }));
      setCharCount(text.length);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || formData.category.length === 0 || !file) {
      toast.error('Missing fields', {
        description:
          'Please fill in all required fields and select at least one category',
      });
      return;
    }

    if (!accountAddress) {
      toast.error('Wallet not connected', {
        description: 'Please connect your Pera wallet first.',
      });
      return;
    }

    if (!tokenizationOperationKeyRef.current) {
      tokenizationOperationKeyRef.current = crypto.randomUUID();
    }

    const authHeaders = getAuthHeader();

    setIsLoading(true);
    const toastId = toast.loading('Starting IP creation...');
    try {
      // 1) Get IPFS key
      toast.loading('Preparing upload...', { id: toastId });
      const keyRes = await fetch('/api/ipfs/key', {
        method: 'POST',
        headers: authHeaders,
      });
      let keyJson;
      try {
        keyJson = await keyRes.json();
      } catch {
        throw new Error('Failed to get upload key');
      }
      if (!keyRes.ok) throw new Error(keyJson.error || 'Key generation failed');

      // 2) Upload file to IPFS
      toast.loading('Uploading to IPFS...', { id: toastId });
      const pinataData = new FormData();
      pinataData.append('file', file);
      const pinataRes = await fetch(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${keyJson.JWT}` },
          body: pinataData,
        },
      );
      let pinataJson;
      try {
        pinataJson = await pinataRes.json();
      } catch {
        throw new Error(`Upload failed (${pinataRes.status})`);
      }
      if (!pinataRes.ok || !pinataJson.IpfsHash)
        throw new Error(pinataJson.error || 'IPFS upload failed');

      const ipfsHash = pinataJson.IpfsHash;

      // 3) Prepare mint payload (for tokenization API)
      const preparedStakeholders = stakeholders.map((stakeholder, index) => ({
        name: (stakeholder.name || (index === 0 ? 'Creator' : '')).trim(),
        address: (
          index === 0 ? accountAddress : stakeholder.address || ''
        ).trim(),
        percentage: String(stakeholder.percentage ?? '').trim(),
      }));

      const missingStakeholder = preparedStakeholders.find(
        (stakeholder) =>
          !stakeholder.address ||
          !stakeholder.percentage,
      );

      if (missingStakeholder) {
        toast.error(
          'Every stakeholder must include a wallet address and allocation percentage.',
        );
        return;
      }

      const invalidPercentage = preparedStakeholders.find(
        (stakeholder) =>
          !/^\d+(?:\.\d{1,2})?$/.test(stakeholder.percentage),
      );

      if (invalidPercentage) {
        toast.error(
          'Stakeholder percentages must be non-negative values with at most two decimal places.',
        );
        return;
      }

      const stakeholdersForRequest = preparedStakeholders.map((stakeholder) => {
        const [whole, fraction = ''] = stakeholder.percentage.split('.');

        return {
          name: stakeholder.name,
          address: stakeholder.address,
          bps:
            Number(whole) * 100 +
            Number(fraction.padEnd(2, '0')),
        };
      });

      const invalidStakeholder = stakeholdersForRequest.find(
        (stakeholder) =>
          !algosdk.isValidAddress(stakeholder.address) ||
          !Number.isSafeInteger(stakeholder.bps) ||
          stakeholder.bps <= 0,
      );

      if (invalidStakeholder) {
        toast.error(
          'Each stakeholder needs a valid Algorand wallet address and allocation greater than 0%.',
        );
        return;
      }

      const normalizedAddresses = stakeholdersForRequest.map((stakeholder) =>
        stakeholder.address.toUpperCase(),
      );

      if (new Set(normalizedAddresses).size !== normalizedAddresses.length) {
        toast.error('Duplicate stakeholder addresses are not allowed.');
        return;
      }

      const totalBps = stakeholdersForRequest.reduce(
        (sum, stakeholder) => sum + stakeholder.bps,
        0,
      );

      if (totalBps !== 10000) {
        toast.error('Stakeholder allocations must total exactly 100.00%.');
        return;
      }

      const licensingFeeCents = formData.isPublic
        ? Math.max(0, Math.round(Number(formData.licensingFee || 0) * 100))
        : 0;

      const mintPayload = {
        operationKey: tokenizationOperationKeyRef.current,
        walletAddress: accountAddress,
        name: formData.name,
        description: formData.description,
        category: formData.category.join(','),
        isPublic: formData.isPublic,
        licensable: formData.isPublic,
        licensingFeeCents,
        licenseFeeUsd: licensingFeeCents / 100,
        image: ipfsHash,
        stakeholders: preparedStakeholders,
      };

      // 4) Create IP asset + NFT mint txn (credits checked here)
      toast.loading('Preparing NFT Mint...', { id: toastId });
      const res1 = await fetch(tokenizationEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(mintPayload),
      });
      const step1 = await res1.json();
      if (!res1.ok) throw new Error(step1.error || 'Deployment failed');

      if (step1.step === 'complete') {
        toast.success('IP is already tokenized.', { id: toastId });
        tokenizationOperationKeyRef.current = null;
        router.push('/my-ip');
        return;
      }

      if (
        step1.step !== 'mint_nft' ||
        !step1.ipAssetId ||
        !step1.mbrMicroAlgos ||
        !step1.transaction
      ) {
        throw new Error(
          'Tokenization preparation did not return a valid pending mint operation.',
        );
      }

      // 5) Build & sign MBR payment from user → platform
      // Use the MBR computed by the backend (pool + round-buffer + small buffer)
      const mbrMicroAlgos = step1.mbrMicroAlgos;
      toast.loading('Funding pool creation MBR...', { id: toastId });

      const params = await getTransactionParams();
      const platformAddr = process.env.NEXT_PUBLIC_TREASURY_ADDRESS;

      const mbrPayTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: accountAddress,
        receiver: platformAddr,
        amount: mbrMicroAlgos,
        suggestedParams: params,
      });

      // Encode to bytes for WalletContext
      const mbrPayBytes = algosdk.encodeUnsignedTransaction(mbrPayTxn);

      const signedMbr = await signTransactionGroup([mbrPayBytes]);
      if (!signedMbr || signedMbr.length === 0)
        throw new Error('MBR funding cancelled');

      const mbrRes = await fetch('/api/ip/pool-funding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          ipAssetId: step1.ipAssetId,
          signedMbrTxn: Buffer.from(signedMbr[0]).toString('base64'),
          mbrAmount: mbrMicroAlgos,
        }),
      });
      const mbrJson = await mbrRes.json();
      if (!mbrRes.ok) throw new Error(mbrJson.error || 'MBR funding failed');

      // 6) Sign NFT mint tx
      toast.loading('Sign NFT Mint Transaction...', { id: toastId });
      const signedNft = await signTransactionGroup([
        new Uint8Array(Buffer.from(step1.transaction, 'base64')),
      ]);
      if (!signedNft || signedNft.length === 0)
        throw new Error('NFT signing cancelled');

      // 7) Confirm NFT + admin create pool + rev ASA
      toast.loading('Confirming NFT and creating Revenue Pool...', {
        id: toastId,
      });
      const res2 = await fetch(tokenizationEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          step: 'confirm_nft',
          ipAssetId: step1.ipAssetId,
          signedTxns: signedNft.map((t) =>
            Buffer.from(t).toString('base64'),
          ),
        }),
      });
      const step2 = await res2.json();
      if (!res2.ok) throw new Error(step2.error || 'NFT/Pool Confirmation failed');

      toast.success('IP Successfully Minted and Tokenized!', { id: toastId });
      tokenizationOperationKeyRef.current = null;
      setTimeout(() => router.push('/my-ip'), 1000);
    } catch (error) {
      console.error(error);
      toast.dismiss(toastId);
      if (
        error.message?.toLowerCase().includes('insufficient credits') ||
        error.message?.toLowerCase().includes('not enough credits')
      ) {
        setShowCreditsModal(true);
        return;
      }
      toast.error(
        error.message?.includes('balance')
          ? 'Insufficient ALGO balance (Need ~0.5 ALGO)'
          : error.message,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 md:p-8 flex items-center justify-center">
        <Card className="w-full max-w-2xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground">
              Submit Your Intellectual Property
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Privacy Toggle */}
              <div className="relative space-y-3 p-4 rounded-lg border-2 border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="isPublic" className="text-base font-semibold">
                      {formData.isPublic ? 'Public IP' : 'Private IP'}
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>
                            <strong>Public:</strong> Available in IP library for
                            others to license. You earn royalties.
                          </p>
                          <p className="mt-1">
                            <strong>Private:</strong> Only you can see and use
                            it. No cost when using in your products.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-2">
                    {formData.isPublic ? (
                      <Globe className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Lock className="h-4 w-4 text-gray-500" />
                    )}
                    <Switch
                      id="isPublic"
                      checked={formData.isPublic}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, isPublic: checked }))
                      }
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formData.isPublic ? (
                    <>
                      📢 Your IP will be available in the global library. Others
                      can license it and you'll earn royalties per use.
                    </>
                  ) : (
                    <>
                      🔒 Your IP will be private. Only you can use it, and it
                      won't add to your product costs.
                    </>
                  )}
                </p>
              </div>

              {/* IP Name */}
              <div className="relative space-y-2">
                <Label htmlFor="name" className="text-foreground">
                  IP Name *
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Tiger Mascot Logo"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="bg-background border-border"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-foreground">
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe your IP and intended use..."
                  value={formData.description}
                  onChange={handleDescriptionChange}
                  className="bg-background border-border min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {charCount}/500
                </p>
              </div>

              {/* File Upload */}
              <div className="relative space-y-2">
                <Label className="text-foreground">File Upload *</Label>
                <div className="relative">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept=".png,.jpg,.jpeg,.svg"
                    onChange={handleFileChange}
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-lg cursor-pointer bg-background hover:bg-accent/50 transition-colors"
                  >
                    {preview ? (
                      <img
                        src={preview}
                        alt="Preview"
                        className="h-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-3 text-muted-foreground" />
                        <p className="mb-1 text-sm text-muted-foreground">
                          <span className="font-semibold">Click to upload</span>{' '}
                          or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG, SVG (max 10MB)
                        </p>
                      </div>
                    )}
                  </label>
                </div>
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {file.name}
                  </p>
                )}
              </div>

              {/* Categories */}
              <div className="relative space-y-2" id="ip-category-field">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground">
                    Categories *{' '}
                    <span className="text-xs text-muted-foreground">
                      (select all that apply)
                    </span>
                  </Label>
                  {formData.category.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, category: [] }))
                      }
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {formData.category.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {formData.category.map((c) => (
                      <Badge
                        key={c}
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive/20 text-xs"
                        onClick={() => toggleCategory(c)}
                      >
                        {c} ×
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="rounded-md border border-border overflow-hidden">
                  {IP_CATEGORY_GROUPS.map((group) => (
                    <div
                      key={group.id}
                      className="border-b border-border last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedGroups((prev) => ({
                            ...prev,
                            [group.id]: !prev[group.id],
                          }))
                        }
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/60 transition-colors"
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <span>{group.icon}</span>
                          <span>{group.label}</span>
                          {formData.category.filter((c) =>
                            group.options.includes(c),
                          ).length > 0 && (
                            <Badge
                              variant="default"
                              className="text-[10px] h-4 px-1.5 py-0"
                            >
                              {
                                formData.category.filter((c) =>
                                  group.options.includes(c),
                                ).length
                              }
                            </Badge>
                          )}
                        </span>
                        <span
                          className={`text-muted-foreground text-xs transition-transform inline-block ${
                            expandedGroups[group.id] ? 'rotate-180' : ''
                          }`}
                        >
                          ▾
                        </span>
                      </button>
                      {expandedGroups[group.id] && (
                        <div className="px-3 py-2.5 grid grid-cols-2 gap-1.5">
                          {group.options.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleCategory(opt)}
                              className={`rounded border px-2 py-1.5 text-xs font-medium text-left truncate transition-colors
                                ${
                                  formData.category.includes(opt)
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                                }`}
                              title={opt}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Licensing Fee (public only) */}
              {formData.isPublic && (
                <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Label className="text-foreground">
                      Licensing Fee (Per Use)
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Earn this amount each time someone uses your IP in a
                            product
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.licensingFee}
                      onFocus={(event) => event.currentTarget.select()}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          licensingFee: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="pl-7 bg-background border-border"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommended: $1.50 - $5.00
                  </p>
                </div>
              )}

              {/* Pricing Model */}
              <div className="space-y-3">
                <Label className="text-foreground">Pricing Model</Label>
                <RadioGroup
                  value={formData.pricingModel}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, pricingModel: value }))
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="per-use" id="per-use" />
                    <Label
                      htmlFor="per-use"
                      className="text-foreground cursor-pointer"
                    >
                      {formData.isPublic
                        ? 'Per-Use Royalty'
                        : 'Free for Own Use'}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Stakeholders */}
                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Label className="text-foreground">Stakeholders</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Configure everyone who should receive revenue tokens. Allocation is
                        locked after tokenization.
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={openStakeholderDialog}
                      disabled={isLoading || !accountAddress}
                    >
                      Configure Stakeholders
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {stakeholders.length} stakeholder
                      {stakeholders.length === 1 ? '' : 's'}
                    </span>

                    <Badge
                      variant={
                        Math.round(totalStakeholderPercentage * 100) === 10000
                          ? 'default'
                          : 'destructive'
                      }
                    >
                      {totalStakeholderPercentage.toFixed(2)}% allocated
                    </Badge>
                  </div>
                </div>

              {/* Submit */}
              <div className="relative">
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground"
                  disabled={isLoading}
                >
                  {isLoading ? 'Processing...' : 'Submit for Review'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={stakeholderDialogOpen}
        onOpenChange={(open) => {
          setStakeholderDialogOpen(open);

          if (!open) {
            setStakeholderError('');
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Configure Stakeholders</DialogTitle>
            <DialogDescription>
              Add every wallet that should receive revenue tokens. Allocations must
              total exactly 100.00%.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {stakeholderDraft.map((stakeholder, index) => (
              <div
                key={`${index}-${stakeholder.address}`}
                className="grid grid-cols-1 gap-3 rounded-md border border-border bg-background p-3 md:grid-cols-12"
              >
                <div className="md:col-span-3">
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input
                    value={stakeholder.name}
                    placeholder={index === 0 ? 'Creator' : 'Stakeholder'}
                    disabled={index === 0 || isLoading}
                    onChange={(event) =>
                      updateStakeholderDraft(index, {
                        name: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="md:col-span-6">
                  <Label className="text-xs text-muted-foreground">
                    Wallet Address
                  </Label>
                  <Input
                    value={index === 0 ? accountAddress || '' : stakeholder.address}
                    placeholder="Algorand wallet address"
                    disabled={index === 0 || isLoading}
                    onChange={(event) =>
                      updateStakeholderDraft(index, {
                        address: event.target.value.trim(),
                      })
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">
                    Allocation %
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={stakeholder.percentage}
                    disabled={isLoading}
                    onChange={(event) =>
                      updateStakeholderDraft(index, {
                        percentage: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex items-end md:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="w-full"
                    disabled={index === 0 || isLoading}
                    onClick={() => removeStakeholderDraft(index)}
                    aria-label={`Remove stakeholder ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {stakeholderError && (
            <p className="text-sm text-destructive">{stakeholderError}</p>
          )}

          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total Allocation</span>

            <Badge
              variant={
                stakeholderDraftTotalBps === 10000
                  ? 'default'
                  : 'destructive'
              }
            >
              {(stakeholderDraftTotalBps / 100).toFixed(2)}%
            </Badge>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={() => setStakeholderDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={addStakeholderDraft}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Stakeholder
            </Button>

            <Button
              type="button"
              disabled={isLoading}
              onClick={saveStakeholders}
            >
              Save Allocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InsufficientCreditsModal
        open={showCreditsModal}
        onClose={() => setShowCreditsModal(false)}
      />
    </div>
  );
}