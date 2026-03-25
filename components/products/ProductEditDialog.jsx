'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Upload, DollarSign, TrendingUp, Globe, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

// Base product cost fallback mapping
const BASE_PRODUCT_COST_FALLBACK = {
  "Men's T-Shirt": 12.50,
  "Women's T-Shirt": 12.50,
  "Unisex Hoodie": 25.00,
  "11oz Mug": 8.00,
  "Sticker Sheet": 4.50,
  "Tote Bag": 10.00
};

export default function ProductEditDialog({ product, open, onOpenChange, tutorialStep, onSaveSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    tags: '',
    isPublic: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || product.title || '',
        description: product.description || 'A custom designed product featuring unique artwork',
        price: product.price || 0,
        tags: Array.isArray(product.tags) ? product.tags.join(', ') : (product.tags || ''),
        isPublic: product.isPublic !== undefined ? product.isPublic : true,
        mockups: product.mockups || [] // Keep track of these
      });
    }
  }, [product]);

  // Calculate costs dynamically from product data
  const baseProductCost = product?.baseProductCost || 
    BASE_PRODUCT_COST_FALLBACK[product?.baseProduct] || 
    12.50;

  // Calculate IP costs from product.ipUsages or product.ipCosts
  const ipCosts = (() => {
    // Use ipUsages if available (new format with quantity)
    if (product?.ipUsages && Array.isArray(product.ipUsages)) {
      return product.ipUsages.map(usage => ({
        name: usage.name || usage.ipAssetId || 'IP Asset',
        cost: (usage.licensingFee || 0) * (usage.quantity || 1),
        licensingFee: usage.licensingFee || 0,
        quantity: usage.quantity || 1
      }));
    }
    // Fallback to ipCosts array if available
    if (product?.ipCosts && Array.isArray(product.ipCosts)) {
      return product.ipCosts.map(ip => ({
        name: ip.name || 'IP Asset',
        cost: ip.cost || ip.licensingFee || 0,
        licensingFee: ip.licensingFee || ip.cost || 0,
        quantity: 1
      }));
    }
    // Return empty array if no IP costs data
    return [];
  })();
  
  const totalIPCost = ipCosts.reduce((sum, ip) => sum + ip.cost, 0);
  const totalProductionCost = baseProductCost + totalIPCost;
  const suggestedPrice = (totalProductionCost * 2.5).toFixed(2); // 150% markup
  const profit = (formData.price - totalProductionCost).toFixed(2);
  const profitMargin = formData.price > 0 ? (((formData.price - totalProductionCost) / formData.price) * 100).toFixed(1) : 0;

  const handleMockupUpload = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setIsUploading(true);
  const tid = toast.loading("Uploading mockup...");

  try {
    // Determine the owner ID
    const userId = product.userId || product.creatorId || 'anonymous';
    
    // 🔥 Define the sub-path relative to the MetaWork root
    const folderContext = `users/${userId}/mockups`;

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    formDataUpload.append('folderContext', folderContext); // Pass the path here

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formDataUpload,
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");

    // Success logic remains the same...
    const updatedMockups = [...(formData.mockups || []), data.url];
    
    // ... immediate DB save call ...
    
    setFormData(prev => ({ ...prev, mockups: updatedMockups }));
    toast.success("Mockup saved", { id: tid });

  } catch (err) {
    toast.error(err.message, { id: tid });
  } finally {
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
};
  
  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      toast.error('Missing required fields', {
        description: 'Please fill in product name and price'
      });
      return;
    }

    if (formData.price < totalProductionCost) {
      toast.error('Price too low!', {
        description: `Price must be at least $${totalProductionCost.toFixed(2)} to cover costs`
      });
      return;
    }

    setIsLoading(true);

    try {
      // Prepare tags array
      const tagsArray = formData.tags
        ? formData.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
        : [];

      // Make API request to update product
      const response = await fetch(`/api/metawork/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${document.cookie.split('auth_token=')[1]?.split(';')[0] || ''}`
        },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
          tags: tagsArray,
          isPublic: formData.isPublic,
          showroomListed: formData.isPublic,
          status: formData.isPublic ? 'live' : 'draft'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update product');
      }

      // Show appropriate toast message based on visibility change
      if (product?.isPublic && !formData.isPublic) {
        toast.success('Product unlisted from Aisle!', {
          description: 'Hidden from customers. You can re-list anytime.'
        });
      } else if (!product?.isPublic && formData.isPublic) {
        toast.success('Product listed on Aisle!', {
          description: 'Now visible to customers for purchase.'
        });
      } else {
        toast.success('Product updated!', {
          description: 'Your changes have been saved'
        });
      }
      
      // Close dialog
      onOpenChange(false);
      
      // Trigger refresh callback if provided
      if (onSaveSuccess) {
        onSaveSuccess();
      }

    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save', {
        description: error.message || 'Please try again'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        // Prevent closing dialog during tutorial steps 3-8 (when user is editing fields)
        if (tutorialStep >= 3 && tutorialStep <= 8) {
          // Don't allow closing during these steps
          return;
        }
        if (!isLoading) {
          onOpenChange(newOpen);
        }
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Edit Product</DialogTitle>
          <DialogDescription>
            Update your product details, pricing, and visibility
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column - Product Details */}
          <div className="space-y-6">
            {/* Product Preview */}
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="aspect-square relative rounded-lg overflow-hidden bg-muted mb-3">
                  <img
                    src={formData.mockups?.length > 0 
                      ? formData.mockups[formData.mockups.length - 1] 
                      : (product.imageUrl || product.thumbnailUrl || '/placeholder.png')}
                    alt={formData.name}
                    className="object-cover w-full h-full"
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                    </div>
                  )}
                </div>

                {/* THE HIDDEN INPUT */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleMockupUpload} 
                />

                <Button 
                  type="button"
                  variant="outline" 
                  className="w-full" 
                  size="sm" 
                  disabled={isUploading} 
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Upload New Mockup
                </Button>
              </CardContent>
            </Card>

            {/* Aisle Visibility Toggle */}
            <Card className="border-border bg-card" id="product-visibility">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="isPublicProduct" className="text-base font-semibold">
                      {formData.isPublic ? 'Listed on Aisle' : 'Unlisted'}
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p><strong>Listed:</strong> Visible on your public Aisle. Customers can purchase.</p>
                          <p className="mt-1"><strong>Unlisted:</strong> Hidden from Aisle. You keep the product but it can't be purchased.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-2">
                    {formData.isPublic ? (
                      <Eye className="h-4 w-4 text-green-500" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    )}
                    <Switch
                      id="isPublicProduct"
                      checked={formData.isPublic}
                      onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formData.isPublic ? (
                    <>👁️ Visible on your public Aisle. Ready for customers to purchase.</>
                  ) : (
                    <>🔒 Hidden from your Aisle. Product saved but not available for sale.</>
                  )}
                </p>
                {!formData.isPublic && product.salesCount > 0 && (
                  <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-muted-foreground">
                    ℹ️ This product has {product.salesCount} sales. De-listing hides it from new customers but keeps your earnings history.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Basic Info */}
            <div className="space-y-4" id="product-basic-info">
              <div className="space-y-2" id="product-name-field">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter product name"
                  className="bg-background border-border"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2" id="product-description-field">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your product..."
                  className="bg-background border-border min-h-[100px]"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2" id="product-tags-field">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="e.g. vintage, cool, urban"
                  className="bg-background border-border"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label>Base Product</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">{product.baseProduct || product.catalogProductName || 'Custom Product'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Pricing & Costs */}
          <div className="space-y-6">
            {/* Pricing */}
            <Card className="border-border bg-card" id="product-pricing">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2" id="product-price-field">
                  <Label htmlFor="price">Retail Price *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className="pl-7 bg-background border-border"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Suggested Price:</span>
                    <span className="font-semibold text-green-500">${suggestedPrice}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Based on 150% markup for healthy profit margin
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Cost Breakdown */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Cost Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Base Product Cost */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Base Product</span>
                  <span className="font-medium">${baseProductCost.toFixed(2)}</span>
                </div>

                {/* IP Costs */}
                {ipCosts.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">IP Royalties</span>
                      <span className="font-medium">${totalIPCost.toFixed(2)}</span>
                    </div>
                    <div className="pl-4 space-y-1">
                      {ipCosts.map((ip, index) => (
                        <div key={index} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <Badge variant="secondary" className="h-5 px-2 text-xs">IP</Badge>
                            {ip.name}
                            {ip.quantity > 1 && <span className="text-primary">×{ip.quantity}</span>}
                          </span>
                          <span className="text-muted-foreground">
                            ${ip.licensingFee.toFixed(2)} {ip.quantity > 1 && `× ${ip.quantity} = $${ip.cost.toFixed(2)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ipCosts.length === 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">IP Royalties</span>
                    <span className="text-muted-foreground">$0.00</span>
                  </div>
                )}

                <Separator className="bg-border" />

                {/* Total Production Cost */}
                <div className="flex items-center justify-between font-semibold">
                  <span>Total Production Cost</span>
                  <span className="text-orange-500">${totalProductionCost.toFixed(2)}</span>
                </div>

                <Separator className="bg-border" />

                {/* Profit */}
                <div className="flex items-center justify-between font-semibold">
                  <span>Profit per Sale</span>
                  <span className={profit >= 0 ? 'text-green-500' : 'text-red-500'}>
                    ${profit}
                  </span>
                </div>

                {/* Profit Margin */}
                <div className="p-3 rounded-lg" style={{
                  background: profitMargin >= 40 ? 'rgba(34, 197, 94, 0.1)' : 
                             profitMargin >= 20 ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)'
                }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Profit Margin</span>
                    <span className={`text-lg font-bold ${
                      profitMargin >= 40 ? 'text-green-500' : 
                      profitMargin >= 20 ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {profitMargin}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {profitMargin >= 40 ? '✓ Excellent margin' : 
                     profitMargin >= 20 ? '⚠ Acceptable margin' : '⚠ Low margin - consider raising price'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Product Stats */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Sales</span>
                  <span className="font-semibold">{product.salesCount || 0} units</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Earnings</span>
                  <span className="font-semibold text-green-500">${(product.earnings || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={product.status === 'live' || product.showroomListed ? 'bg-green-600' : 'bg-gray-600'}>
                    {product.status === 'live' || product.showroomListed ? 'Live' : 'Draft'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="flex-1"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            className="flex-1 bg-primary" 
            id="product-save-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
