'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, DollarSign, TrendingUp, AlertCircle, Globe, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

export default function IPEditDialog({ ipAsset, open, onOpenChange, tutorialStep }) {
  const [formData, setFormData] = useState({
    name: ipAsset?.name || '',
    description: ipAsset?.description || 'High-quality digital artwork perfect for print-on-demand products',
    category: ipAsset?.category || '',
    tags: ipAsset?.tags || 'design, artwork, print, creative',
    licensingFee: ipAsset?.licensingFee || 2.50,
    isPublic: ipAsset?.isPublic !== undefined ? ipAsset.isPublic : true
  });
  const [charCount, setCharCount] = useState(formData.description.length);

  const handleDescriptionChange = (e) => {
    const text = e.target.value;
    if (text.length <= 500) {
      setFormData({ ...formData, description: text });
      setCharCount(text.length);
    }
  };

  // Calculate potential earnings based on current usage
  const currentUsageCount = ipAsset?.usageCount || 0;
  const currentEarnings = ipAsset?.earnings || 0;
  const averageEarningsPerUse = currentUsageCount > 0 ? (currentEarnings / currentUsageCount) : formData.licensingFee;
  
  // Project earnings with new fee
  const projectedEarningsPerUse = formData.licensingFee;
  const potentialIncrease = ((projectedEarningsPerUse - averageEarningsPerUse) / averageEarningsPerUse * 100).toFixed(1);

  const handleSave = () => {
    if (!formData.name || !formData.category) {
      toast.error('Missing required fields', {
        description: 'Please fill in all required fields'
      });
      return;
    }

    if (formData.isPublic && formData.licensingFee <= 0) {
      toast.error('Invalid licensing fee!', {
        description: 'Public IP requires a licensing fee'
      });
      return;
    }

    if (formData.isPublic && formData.licensingFee < 0.50) {
      toast.error('Licensing fee too low!', {
        description: 'Minimum licensing fee is $0.50 per use'
      });
      return;
    }

    if (formData.isPublic && formData.licensingFee > 20.00) {
      toast.warning('High licensing fee', {
        description: 'High fees may discourage usage. Consider market rates.'
      });
    }

    // Check if changing from public to private
    if (ipAsset?.isPublic && !formData.isPublic) {
      toast.success('IP set to private!', {
        description: 'Removed from library. Existing licenses remain active.'
      });
    } else if (!ipAsset?.isPublic && formData.isPublic) {
      toast.success('IP set to public!', {
        description: 'Will be available in library after approval.'
      });
    } else {
      toast.success('IP updated successfully!', {
        description: 'Your changes have been saved'
      });
    }
    
    onOpenChange(false);
  };

  if (!ipAsset) return null;

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        // Prevent closing dialog during tutorial steps 3-8 (when user is editing fields)
        if (tutorialStep >= 3 && tutorialStep <= 8) {
          // Don't allow closing during these steps
          return;
        }
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Edit IP Asset</DialogTitle>
          <DialogDescription>
            Update your IP details, visibility, licensing fees, and usage information
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column - IP Details */}
          <div className="space-y-6">
            {/* IP Preview */}
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="aspect-square relative rounded-lg overflow-hidden bg-muted mb-3">
                  <img
                    src={ipAsset.imageUrl}
                    alt={ipAsset.name}
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge className={
                      ipAsset.status === 'approved' ? 'bg-green-600' :
                      ipAsset.status === 'pending' ? 'bg-yellow-600' : 'bg-red-600'
                    }>
                      {ipAsset.status === 'approved' ? 'Approved' :
                       ipAsset.status === 'pending' ? 'Pending' : 'Rejected'}
                    </Badge>
                  </div>
                </div>
                <Button variant="outline" className="w-full" size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload New Version
                </Button>
              </CardContent>
            </Card>

            {/* Visibility Toggle */}
            <Card className="border-border bg-card" id="ip-visibility-toggle">
              <CardContent className="p-4 space-y-3">
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
                          <p><strong>Public:</strong> Available in IP library for licensing. Earn royalties.</p>
                          <p className="mt-1"><strong>Private:</strong> Only you can use. No cost in your products.</p>
                          <p className="mt-1 text-yellow-500">Note: Changing to private won't affect existing licenses.</p>
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
                    <>🌐 Visible in global IP library. Others can license it for royalties.</>
                  ) : (
                    <>🔒 Private to you. Free to use in your products. Hidden from library.</>
                  )}
                </p>
                {ipAsset.usageCount > 0 && !formData.isPublic && (
                  <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-muted-foreground">
                    ⚠️ This IP is used in {ipAsset.usageCount} products. Existing licenses remain active.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Basic Info */}
            <div className="space-y-4" id="ip-basic-info">
              <div className="space-y-2" id="ip-name-field">
                <Label htmlFor="name">IP Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Dragon Logo, Abstract Pattern"
                  className="bg-background border-border"
                />
              </div>

              <div className="space-y-2" id="ip-description-field">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={handleDescriptionChange}
                  placeholder="Describe your IP asset and intended use..."
                  className="bg-background border-border min-h-[120px]"
                />
                <p className="text-xs text-muted-foreground text-right">{charCount}/500</p>
              </div>

              <div className="space-y-2" id="ip-category-field">
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Logo">Logo</SelectItem>
                    <SelectItem value="Artwork">Artwork</SelectItem>
                    <SelectItem value="Pattern">Pattern</SelectItem>
                    <SelectItem value="Typography">Typography</SelectItem>
                    <SelectItem value="Photography">Photography</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2" id="ip-tags-field">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="e.g. vintage, cool, urban, modern"
                  className="bg-background border-border"
                />
                <p className="text-xs text-muted-foreground">
                  Help others discover your IP with relevant tags
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Licensing & Analytics */}
          <div className="space-y-6">
            {/* Licensing Fee (only for public IP) */}
            {formData.isPublic && (
              <Card className="border-border bg-card" id="ip-licensing-fee">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Licensing Fee
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fee">Per-Use Royalty *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        id="fee"
                        type="number"
                        step="0.25"
                        min="0.50"
                        max="20.00"
                        value={formData.licensingFee}
                        onChange={(e) => setFormData({ ...formData, licensingFee: parseFloat(e.target.value) || 0 })}
                        className="pl-7 bg-background border-border"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Amount earned each time this IP is used on a product
                    </p>
                  </div>

                  {/* Fee Guidance */}
                  <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Recommended Range:</span>
                      <span className="font-semibold text-foreground">$1.50 - $5.00</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formData.licensingFee < 1.50 ? '⚠️ Lower fees encourage more usage' :
                       formData.licensingFee > 5.00 ? '⚠️ Higher fees may limit adoption' :
                       '✓ This is within the optimal range'}
                    </div>
                  </div>

                  {/* Impact Analysis */}
                  {currentUsageCount > 0 && (
                    <div className="p-3 rounded-lg border border-border bg-background">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">Impact Analysis</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Current avg earnings/use:</span>
                          <span className="font-semibold">${averageEarningsPerUse.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">New earnings/use:</span>
                          <span className="font-semibold">${projectedEarningsPerUse.toFixed(2)}</span>
                        </div>
                        {Math.abs(potentialIncrease) > 1 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Change:</span>
                            <span className={`font-semibold ${potentialIncrease > 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {potentialIncrease > 0 ? '+' : ''}{potentialIncrease}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Private IP Info */}
            {!formData.isPublic && (
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    Private IP Benefits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2 text-sm">
                    <div className="rounded-full bg-green-500/20 p-1 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    </div>
                    <span className="text-muted-foreground">Free to use in all your products</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <div className="rounded-full bg-green-500/20 p-1 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    </div>
                    <span className="text-muted-foreground">No licensing costs deducted</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <div className="rounded-full bg-green-500/20 p-1 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    </div>
                    <span className="text-muted-foreground">Hidden from public library</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <div className="rounded-full bg-green-500/20 p-1 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    </div>
                    <span className="text-muted-foreground">Exclusive to your brand</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Usage Analytics */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Usage Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Uses</span>
                  <span className="font-semibold text-foreground">{ipAsset.usageCount} products</span>
                </div>
                {formData.isPublic && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Earnings</span>
                      <span className="font-semibold text-green-500">${ipAsset.earnings.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Avg per Product</span>
                      <span className="font-semibold text-foreground">
                        ${ipAsset.usageCount > 0 ? (ipAsset.earnings / ipAsset.usageCount).toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </>
                )}
                
                <Separator className="bg-border my-3" />
                
                {/* Potential Earnings */}
                {formData.isPublic ? (
                  <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                    <div className="text-xs text-muted-foreground mb-1">Potential Monthly Earnings</div>
                    <div className="text-2xl font-bold text-foreground">
                      ${(formData.licensingFee * Math.max(ipAsset.usageCount, 10)).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Based on {Math.max(ipAsset.usageCount, 10)} uses per month
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Cost Savings</div>
                    <div className="text-2xl font-bold text-green-500">
                      ${(2.50 * ipAsset.usageCount).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Saved by keeping IP private (vs $2.50/use)
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* IP Status Info */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Status Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Approval Status</span>
                  <Badge className={
                    ipAsset.status === 'approved' ? 'bg-green-600' :
                    ipAsset.status === 'pending' ? 'bg-yellow-600' : 'bg-red-600'
                  }>
                    {ipAsset.status === 'approved' ? 'Approved' :
                     ipAsset.status === 'pending' ? 'Pending Review' : 'Rejected'}
                  </Badge>
                </div>
                
                {ipAsset.status === 'pending' && formData.isPublic && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Your IP is currently under review. You'll be notified once it's approved.
                      Typical review time: 24-48 hours.
                    </p>
                  </div>
                )}
                
                {ipAsset.status === 'rejected' && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      This IP was rejected. Please review our guidelines and upload a new version
                      that meets our quality standards.
                    </p>
                  </div>
                )}
                
                {ipAsset.status === 'approved' && formData.isPublic && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      ✓ This IP is approved and available in the global library.
                    </p>
                  </div>
                )}
                
                {!formData.isPublic && (
                  <div className="p-3 bg-gray-500/10 border border-gray-500/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      🔒 This IP is private. Only you can see and use it.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1 bg-primary" id="ip-save-button">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
