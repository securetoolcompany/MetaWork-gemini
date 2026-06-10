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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, DollarSign, TrendingUp, Globe, Lock, Eye, EyeOff, Loader2, Tag, X, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const CATEGORY_UI_MAP = {
  'accessories': { title: 'Accessories & Apparel', icon: '🎽' },
  'home': { title: 'Home & Office', icon: '🏠' },
  'school': { title: 'School & University', icon: '🎓' },
  'default': { title: 'Other Categories', icon: '📦' }
};

function SortableThumbnail({ url, idx, previewIndex, setPreviewIndex, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        type="button"
        onClick={() => setPreviewIndex(idx)}
        {...attributes}
        {...listeners}
        className={`w-16 h-16 rounded-md overflow-hidden border-2 transition-colors cursor-grab active:cursor-grabbing ${
          idx === previewIndex ? 'border-primary' : 'border-border hover:border-primary/50'
        }`}
      >
        <img src={url} alt={`Mockup ${idx + 1}`} className="object-cover w-full h-full" />
      </button>

      {/* Primary badge on first */}
      {idx === 0 && (
        <div className="absolute -top-1.5 -left-1.5 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">
          1
        </div>
      )}

      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(idx)}
        className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove mockup"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}
export default function ProductEditDialog({ product, open, onOpenChange, tutorialStep, onSaveSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    tags: '',
    categories: [],
    isPublic: true
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const fileInputRef = useRef(null);
  
  const [groupedCategories, setGroupedCategories] = useState({});
  const [isFetchingCategories, setIsFetchingCategories] = useState(false);

  useEffect(() => {
    if (open) {
      const fetchCategories = async () => {
        setIsFetchingCategories(true);
        try {
          const res = await fetch('/api/admin/categories?includeInactive=true'); 
          const data = await res.json();
          if (data.success && data.categories) {
            
            // Group the database categories by their "type" (accessories, home, etc.)
            const grouped = data.categories.reduce((acc, cat) => {
              const groupKey = cat.type || 'default';
              if (!acc[groupKey]) acc[groupKey] = [];
              acc[groupKey].push(cat.name); // We extract just the name string so it saves properly
              return acc;
            }, {});
            
            setGroupedCategories(grouped);
          }
        } catch (error) {
          console.error('Failed to load categories:', error);
        } finally {
          setIsFetchingCategories(false);
        }
      };
      fetchCategories();
    }
  }, [open]);
  
  useEffect(() => {
    if (product) {
      const isProductLive = product.isPublic ?? product.isVisible ?? (product.status === 'live') ?? true;
      
      setFormData({
        name: product.name || product.title || '',
        description: product.description || 'A custom designed product featuring unique artwork',
        price: product.price || 0,
        tags: Array.isArray(product.tags) ? product.tags.join(', ') : (product.tags || ''),
        categories: Array.isArray(product.categories) ? product.categories : [],
        isPublic: isProductLive,
        mockups: product.mockups || [] 
      });
    }
  }, [product]);

  const baseProductCost = parseFloat(
    product?.baseProductCost ??
    product?.costAnalysis?.base
  ) || 0;

  console.log('[ProductEditDialog] cost fields:', {
  baseProductCost: product?.baseProductCost,
  retailCost: product?.retailCost,
  baseCost: product?.baseCost,
  cost: product?.cost,
  printfulRetailPrice: product?.printfulRetailPrice,
  basePrice: product?.basePrice,
  resolved: baseProductCost,
});

  const ipCosts = (() => {
    if (product?.ipUsages && Array.isArray(product.ipUsages)) {
      return product.ipUsages.map(usage => ({
        name: usage.name || usage.ipAssetId || 'IP Asset',
        cost: (parseFloat(usage.licensingFee) || 0) * (usage.quantity || 1),
        licensingFee: parseFloat(usage.licensingFee) || 0,
        quantity: usage.quantity || 1
      }));
    }
    if (product?.ipCosts && Array.isArray(product.ipCosts)) {
      return product.ipCosts.map(ip => ({
        name: ip.name || 'IP Asset',
        cost: parseFloat(ip.cost) || parseFloat(ip.licensingFee) || 0,
        licensingFee: parseFloat(ip.licensingFee) || parseFloat(ip.cost) || 0,
        quantity: 1
      }));
    }
    return [];
  })();
  
  const totalIPCost = ipCosts.reduce((sum, ip) => sum + ip.cost, 0);
  const totalProductionCost = baseProductCost + totalIPCost;
  const suggestedPrice = (totalProductionCost * 2.5).toFixed(2); 
  const profit = (formData.price - totalProductionCost).toFixed(2);
  const profitMargin = formData.price > 0 ? (((formData.price - totalProductionCost) / formData.price) * 100).toFixed(1) : 0;

  // Category Selection Handlers
  const handleSelectCategory = (categoryName) => {
    setFormData(prev => {
      const current = prev.categories || [];
      if (current.includes(categoryName)) return prev;
      
      if (current.length >= 3) {
        toast.warning('Category Limit Reached', {
          description: 'You can only assign up to 3 categories per product.'
        });
        return prev;
      }
      return { ...prev, categories: [...current, categoryName] };
    });
  };

  const handleRemoveCategory = (categoryName) => {
    setFormData(prev => ({
      ...prev,
      categories: (prev.categories || []).filter(cat => cat !== categoryName)
    }));
  };

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setFormData(prev => {
      const oldIndex = prev.mockups.indexOf(active.id);
      const newIndex = prev.mockups.indexOf(over.id);
      return { ...prev, mockups: arrayMove(prev.mockups, oldIndex, newIndex) };
    });
    setPreviewIndex(0);
  };

  const handleMockupUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setIsUploading(true);
    const tid = toast.loading(`Uploading ${files.length > 1 ? `${files.length} mockups` : 'mockup'}...`);

    try {
      const uploadedUrls = [];

      for (const file of files) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('folderContext', 'mockups');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formDataUpload,
        });

        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Upload failed');
        uploadedUrls.push(data.url);
      }

      setFormData(prev => ({
        ...prev,
        mockups: [...(prev.mockups || []), ...uploadedUrls],
      }));

      toast.success(
        uploadedUrls.length === 1 ? 'Mockup uploaded' : `${uploadedUrls.length} mockups uploaded`,
        { id: tid }
      );

    } catch (err) {
      toast.error(err.message, { id: tid });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  
  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      toast.error('Missing required fields', { description: 'Please fill in product name and price' });
      return;
    }

    if (formData.price < totalProductionCost) {
      toast.error('Price too low!', { description: `Price must be at least $${totalProductionCost.toFixed(2)} to cover costs` });
      return;
    }

    setIsLoading(true);

    try {
      const tagsArray = formData.tags ? formData.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
      const targetId = product.id || product._id;

      const response = await fetch(`/api/metawork/products/${targetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${document.cookie.split('auth_token=')[1]?.split(';')[0] || ''}`
        },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.name,
          name: formData.name, 
          description: formData.description,
          price: parseFloat(formData.price),
          tags: tagsArray,
          categories: formData.categories, // Now saving the exact strings from the Showroom
          isPublic: formData.isPublic,
          isVisible: formData.isPublic, 
          showroomListed: formData.isPublic,
          status: formData.isPublic ? 'live' : 'draft', 
          mockups: formData.mockups || [],
          mockupUrl: formData.mockups?.length > 0 ? formData.mockups[0] : undefined
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to update product');

      if (product?.isPublic && !formData.isPublic) {
        toast.success('Product unlisted from Aisle!');
      } else if (!product?.isPublic && formData.isPublic) {
        toast.success('Product listed on Aisle!');
      } else {
        toast.success('Product updated!');
      }
      
      onOpenChange(false);
      if (onSaveSuccess) onSaveSuccess();

    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save', { description: error.message || 'Please try again' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        if (tutorialStep >= 3 && tutorialStep <= 8) return;
        if (!isLoading) onOpenChange(newOpen);
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
          {/* ================= LEFT COLUMN ================= */}
          <div className="space-y-6">
            
            {/* 1. Product Preview */}
            <Card className="border-border bg-card">
              <CardContent className="p-4 space-y-3">
                {/* Large preview */}
                <div className="aspect-square relative rounded-lg overflow-hidden bg-muted">
                  <img
                    src={formData.mockups?.length > 0
                      ? formData.mockups[previewIndex] ?? formData.mockups[0]
                      : (product.imageUrl || product.thumbnailUrl || product.mockupUrl || '/placeholder.png')}
                    alt={formData.name}
                    className="object-cover w-full h-full"
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                    </div>
                  )}
                </div>

                {/* Thumbnail strip */}
                {formData.mockups?.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={formData.mockups} strategy={horizontalListSortingStrategy}>
                    <div className="flex gap-2 flex-wrap">
                      {formData.mockups.map((url, idx) => (
                        <SortableThumbnail
                          key={url}
                          url={url}
                          idx={idx}
                          previewIndex={previewIndex}
                          setPreviewIndex={setPreviewIndex}
                          onRemove={(i) => {
                            const updated = formData.mockups.filter((_, j) => j !== i);
                            setFormData(prev => ({ ...prev, mockups: updated }));
                            setPreviewIndex(prev => Math.max(0, prev >= i ? prev - 1 : prev));
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

                <p className="text-xs text-muted-foreground">
                  {formData.mockups?.length > 0
                    ? `${formData.mockups.length} mockup${formData.mockups.length !== 1 ? 's' : ''} · First image is the storefront primary`
                    : 'No mockups yet — upload one below'}
                </p>

                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleMockupUpload} />

                <Button type="button" variant="outline" className="w-full" size="sm" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {formData.mockups?.length > 0 ? 'Upload More Mockups' : 'Upload Mockup'}
                </Button>
              </CardContent>
            </Card>

            {/* 2. Basic Info & Categories */}
            <div className="space-y-4" id="product-basic-info">
              
              <div className="space-y-2" id="product-name-field">
                <Label htmlFor="name">Product Name *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={isLoading} />
              </div>
              
              <div className="space-y-2" id="product-description-field">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} disabled={isLoading} className="min-h-[100px]" />
              </div>
              
              {/* Category Picker - using exactly the Showroom PILLAR_SECTIONS */}
              <div className="space-y-2 pt-2 pb-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-primary" /> 
                    Showroom Categories
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {formData.categories.length}/3 Selected
                  </span>
                </div>
                
                <Select onValueChange={handleSelectCategory} value="" disabled={formData.categories.length >= 3}>
                  <SelectTrigger className="w-full bg-background border-border">
                    <SelectValue placeholder="Browse and add a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {isFetchingCategories ? (
                      <SelectItem value="loading" disabled>Loading categories...</SelectItem>
                    ) : Object.keys(groupedCategories).length === 0 ? (
                      <SelectItem value="empty" disabled>No categories configured</SelectItem>
                    ) : (
                      Object.entries(groupedCategories).map(([groupKey, categories]) => {
                        const ui = CATEGORY_UI_MAP[groupKey] || CATEGORY_UI_MAP['default'];
                        return (
                          <SelectGroup key={groupKey}>
                            <SelectLabel className="uppercase tracking-wider text-xs text-primary bg-muted/50 mt-1 first:mt-0 px-2 py-1.5">
                              {ui.icon} {ui.title}
                            </SelectLabel>
                            {categories.map(catName => (
                              <SelectItem 
                                key={catName} 
                                value={catName}
                                disabled={formData.categories.includes(catName)}
                                className="pl-6"
                              >
                                {catName}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>

                {/* Selected Categories Visuals */}
                {formData.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formData.categories.map(catName => (
                      <Badge key={catName} variant="secondary" className="flex items-center gap-1 py-1 px-2 border-white/10">
                        {catName}
                        <button 
                          type="button" 
                          onClick={(e) => { e.preventDefault(); handleRemoveCategory(catName); }}
                          className="ml-1 hover:bg-red-500/20 hover:text-red-400 rounded-full p-0.5 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  Help buyers discover your item in the global MetaWork showroom.
                </p>
              </div>

              <div className="space-y-2" id="product-tags-field">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input id="tags" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} disabled={isLoading} />
              </div>

              {/* Base Product display */}
              <div className="space-y-2 pt-2">
                <Label>Base Product</Label>
                <div className="p-3 bg-muted rounded-lg border border-border">
                  <p className="text-sm font-medium">{product.baseProduct || product.catalogProductName || 'Custom Product'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ================= RIGHT COLUMN ================= */}
          <div className="space-y-6">
            
            {/* 1. Aisle Visibility Toggle */}
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
                    {formData.isPublic ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-gray-500" />}
                    <Switch
                      id="isPublicProduct"
                      checked={formData.isPublic}
                      onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formData.isPublic ? '👁️ Visible on your public Aisle. Ready for customers to purchase.' : '🔒 Hidden from your Aisle. Product saved but not available for sale.'}
                </p>
                {!formData.isPublic && product.salesCount > 0 && (
                  <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-muted-foreground mt-2">
                    ℹ️ This product has {product.salesCount} sales. De-listing hides it from new customers but keeps your earnings history.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 2. Pricing Card */}
            <Card className="border-border bg-card" id="product-pricing">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /> Pricing</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2" id="product-price-field">
                  <Label htmlFor="price">Retail Price *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input id="price" type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} className="pl-7 bg-background border-border" disabled={isLoading} />
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

            {/* 3. Cost Breakdown Card */}
            <Card className="border-border bg-card">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Cost Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Base Product</span><span className="font-medium">${baseProductCost.toFixed(2)}</span></div>
                
                {ipCosts.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">IP Royalties</span><span className="font-medium">${totalIPCost.toFixed(2)}</span></div>
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
                <div className="flex items-center justify-between font-semibold"><span>Total Production Cost</span><span className="text-orange-500">${totalProductionCost.toFixed(2)}</span></div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between font-semibold"><span>Profit per Sale</span><span className={profit >= 0 ? 'text-green-500' : 'text-red-500'}>${profit}</span></div>
                
                {/* Margin Display */}
                <div className="p-3 rounded-lg mt-4" style={{
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

            {/* 4. Performance Stats Card */}
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
                  <Badge className={product.status === 'live' || product.showroomListed || product.isPublic || product.isVisible ? 'bg-green-600' : 'bg-gray-600'}>
                    {product.status === 'live' || product.showroomListed || product.isPublic || product.isVisible ? 'Live' : 'Draft'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={isLoading}>Cancel</Button>
          <Button onClick={handleSave} className="flex-1 bg-primary" id="product-save-button" disabled={isLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}