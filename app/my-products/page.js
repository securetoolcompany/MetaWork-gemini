'use client';

import React, { Suspense, useEffect, useState } from 'react';
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
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Coins,
  Edit,
  Grid3x3,
  List,
  Loader2,
  Palette,
  Wand2,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ProductEditDialog from '@/components/products/ProductEditDialog';
import ProductTokenizationDialog from '@/components/products/ProductTokenizationDialog';
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

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');

  const [editingProduct, setEditingProduct] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [tokenizingProduct, setTokenizingProduct] = useState(null);
  const [tokenizationDialogOpen, setTokenizationDialogOpen] = useState(false);

  const [tutorialStep, setTutorialStep] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/metawork/products/list', {
          cache: 'no-store',
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            console.log('User not authenticated');
            setProducts([]);
            return;
          }

          throw new Error(data.error || 'Failed to fetch products');
        }

        const mappedProducts = (data.products || []).map((product) => {
          const internalId = product.id || product._id?.toString();

          return {
            ...product,
            id: internalId,
            name: product.name || product.title || 'Untitled Product',
            mockupUrl:
              product.imageUrl ||
              product.mockupUrl ||
              'https://placehold.co/400x400?text=No+Preview',
            imageUrl:
              product.imageUrl ||
              product.mockupUrl ||
              product.image ||
              'https://placehold.co/400x400?text=No+Preview',
            baseProduct:
              product.catalogProductName ||
              product.baseProduct?.name ||
              'Custom Product',
            price: parseFloat(product.price) || 0,
            salesCount: product.salesCount || 0,
            earnings: product.earnings || 0,
            status: product.status || 'draft',
            isPublic: product.isPublic || false,
            productRevenuePool: product.productRevenuePool || null,
          };
        });

        setProducts(mappedProducts);
      } catch (fetchError) {
        console.error('Error loading products:', fetchError);
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [refreshTrigger]);

  useEffect(() => {
    if (isTutorial) {
      setTutorialStep(1);
    }
  }, [isTutorial]);

  const filteredProducts = products.filter((product) => {
    if (filter === 'all') return true;

    if (filter === 'published') {
      return ['live', 'active'].includes(product.status);
    }

    if (filter === 'draft') {
      return product.status === 'draft' || product.isDraft === true;
    }

    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sort === 'newest') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }

    if (sort === 'best-selling') {
      return b.salesCount - a.salesCount;
    }

    if (sort === 'highest-earning') {
      return b.earnings - a.earnings;
    }

    return 0;
  });

  const handleEdit = (product) => {
    setEditingProduct(product);
    setEditDialogOpen(true);

    if (tutorialStep === 2) {
      setTimeout(() => setTutorialStep(3), 1200);
    }
  };

  const handleTokenize = (product) => {
    setTokenizingProduct(product);
    setTokenizationDialogOpen(true);
  };

  const handleEditDialogClose = () => {
    setEditDialogOpen(false);

    if (tutorialStep === 9) {
      setTimeout(() => setTutorialStep(10), 500);
    }

    router.refresh();
    setRefreshTrigger((previous) => previous + 1);
  };

  const handleTokenizationDialogChange = (nextOpen) => {
    setTokenizationDialogOpen(nextOpen);

    if (!nextOpen) {
      router.refresh();
      setRefreshTrigger((previous) => previous + 1);
    }
  };

  const handleTutorialNext = () => {
    const currentStep = tutorialSteps[tutorialStep - 1];

    if (currentStep?.requiresAction) {
      if (tutorialStep === 2 && !editDialogOpen) {
        toast.info('Please click the Edit button', {
          description: 'Click the highlighted Edit button to continue',
        });
        return;
      }

      if (tutorialStep === 9 && editDialogOpen) {
        toast.info('Please save your changes', {
          description: 'Click "Save Changes" to continue the tutorial',
        });
        return;
      }
    }

    setTutorialStep(tutorialStep + 1);
  };

  const handleTutorialSkip = () => {
    setTutorialStep(0);

    if (typeof window !== 'undefined') {
      localStorage.removeItem('active_tutorial');
    }
  };

  const handleTutorialComplete = () => {
    setTutorialStep(0);

    if (typeof window !== 'undefined') {
      const completed = JSON.parse(
        localStorage.getItem('onboarding_completed') || '{}'
      );

      completed['edit-product'] = true;

      localStorage.setItem(
        'onboarding_completed',
        JSON.stringify(completed)
      );

      localStorage.removeItem('active_tutorial');
    }
  };

  const getTokenizationState = (product) => {
    const tokenizationStatus =
      product?.productRevenuePool?.tokenizationStatus;

    return {
      status: tokenizationStatus,
      isActive: tokenizationStatus === 'active',
      isInProgress: [
        'pending_funding',
        'awaiting_funding_signature',
        'creating',
      ].includes(tokenizationStatus),
    };
  };

  const tutorialSteps = [
    {
      id: 1,
      title: 'Welcome to Product Editing! 🛍️',
      description: 'Learn how to manage your products!',
      targetSelector: null,
      position: 'center',
    },
    {
      id: 2,
      title: 'Step 1: Select a Product to Edit',
      description: 'Click "Edit" on a product card.',
      targetSelector: '#product-card-0',
      position: 'bottom',
      requiresAction: true,
    },
    {
      id: 3,
      title: 'Edit Product Name',
      description: 'Change the display name.',
      targetSelector: '#product-name-field',
      position: 'right',
    },
    {
      id: 9,
      title: 'Save Your Changes',
      description: 'Click "Save Changes" to apply.',
      targetSelector: '#product-save-button',
      position: 'top',
      requiresAction: true,
    },
    {
      id: 10,
      title: 'Tutorial Complete! 🎉',
      description: 'You can edit any product anytime!',
      targetSelector: null,
      position: 'center',
    },
  ];

  const currentTutorialStep = tutorialSteps[tutorialStep - 1];
  const shouldShowTutorial =
    tutorialStep > 0 && tutorialStep <= tutorialSteps.length;

  return (
    <div className="flex h-full flex-col">
      <h1 className="text-2xl font-bold tracking-tight">My Products</h1>

      <div className="flex-1 space-y-6 p-4 md:p-8">
        <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full border-border bg-card sm:w-40">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full border-border bg-card sm:w-48">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="best-selling">Best Selling</SelectItem>
                <SelectItem value="highest-earning">
                  Highest Earning
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="flex-1 sm:flex-initial"
            >
              <Grid3x3 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Grid</span>
            </Button>

            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="flex-1 sm:flex-initial"
            >
              <List className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">List</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">
              Loading your products...
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-destructive">
            <AlertCircle className="mb-2 h-10 w-10" />
            <p>Failed to load products: {error}</p>
          </div>
        ) : sortedProducts.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {sortedProducts.map((product, index) => {
                const tokenization = getTokenizationState(product);

                return (
                  <Card
                    key={product._id || product.id || `fallback-${index}`}
                    id={`product-card-${index}`}
                    className="group overflow-hidden border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="relative aspect-square overflow-hidden bg-muted">
                      {product.mockupUrl ? (
                        <img
                          src={product.mockupUrl}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground sm:text-sm">
                          Generating mockup…
                        </div>
                      )}

                      <div className="absolute right-2 top-2">
                        <Badge
                          className={
                            ['live', 'active'].includes(product.status)
                              ? 'bg-green-500 text-black'
                              : 'bg-yellow-400 text-black'
                          }
                        >
                          {['live', 'active'].includes(product.status)
                            ? 'Published'
                            : 'Draft'}
                        </Badge>
                      </div>

                      {!product.isPublic &&
                      ['live', 'active'].includes(product.status) ? (
                        <div className="absolute left-2 top-2">
                          <Badge className="bg-orange-600">Unlisted</Badge>
                        </div>
                      ) : null}

                      <div className="absolute bottom-2 left-2">
                        <Badge
                          variant="outline"
                          className="bg-black/70 text-[10px] uppercase tracking-wide"
                        >
                          {product.baseProduct}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="space-y-3 p-3 sm:p-4">
                      <div>
                        <h3 className="mb-1 line-clamp-1 text-base font-semibold text-foreground sm:text-lg">
                          {product.name}
                        </h3>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase tracking-wide"
                          >
                            {product.baseProduct}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-base font-bold text-foreground sm:text-lg">
                          ${product.price.toFixed(2)}
                        </span>

                        <span className="text-xs text-muted-foreground sm:text-sm">
                          {product.salesCount} sold
                        </span>
                      </div>

                      <div className="text-sm font-semibold text-green-500 sm:text-base">
                        ${product.earnings.toFixed(2)} earned
                      </div>

                      <div className="space-y-2 pt-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => handleEdit(product)}
                          >
                            <Edit className="mr-1 h-3.5 w-3.5" />
                            Edit
                          </Button>

                          {product.externalProductId ? (
                            <Link
                              className="w-full"
                              href={`/products/creator?externalProductId=${product.externalProductId}&printfulTemplateId=${product.printfulTemplateId || ''}`}
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                title="Edit in Creator"
                              >
                                <Wand2 className="mr-1 h-3.5 w-3.5" />
                                Design
                              </Button>
                            </Link>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              disabled
                              title="Missing design reference — needs data repair"
                            >
                              <Wand2 className="mr-1 h-3.5 w-3.5" />
                              Design
                            </Button>
                          )}
                        </div>

                        <Button
                          size="sm"
                          disabled={tokenization.isActive}
                          onClick={() => handleTokenize(product)}
                          className={cn(
                            'w-full justify-center gap-2 font-semibold transition-all duration-200',
                            tokenization.isActive
                              ? 'cursor-not-allowed bg-muted text-muted-foreground shadow-none hover:bg-muted'
                              : tokenization.isInProgress
                                ? 'bg-amber-500 text-black shadow-sm hover:bg-amber-600'
                                : 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow-md focus-visible:ring-emerald-500'
                          )}
                          title={
                            tokenization.isActive
                              ? 'Revenue pool is active'
                              : tokenization.isInProgress
                                ? 'Continue tokenization'
                                : 'Tokenize product'
                          }
                        >
                          {tokenization.isActive ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Tokenized
                            </>
                          ) : tokenization.isInProgress ? (
                            <>
                              <Clock3 className="h-4 w-4" />
                              Continue Tokenization
                            </>
                          ) : (
                            <>
                              <Coins className="h-4 w-4" />
                              Tokenize Product
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedProducts.map((product) => {
                const tokenization = getTokenizationState(product);

                return (
                  <Card
                    key={product.id}
                    className="border-border bg-card transition-shadow hover:shadow-lg"
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex gap-3 sm:gap-4">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-24 sm:w-24">
                          {product.mockupUrl ? (
                            <img
                              src={product.mockupUrl}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground sm:text-xs">
                              Generating mockup…
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                            <div className="min-w-0">
                              <h3 className="mb-1 truncate text-base font-semibold text-foreground sm:text-lg">
                                {product.name}
                              </h3>

                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] uppercase tracking-wide"
                                >
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
                                {['live', 'active'].includes(product.status)
                                  ? 'Published'
                                  : 'Draft'}
                              </Badge>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(product)}
                            >
                              <Edit className="mr-1 h-3 w-3" />
                              Edit
                            </Button>

                            <Button
                              size="sm"
                              disabled={tokenization.isActive}
                              onClick={() => handleTokenize(product)}
                              className={cn(
                                'min-w-44 justify-center gap-2 font-semibold transition-all',
                                tokenization.isActive
                                  ? 'cursor-not-allowed bg-muted text-muted-foreground shadow-none hover:bg-muted'
                                  : tokenization.isInProgress
                                    ? 'bg-amber-500 text-black hover:bg-amber-600'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500'
                              )}
                              title={
                                tokenization.isActive
                                  ? 'Revenue pool is active'
                                  : tokenization.isInProgress
                                    ? 'Continue tokenization'
                                    : 'Tokenize product'
                              }
                            >
                              {tokenization.isActive ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4" />
                                  Tokenized
                                </>
                              ) : tokenization.isInProgress ? (
                                <>
                                  <Clock3 className="h-4 w-4" />
                                  Continue Tokenization
                                </>
                              ) : (
                                <>
                                  <Coins className="h-4 w-4" />
                                  Tokenize Product
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="mb-4 rounded-full bg-muted p-6">
              <Palette className="h-12 w-12 text-muted-foreground" />
            </div>

            <h3 className="mb-2 text-xl font-semibold text-foreground">
              No products yet
            </h3>

            <p className="mb-6 text-muted-foreground">
              Create your first product to get started
            </p>

            <Button onClick={() => router.push('/products/creator')}>
              <Wand2 className="mr-2 h-4 w-4" />
              Create A Product
            </Button>
          </div>
        )}
      </div>

      <ProductEditDialog
        product={editingProduct}
        open={editDialogOpen}
        onOpenChange={handleEditDialogClose}
        tutorialStep={tutorialStep}
      />

      <ProductTokenizationDialog
        product={tokenizingProduct}
        open={tokenizationDialogOpen}
        onOpenChange={handleTokenizationDialogChange}
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