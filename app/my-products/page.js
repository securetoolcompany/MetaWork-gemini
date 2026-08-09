'use client';

import React from "react";
import { useState, useEffect, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Palette, Edit, BarChart3, Trash2, Grid3x3, List, ExternalLink, Wand2, Loader2, AlertCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ProductEditDialog from '@/components/products/ProductEditDialog';
import { cn } from '@/lib/utils';
import TutorialOverlay from '@/components/onboarding/TutorialOverlay';
import { toast } from 'sonner';

export default function MyProductsPage() {
  return (
    <Suspense fallback={null}>
      <MyProductsInner />
    </Suspense>
  );
}

function MyProductsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTutorial = searchParams.get('tutorial') === 'true';
  
  const [products, setProducts] = useState([]); // Real data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // --- NEW: Fetch Real Products from DB ---
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        // Using the same endpoint we use for creating/getting products
            const response = await fetch('/api/metawork/products/list', {
              cache: 'no-store',
            });


        const data = await response.json();

        if (!response.ok) {
            // If 401, likely just not logged in or no wallet connected yet
            if (response.status === 401) {
                console.log('User not authenticated');
                setProducts([]);
                return;
            }
            throw new Error(data.error || 'Failed to fetch products');
        }

        const mappedProducts = (data.products || []).map(p => {
          const internalId = p.id || p._id?.toString(); 
          
          return {
            ...p,
            id: internalId,
            name: p.name || p.title || 'Untitled Product',
            // ✅ FIX: Point to p.imageUrl which is provided by our API
            mockupUrl: p.imageUrl || p.mockupUrl || 'https://placehold.co/400x400?text=No+Preview',
            imageUrl: p.imageUrl || p.mockupUrl || p.image || 'https://placehold.co/400x400?text=No+Preview', 
            baseProduct: p.catalogProductName || p.baseProduct?.name || 'Custom Product',
            price: parseFloat(p.price) || 0,
            salesCount: p.salesCount || 0,
            earnings: p.earnings || 0, 
            status: p.status || 'draft',
            isPublic: p.isPublic || false
          };
        });


        setProducts(mappedProducts);
        console.log('Mapped products from API:', mappedProducts);

      } catch (err) {
        console.error('Error loading products:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [refreshTrigger]);
  // ----------------------------------------

  useEffect(() => {
    if (isTutorial) {
      setTutorialStep(1);
    }
  }, [isTutorial]);

  const filteredProducts = products.filter(product => {
    if (filter === 'all') return true;
    if (filter === 'published') return ['live', 'active'].includes(product.status);
    if (filter === 'draft') return product.status === 'draft' || product.isDraft === true;
    return true;
  });

  // Sort logic (Simple client-side sort)
  const sortedProducts = [...filteredProducts].sort((a, b) => {
      if (sort === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sort === 'best-selling') return b.salesCount - a.salesCount;
      if (sort === 'highest-earning') return b.earnings - a.earnings;
      return 0;
  });

  const handleEdit = (product) => {
    setEditingProduct(product);
    setEditDialogOpen(true);
    if (tutorialStep === 2) {
      setTimeout(() => setTutorialStep(3), 1200);
    }
  };

  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
    if (tutorialStep === 9) {
      setTimeout(() => setTutorialStep(10), 500);
    }
    router.refresh(); 
    setRefreshTrigger(prev => prev + 1);
  };

  const handleTutorialNext = () => {
    const currentStep = tutorialSteps[tutorialStep - 1];
    if (currentStep?.requiresAction) {
      if (tutorialStep === 2 && !editDialogOpen) {
        toast.info('Please click the Edit button', { description: 'Click the highlighted Edit button to continue' });
        return;
      }
      if (tutorialStep === 9 && editDialogOpen) {
        toast.info('Please save your changes', { description: 'Click "Save Changes" to continue the tutorial' });
        return;
      }
    }
    setTutorialStep(tutorialStep + 1);
  };

  const handleTutorialSkip = () => {
    setTutorialStep(0);
    if (typeof window !== 'undefined') localStorage.removeItem('active_tutorial');
  };

  const handleTutorialComplete = () => {
    setTutorialStep(0);
    if (typeof window !== 'undefined') {
      const completed = JSON.parse(localStorage.getItem('onboarding_completed') || '{}');
      completed['edit-product'] = true;
      localStorage.setItem('onboarding_completed', JSON.stringify(completed));
      localStorage.removeItem('active_tutorial');
    }
  };

  const tutorialSteps = [
    { id: 1, title: 'Welcome to Product Editing! 🛍️', description: 'Learn how to manage your products!', targetSelector: null, position: 'center' },
    { id: 2, title: 'Step 1: Select a Product to Edit', description: 'Click "Edit" on a product card.', targetSelector: '#product-card-0', position: 'bottom', requiresAction: true },
    { id: 3, title: 'Edit Product Name', description: 'Change the display name.', targetSelector: '#product-name-field', position: 'right' },
    { id: 9, title: 'Save Your Changes', description: 'Click "Save Changes" to apply.', targetSelector: '#product-save-button', position: 'top', requiresAction: true },
    { id: 10, title: 'Tutorial Complete! 🎉', description: 'You can edit any product anytime!', targetSelector: null, position: 'center' }
  ];

  const currentTutorialStep = tutorialSteps[tutorialStep - 1];
  const shouldShowTutorial = tutorialStep > 0 && tutorialStep <= tutorialSteps.length;

  return (
    <div className="flex flex-col h-full">
      <h1 className="text-2xl font-bold tracking-tight">
              My Products
            </h1>
      
      <div className="flex-1 p-4 md:p-8 space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full sm:w-40 bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full sm:w-48 bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="best-selling">Best Selling</SelectItem>
                <SelectItem value="highest-earning">Highest Earning</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('grid')} className="flex-1 sm:flex-initial">
              <Grid3x3 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Grid</span>
            </Button>
            <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')} className="flex-1 sm:flex-initial">
              <List className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">List</span>
            </Button>
          </div>
        </div>

        {/* Loading / Error / Products */}
        {loading ? (
           <div className="flex items-center justify-center py-20">
             <Loader2 className="h-8 w-8 animate-spin text-primary" />
             <span className="ml-2 text-muted-foreground">Loading your products...</span>
           </div>
        ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-destructive">
                <AlertCircle className="h-10 w-10 mb-2" />
                <p>Failed to load products: {error}</p>
            </div>
        ) : sortedProducts.length > 0 ? (
          viewMode === 'grid' ? (
            // Grid View
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedProducts.map((product, index) => (
                <Card
                  key={product._id || product.id || `fallback-${index}`}
                  id={`product-card-${index}`}
                  className="group border-border bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                >
                  <div className="aspect-square relative overflow-hidden bg-muted">
                    {product.mockupUrl ? (
                      <img
                        src={product.mockupUrl}
                        alt={product.name}
                        className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-xs sm:text-sm text-muted-foreground">
                        Generating mockup…
                      </div>
                    )}


                    {/* Existing Draft/Published badge (top-right) */}
                    <div className="absolute top-2 right-2">
                      <Badge
                        className={
                          ['live', 'active'].includes(product.status)
                            ? 'bg-green-500 text-black'
                            : 'bg-yellow-400 text-black'
                        }
                      >
                        {['live', 'active'].includes(product.status) ? 'Published' : 'Draft'}
                      </Badge>
                    </div>

                    {/* NEW: base product badge on the image (bottom-left) */}
                    <div className="absolute bottom-2 left-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wide bg-black/70"
                      >
                        {product.baseProduct}
                      </Badge>
                    </div>

                      {!product.isPublic && ['live', 'active'].includes(product.status) && (                      <div className="absolute top-2 left-2">
                        <Badge className="bg-orange-600">Unlisted</Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3 sm:p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold text-foreground text-base sm:text-lg mb-1 line-clamp-1">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {product.baseProduct}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-base sm:text-lg font-bold text-foreground">${product.price.toFixed(2)}</span>
                      <span className="text-xs sm:text-sm text-muted-foreground">{product.salesCount} sold</span>
                    </div>
                    <div className="font-semibold text-green-500 text-sm sm:text-base">
                      ${product.earnings.toFixed(2)} earned
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEdit(product)}>
                        <Edit className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                      {product.externalProductId ? (
                        <Link href={`/products/creator?externalProductId=${product.externalProductId}&printfulTemplateId=${product.printfulTemplateId || ''}`}>
                          <Button size="sm" variant="outline" className="gap-1" title="Edit in Creator">
                            <Wand2 className="h-3 w-3" />
                            <span className="hidden sm:inline text-xs">Design</span>
                          </Button>
                        </Link>
                      ) : (
                        <Button size="sm" variant="outline" className="gap-1" disabled title="Missing design reference — needs data repair">
                          <Wand2 className="h-3 w-3" />
                          <span className="hidden sm:inline text-xs">Design</span>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // List View
            <div className="space-y-3">
              {sortedProducts.map((product) => (
                <Card key={product.id} className="border-border bg-card hover:shadow-lg transition-shadow">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex gap-3 sm:gap-4">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                      {product.mockupUrl ? (
                        <img
                          src={product.mockupUrl}
                          alt={product.name}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full text-[10px] sm:text-xs text-muted-foreground">
                          Generating mockup…
                        </div>
                      )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-foreground text-base sm:text-lg mb-1 truncate">
                              {product.name}
                            </h3>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                {product.baseProduct}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-2 self-start">
                            <Badge
                              className={cn(
                                ['live', 'active'].includes(product.status)
                                  ? 'bg-green-500 text-black'
                                  : 'bg-yellow-400 text-black'
                              )}
                            >
                              {['live', 'active'].includes(product.status) ? 'Published' : 'Draft'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(product)}>
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="rounded-full bg-muted p-6 mb-4">
              <Palette className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No products yet</h3>
            <p className="text-muted-foreground mb-6">Create your first product to get started</p>
            <div className="flex gap-3">
              <Button onClick={() => router.push('/products/creator')}>
                <Wand2 className="mr-2 h-4 w-4" />
                Create A Product
              </Button>
            </div>
          </div>
        )}
      </div>

      <ProductEditDialog
        product={editingProduct}
        open={editDialogOpen}
        onOpenChange={handleEditDialogClose}
        tutorialStep={tutorialStep}
      />

      {shouldShowTutorial && (
        <TutorialOverlay
          step={tutorialStep}
          totalSteps={tutorialSteps.length}
          title={currentTutorialStep.title}
          description={currentTutorialStep.description}
          targetSelector={currentTutorialStep.targetSelector}
          position={currentTutorialStep.position}
          onNext={handleTutorialNext}
          onPrev={() => setTutorialStep(tutorialStep - 1)}
          onSkip={handleTutorialSkip}
          onComplete={handleTutorialComplete}
          hideNextButton={currentTutorialStep.requiresAction}
        />
      )}
    </div>
  );
}
