'use client';

import { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Upload, Info, Globe, Lock } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import TutorialTooltip from '@/components/onboarding/TutorialTooltip';
import { useWallet } from '@/lib/WalletContext';
import { useAuth } from '@/lib/AuthContext';
import InsufficientCreditsModal from '@/components/credits/InsufficientCreditsModal';

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
  const isTutorial = searchParams.get('tutorial') === 'true';
  const { accountAddress, signTransactionGroup } = useWallet();
  const { getAuthHeader } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: [],          // array of selected values across all groups
    pricingModel: 'per-use',
    isPublic: true,
    licensingFee: 2.50,
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [charCount, setCharCount] = useState(0);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({ type: true, style: false, usage: false, theme: false });

  useEffect(() => { if (isTutorial) setTutorialStep(1); }, [isTutorial]);

  const toggleCategory = (val) => {
    setFormData(prev => ({
      ...prev,
      category: prev.category.includes(val)
        ? prev.category.filter(c => c !== val)
        : [...prev.category, val],
    }));
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum file size is 10MB' });
      return;
    }
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(selectedFile);
    if (tutorialStep === 4) setTimeout(() => setTutorialStep(5), 500);
  };

  const handleDescriptionChange = (e) => {
    const text = e.target.value;
    if (text.length <= 500) {
      setFormData({ ...formData, description: text });
      setCharCount(text.length);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || formData.category.length === 0 || !file) {
      toast.error('Missing fields', { description: 'Please fill in all required fields and select at least one category' });
      return;
    }
    if (!accountAddress) {
      toast.error('Wallet not connected', { description: 'Please connect your Pera wallet first.' });
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading('Starting IP creation...');
    try {
      toast.loading('Uploading to IPFS...', { id: toastId });
      const pinataData = new FormData();
      pinataData.append('file', file);
      const pinataRes = await fetch('/api/ipfs/upload', { method: 'POST', body: pinataData });
      const pinataJson = await pinataRes.json();
      if (!pinataJson.success) throw new Error('IPFS upload failed');

      const mintPayload = {
        walletAddress: accountAddress,
        name: formData.name,
        description: formData.description,
        category: formData.category.join(','),   // store as comma-string for API compat
        licensable: formData.isPublic,
        licenseFeeUsd: formData.licensingFee,
        isPublic: formData.isPublic,
        image: pinataJson.ipfsHash,
        stakeholders: [{ address: accountAddress, percentage: 80, name: 'Creator' }],
      };

      toast.loading('Preparing NFT Mint...', { id: toastId });
      const res1 = await fetch('/api/ip/mint-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(mintPayload),
      });
      const step1 = await res1.json();
      if (!res1.ok) throw new Error(step1.error || 'Deployment failed');

      toast.loading('Sign NFT Mint Transaction...', { id: toastId });
      const signedNft = await signTransactionGroup([[new Uint8Array(Buffer.from(step1.transaction, 'base64'))]]);
      if (!signedNft || signedNft.length === 0) throw new Error('NFT signing cancelled');

      toast.loading('Confirming NFT on chain...', { id: toastId });
      const res2 = await fetch('/api/ip/mint-v2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ step: 'confirm_nft', ipAssetId: step1.ipAssetId, signedTxns: signedNft.map(t => Buffer.from(t).toString('base64')) }),
      });
      const step2 = await res2.json();
      if (!res2.ok) throw new Error(step2.error || 'NFT Confirmation failed');

      toast.loading(`Sign ${step2.transactions.length} transactions to launch pool...`, { id: toastId });
      const poolTxns = step2.transactions.map(t => new Uint8Array(Buffer.from(t, 'base64')));
      const signedPool = await signTransactionGroup([poolTxns]);
      if (!signedPool || signedPool.length === 0) throw new Error('Pool setup signing cancelled');

      toast.loading('Finalizing Revenue Pool...', { id: toastId });
      const res3 = await fetch('/api/ip/mint-v2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ step: 'confirm_pool', ipAssetId: step1.ipAssetId, signedTxns: signedPool.map(t => Buffer.from(t).toString('base64')) }),
      });
      const final = await res3.json();
      if (!res3.ok) throw new Error(final.error);

      toast.success('IP Successfully Minted!', { id: toastId });

      if (isTutorial && typeof window !== 'undefined') {
        const completed = JSON.parse(localStorage.getItem('onboarding_completed') || '{}');
        completed['upload-ip'] = true;
        localStorage.setItem('onboarding_completed', JSON.stringify(completed));
        localStorage.removeItem('active_tutorial');
      }
      setTimeout(() => router.push('/my-ip'), 1000);
    } catch (error) {
      console.error(error);
      toast.dismiss(toastId);
      if (error.message?.toLowerCase().includes('insufficient credits') || error.message?.toLowerCase().includes('not enough credits')) {
        setShowCreditsModal(true);
        return;
      }
      toast.error(error.message?.includes('balance') ? 'Insufficient ALGO balance (Need ~0.5 ALGO)' : error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const tutorialSteps = [
    { id: 1, title: 'Welcome to IP Upload!', description: 'Let\'s upload your first IP asset. You can upload artwork, logos, patterns, and more!' },
    { id: 2, title: 'Choose Privacy Option', description: 'Decide if you want to share your IP globally for licensing (earn royalties) or keep it private for your own use.' },
    { id: 3, title: 'Enter IP Details', description: 'Give your IP a name and description. This helps others find and license your work if it\'s public.' },
    { id: 4, title: 'Upload Your File', description: 'Click here to upload your IP file. Supported formats: PNG, JPG, SVG (max 10MB).' },
    { id: 5, title: 'Set Categories & Fee', description: 'Choose categories and set your licensing fee if it\'s public. Pick from Asset Type, Visual Style, Best For, and Theme.' },
    { id: 6, title: 'Submit for Review', description: 'Click submit to add your IP! Public IPs need approval (24-48 hours), private ones are ready immediately.' },
  ];

  const handleTutorialComplete = () => {
    setTutorialStep(0);
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        const completed = JSON.parse(localStorage.getItem('onboarding_completed') || '{}');
        if (!completed['create-product']) {
          toast('Want to learn more?', {
            description: 'Try the Product Creation tutorial',
            action: { label: 'Start Tutorial', onClick: () => router.push('/product-designer?tutorial=true') },
          });
        }
      }
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 md:p-8 flex items-center justify-center">
        <Card className="w-full max-w-2xl border-border bg-card">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground">Submit Your Intellectual Property</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Privacy Toggle */}
              <div className="relative space-y-3 p-4 rounded-lg border-2 border-border bg-muted/30">
                {tutorialStep === 2 && (
                  <TutorialTooltip step={2} totalSteps={6} title={tutorialSteps[1].title} description={tutorialSteps[1].description}
                    position="bottom" onNext={() => setTutorialStep(3)} onPrev={() => setTutorialStep(1)}
                    onSkip={() => setTutorialStep(0)} onComplete={handleTutorialComplete} />
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="isPublic" className="text-base font-semibold">
                      {formData.isPublic ? 'Public IP' : 'Private IP'}
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p><strong>Public:</strong> Available in IP library for others to license. You earn royalties.</p>
                          <p className="mt-1"><strong>Private:</strong> Only you can see and use it. No cost when using in your products.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-2">
                    {formData.isPublic ? <Globe className="h-4 w-4 text-blue-500" /> : <Lock className="h-4 w-4 text-gray-500" />}
                    <Switch id="isPublic" checked={formData.isPublic} onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })} />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formData.isPublic
                    ? <>📢 Your IP will be available in the global library. Others can license it and you'll earn royalties per use.</>
                    : <>🔒 Your IP will be private. Only you can use it, and it won't add to your product costs.</>}
                </p>
              </div>

              {/* IP Name */}
              <div className="relative space-y-2">
                {tutorialStep === 3 && (
                  <TutorialTooltip step={3} totalSteps={6} title={tutorialSteps[2].title} description={tutorialSteps[2].description}
                    position="bottom" onNext={() => setTutorialStep(4)} onPrev={() => setTutorialStep(2)}
                    onSkip={() => setTutorialStep(0)} onComplete={handleTutorialComplete} />
                )}
                <Label htmlFor="name" className="text-foreground">IP Name *</Label>
                <Input id="name" placeholder="e.g., Tiger Mascot Logo" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-background border-border" required />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-foreground">Description</Label>
                <Textarea id="description" placeholder="Describe your IP and intended use..." value={formData.description}
                  onChange={handleDescriptionChange} className="bg-background border-border min-h-[100px]" />
                <p className="text-xs text-muted-foreground text-right">{charCount}/500</p>
              </div>

              {/* File Upload */}
              <div className="relative space-y-2">
                {tutorialStep === 4 && (
                  <TutorialTooltip step={4} totalSteps={6} title={tutorialSteps[3].title} description={tutorialSteps[3].description}
                    position="top" onNext={() => setTutorialStep(5)} onPrev={() => setTutorialStep(3)}
                    onSkip={() => setTutorialStep(0)} onComplete={handleTutorialComplete} />
                )}
                <Label className="text-foreground">File Upload *</Label>
                <div className="relative">
                  <input type="file" id="file-upload" className="hidden" accept=".png,.jpg,.jpeg,.svg" onChange={handleFileChange} />
                  <label htmlFor="file-upload"
                    className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-lg cursor-pointer bg-background hover:bg-accent/50 transition-colors">
                    {preview ? (
                      <img src={preview} alt="Preview" className="h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-3 text-muted-foreground" />
                        <p className="mb-1 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, SVG (max 10MB)</p>
                      </div>
                    )}
                  </label>
                </div>
                {file && <p className="text-sm text-muted-foreground">Selected: {file.name}</p>}
              </div>

              {/* ── Categories ── */}
              <div className="relative space-y-2" id="ip-category-field">
                {tutorialStep === 5 && (
                  <TutorialTooltip step={5} totalSteps={6} title={tutorialSteps[4].title} description={tutorialSteps[4].description}
                    position="bottom" onNext={() => setTutorialStep(6)} onPrev={() => setTutorialStep(4)}
                    onSkip={() => setTutorialStep(0)} onComplete={handleTutorialComplete} />
                )}
                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Categories * <span className="text-xs text-muted-foreground">(select all that apply)</span></Label>
                  {formData.category.length > 0 && (
                    <button type="button" onClick={() => setFormData({...formData, category: []})}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors">Clear all</button>
                  )}
                </div>

                {/* Selected badges */}
                {formData.category.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {formData.category.map(c => (
                      <Badge key={c} variant="secondary" className="cursor-pointer hover:bg-destructive/20 text-xs" onClick={() => toggleCategory(c)}>
                        {c} ×
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Grouped accordion */}
                <div className="rounded-md border border-border overflow-hidden">
                  {IP_CATEGORY_GROUPS.map((group) => (
                    <div key={group.id} className="border-b border-border last:border-b-0">
                      <button type="button"
                        onClick={() => setExpandedGroups(prev => ({...prev, [group.id]: !prev[group.id]}))}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/60 transition-colors">
                        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <span>{group.icon}</span>
                          <span>{group.label}</span>
                          {formData.category.filter(c => group.options.includes(c)).length > 0 && (
                            <Badge variant="default" className="text-[10px] h-4 px-1.5 py-0">
                              {formData.category.filter(c => group.options.includes(c)).length}
                            </Badge>
                          )}
                        </span>
                        <span className={`text-muted-foreground text-xs transition-transform inline-block ${expandedGroups[group.id] ? 'rotate-180' : ''}`}>▾</span>
                      </button>
                      {expandedGroups[group.id] && (
                        <div className="px-3 py-2.5 grid grid-cols-2 gap-1.5">
                          {group.options.map(opt => (
                            <button key={opt} type="button" onClick={() => toggleCategory(opt)}
                              className={`rounded border px-2 py-1.5 text-xs font-medium text-left truncate transition-colors
                                ${formData.category.includes(opt)
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
                              title={opt}>
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
                    <Label className="text-foreground">Licensing Fee (Per Use)</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger>
                        <TooltipContent><p>Earn this amount each time someone uses your IP in a product</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input type="number" step="0.25" min="0.50" value={formData.licensingFee}
                      onChange={(e) => setFormData({ ...formData, licensingFee: parseFloat(e.target.value) || 0.50 })}
                      className="pl-7 bg-background border-border" />
                  </div>
                  <p className="text-xs text-muted-foreground">Recommended: $1.50 - $5.00</p>
                </div>
              )}

              {/* Pricing Model */}
              <div className="space-y-3">
                <Label className="text-foreground">Pricing Model</Label>
                <RadioGroup value={formData.pricingModel} onValueChange={(value) => setFormData({ ...formData, pricingModel: value })}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="per-use" id="per-use" />
                    <Label htmlFor="per-use" className="text-foreground cursor-pointer">
                      {formData.isPublic ? 'Per-Use Royalty' : 'Free for Own Use'}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Submit */}
              <div className="relative">
                {tutorialStep === 6 && (
                  <TutorialTooltip step={6} totalSteps={6} title={tutorialSteps[5].title} description={tutorialSteps[5].description}
                    position="top" onNext={() => setTutorialStep(0)} onPrev={() => setTutorialStep(5)}
                    onSkip={() => setTutorialStep(0)} onComplete={handleTutorialComplete} />
                )}
                <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={isLoading}>
                  {isLoading ? 'Processing...' : 'Submit for Review'}
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>
      </div>

      {tutorialStep === 1 && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center">
          <div className="relative">
            <TutorialTooltip step={1} totalSteps={6} title={tutorialSteps[0].title} description={tutorialSteps[0].description}
              position="bottom" onNext={() => setTutorialStep(2)} onSkip={() => setTutorialStep(0)} onComplete={handleTutorialComplete} />
          </div>
        </div>
      )}
      <InsufficientCreditsModal open={showCreditsModal} onClose={() => setShowCreditsModal(false)} />
    </div>
  );
}