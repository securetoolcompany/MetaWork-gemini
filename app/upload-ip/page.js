'use client';

import { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Upload, Info, Globe, Lock } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import TutorialTooltip from '@/components/onboarding/TutorialTooltip';
import { useWallet } from '@/lib/WalletContext';
import { useAuth } from '@/lib/AuthContext';

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
    category: '',
    pricingModel: 'per-use',
    isPublic: true, 
    licensingFee: 2.50
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [charCount, setCharCount] = useState(0);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isTutorial) {
      setTutorialStep(1);
    }
  }, [isTutorial]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('File too large', { description: 'Maximum file size is 10MB' });
        return;
      }
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);

      if (tutorialStep === 4) {
        setTimeout(() => setTutorialStep(5), 500);
      }
    }
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

    if (!formData.name || !formData.category || !file) {
      toast.error('Missing fields', { description: 'Please fill in all required fields' });
      return;
    }

    if (!accountAddress) {
      toast.error('Wallet not connected', { description: 'Please connect your Pera wallet first.' });
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading('Starting IP creation...');

    try {
      // 1. Upload directly to IPFS (Pinata) for Web3 Decentralization
      toast.loading('Uploading to IPFS...', { id: toastId });
      const pinataData = new FormData();
      pinataData.append('file', file);
      
      const pinataRes = await fetch('/api/ipfs/upload', { method: 'POST', body: pinataData });
      const pinataJson = await pinataRes.json();
      if (!pinataJson.success) throw new Error('IPFS upload failed');

      // 2. Prepare exact JSON Payload expected by mint-v2
      const mintPayload = {
        walletAddress: accountAddress,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        licensable: formData.isPublic,
        licenseFeeUsd: formData.licensingFee,
        isPublic: formData.isPublic,
        image: pinataJson.ipfsHash, // Pass the CID returned from Pinata
        stakeholders: [
          { address: accountAddress, percentage: 80, name: 'Creator' },
        ]
      };

      // 3. STEP 1: Upload & Get NFT Mint Txn (Now using JSON!)
      toast.loading('Preparing NFT Mint...', { id: toastId });
      const res1 = await fetch('/api/ip/mint-v2', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeader() 
        },
        body: JSON.stringify(mintPayload),
      });

      const step1 = await res1.json();
      if (!res1.ok) throw new Error(step1.error || 'Deployment failed');

      // ... (The rest of your transaction signing logic remains exactly the same)
      // 4. Sign NFT Mint Txn
      toast.loading('Sign NFT Mint Transaction...', { id: toastId });
      const signedNft = await signTransactionGroup([
        new Uint8Array(Buffer.from(step1.transaction, 'base64')),
      ]);

      const step2 = await res2.json();
      if (!res2.ok) throw new Error(step2.error || 'NFT Confirmation failed');

      // 5. Sign Pool Setup Group
      toast.loading(`Sign ${step2.transactions.length} transactions to launch pool...`, { id: toastId });
      const poolTxns = step2.transactions.map((t) => new Uint8Array(Buffer.from(t, 'base64')));
      const signedPool = await signTransactionGroup(poolTxns);
      if (!signedPool || signedPool.length === 0) throw new Error('Pool setup signing cancelled');

      // 6. FINAL: Confirm Pool Creation
      toast.loading('Finalizing Revenue Pool...', { id: toastId });
      const res3 = await fetch('/api/ip/mint-v2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          step: 'confirm_pool',
          ipAssetId: step1.ipAssetId,
          signedTxns: signedPool.map((t) => Buffer.from(t).toString('base64')),
        }),
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

      setTimeout(() => {
        router.push('/my-ip');
      }, 1000);
    } catch (error) {
      console.error(error);
      const msg = error.message.includes('balance')
        ? 'Insufficient ALGO balance (Need ~0.5 ALGO)'
        : error.message;
      toast.error(msg, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };


  const tutorialSteps = [
    { id: 1, title: 'Welcome to IP Upload!', description: 'Let\'s upload your first IP asset. You can upload artwork, logos, patterns, and more!' },
    { id: 2, title: 'Choose Privacy Option', description: 'Decide if you want to share your IP globally for licensing (earn royalties) or keep it private for your own use.' },
    { id: 3, title: 'Enter IP Details', description: 'Give your IP a name and description. This helps others find and license your work if it\'s public.' },
    { id: 4, title: 'Upload Your File', description: 'Click here to upload your IP file. Supported formats: PNG, JPG, SVG (max 10MB).' },
    { id: 5, title: 'Set Category & Fee', description: 'Choose a category and set your licensing fee if it\'s public. For private IP, you can skip the fee.' },
    { id: 6, title: 'Submit for Review', description: 'Click submit to add your IP! Public IPs need approval (24-48 hours), private ones are ready immediately.' }
  ];

  const handleTutorialComplete = () => {
    setTutorialStep(0);

    // Ask if they want to do the other tutorial
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        const completed = JSON.parse(localStorage.getItem('onboarding_completed') || '{}');
        if (!completed['create-product']) {
          toast('Want to learn more?', {
            description: 'Try the Product Creation tutorial',
            action: {
              label: 'Start Tutorial',
              onClick: () => router.push('/product-designer?tutorial=true')
            }
          });
        }
      }
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Upload IP" />

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
                  <TutorialTooltip
                    step={2}
                    totalSteps={6}
                    title={tutorialSteps[1].title}
                    description={tutorialSteps[1].description}
                    position="bottom"
                    onNext={() => setTutorialStep(3)}
                    onPrev={() => setTutorialStep(1)}
                    onSkip={() => setTutorialStep(0)}
                    onComplete={handleTutorialComplete}
                  />
                )}
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
                          <p><strong>Public:</strong> Available in IP library for others to license. You earn royalties.</p>
                          <p className="mt-1"><strong>Private:</strong> Only you can see and use it. No cost when using in your products.</p>
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
                      onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formData.isPublic ? (
                    <>📢 Your IP will be available in the global library. Others can license it and you'll earn royalties per use.</>
                  ) : (
                    <>🔒 Your IP will be private. Only you can use it, and it won't add to your product costs.</>
                  )}
                </p>
              </div>

              {/* IP Name */}
              <div className="relative space-y-2">
                {tutorialStep === 3 && (
                  <TutorialTooltip
                    step={3}
                    totalSteps={6}
                    title={tutorialSteps[2].title}
                    description={tutorialSteps[2].description}
                    position="bottom"
                    onNext={() => setTutorialStep(4)}
                    onPrev={() => setTutorialStep(2)}
                    onSkip={() => setTutorialStep(0)}
                    onComplete={handleTutorialComplete}
                  />
                )}
                <Label htmlFor="name" className="text-foreground">IP Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Tiger Mascot Logo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-background border-border"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-foreground">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your IP and intended use..."
                  value={formData.description}
                  onChange={handleDescriptionChange}
                  className="bg-background border-border min-h-[120px]"
                />
                <p className="text-xs text-muted-foreground text-right">{charCount}/500</p>
              </div>

              {/* Category */}
              <div className="relative space-y-2">
                {tutorialStep === 5 && (
                  <TutorialTooltip
                    step={5}
                    totalSteps={6}
                    title={tutorialSteps[4].title}
                    description={tutorialSteps[4].description}
                    position="bottom"
                    onNext={() => setTutorialStep(6)}
                    onPrev={() => setTutorialStep(4)}
                    onSkip={() => setTutorialStep(0)}
                    onComplete={handleTutorialComplete}
                  />
                )}
                <Label htmlFor="category" className="text-foreground">Category *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="logo">Logo</SelectItem>
                    <SelectItem value="artwork">Artwork</SelectItem>
                    <SelectItem value="pattern">Pattern</SelectItem>
                    <SelectItem value="typography">Typography</SelectItem>
                    <SelectItem value="photography">Photography</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* File Upload */}
              <div className="relative space-y-2">
                {tutorialStep === 4 && (
                  <TutorialTooltip
                    step={4}
                    totalSteps={6}
                    title={tutorialSteps[3].title}
                    description={tutorialSteps[3].description}
                    position="top"
                    onNext={() => setTutorialStep(5)}
                    onPrev={() => setTutorialStep(3)}
                    onSkip={() => setTutorialStep(0)}
                    onComplete={handleTutorialComplete}
                  />
                )}
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
                    className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-lg cursor-pointer bg-background hover:bg-accent/50 transition-colors"
                  >
                    {preview ? (
                      <img src={preview} alt="Preview" className="h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, SVG (max 10MB)</p>
                      </div>
                    )}
                  </label>
                </div>
                {file && (
                  <p className="text-sm text-muted-foreground">Selected: {file.name}</p>
                )}
              </div>

              {/* Licensing Fee (only for public IP) */}
              {formData.isPublic && (
                <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Label className="text-foreground">Licensing Fee (Per Use)</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Earn this amount each time someone uses your IP in a product</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.25"
                      min="0.50"
                      value={formData.licensingFee}
                      onChange={(e) => setFormData({ ...formData, licensingFee: parseFloat(e.target.value) || 0.50 })}
                      className="pl-7 bg-background border-border"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Recommended: $1.50 - $5.00</p>
                </div>
              )}

              {/* Pricing Model */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-foreground">Pricing Model</Label>
                </div>
                <RadioGroup value={formData.pricingModel} onValueChange={(value) => setFormData({ ...formData, pricingModel: value })}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="per-use" id="per-use" />
                    <Label htmlFor="per-use" className="text-foreground cursor-pointer">
                      {formData.isPublic ? 'Per-Use Royalty' : 'Free for Own Use'}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Submit Button */}
              <div className="relative">
                {tutorialStep === 6 && (
                  <TutorialTooltip
                    step={6}
                    totalSteps={6}
                    title={tutorialSteps[5].title}
                    description={tutorialSteps[5].description}
                    position="top"
                    onNext={() => setTutorialStep(0)}
                    onPrev={() => setTutorialStep(5)}
                    onSkip={() => setTutorialStep(0)}
                    onComplete={handleTutorialComplete}
                  />
                )}
                <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={isLoading}>
                  {isLoading ? 'Processing...' : 'Submit for Review'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Initial Tutorial Tooltip */}
      {tutorialStep === 1 && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center">
          <div className="relative">
            <TutorialTooltip
              step={1}
              totalSteps={6}
              title={tutorialSteps[0].title}
              description={tutorialSteps[0].description}
              position="bottom"
              onNext={() => setTutorialStep(2)}
              onSkip={() => setTutorialStep(0)}
              onComplete={handleTutorialComplete}
            />
          </div>
        </div>
      )}
    </div>
  );
}