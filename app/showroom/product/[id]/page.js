'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  ShoppingCart,
  Star,
  TrendingUp,
  Heart,
  Share2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import AisleAdPlacement from '@/components/aisle-public/AisleAdPlacement';
import ShowroomNav from '@/components/showroom/ShowroomNav';
import { useCart } from '@/lib/CartContext';

// Mock reviews for now
const mockReviews = [
  {
    id: 1,
    author: 'Sarah M.',
    rating: 5,
    date: '2024-01-15',
    comment:
      'Amazing quality! The design is even better in person. Highly recommend!',
    verified: true,
  },
  {
    id: 2,
    author: 'Mike R.',
    rating: 5,
    date: '2024-01-12',
    comment:
      'Perfect fit and the print quality is outstanding. Will definitely buy more!',
    verified: true,
  },
  {
    id: 3,
    author: 'Emma L.',
    rating: 4,
    date: '2024-01-10',
    comment: 'Great product! Only wish it came in more colors.',
    verified: true,
  },
  {
    id: 4,
    author: 'Alex K.',
    rating: 5,
    date: '2024-01-08',
    comment:
      'Fast shipping and excellent customer service. Love the design!',
    verified: false,
  },
];

function normalizeImageUrl(url) {
  if (!url) return null;
  if (typeof url === 'object') {
    url = url.secure_url || url.url;
  }
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed === 'https://files.cdn.printful.com/') return null;
  if (trimmed.includes('/undefined')) return null;
  if (trimmed.includes('null')) return null;

  return trimmed.startsWith('//') ? 'https:' + trimmed : trimmed;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id;
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [creator, setCreator] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedSize, setSelectedSize] = useState('M');
  const [quantity, setQuantity] = useState(1);
  const [isFavorited, setIsFavorited] = useState(false);

  // Fetch product from API
  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        const response = await fetch(`/api/products/${productId}`);
        const data = await response.json();

        if (data.success) {
          const safeProduct = {
            ...data.product,
            description:
              typeof data.product.description === 'string'
                ? data.product.description
                : null,
          };
          setProduct(safeProduct);
          setCreator(data.creator);
          setRelatedProducts(data.relatedProducts || []);
        } else {
          setError(data.error || 'Product not found');
        }
      } catch (err) {
        console.error('Error fetching product:', err);
        setError('Failed to load product');
      } finally {
        setLoading(false);
      }
    }

    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product, {
      size: selectedSize,
      // color not wired here; keep shape for CartContext
      color: null,
      quantity,
    });
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: product?.title || product?.name || 'Product',
        text: 'Check out this product on MetaWork Showroom!',
        url,
      });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    }
  };

  // Sizes from variants (if present)
  const uniqueSizes = (product?.variants || [])
    .map((v) => v.size)
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <ShowroomNav />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading product...</span>
        </div>
      </div>
    );
  }

  // Error or not found
  if (error || !product) {
    return (
      <div className="min-h-screen bg-background">
        <ShowroomNav />
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Product Not Found</h1>
            <p className="text-muted-foreground mb-6">
              {error || "This product doesn't exist or has been removed."}
            </p>
            <Link href="/showroom">
              <Button>Back to Showroom</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- image logic (mirrors modal) ----
  const preferredImageSet =
    (Array.isArray(product?.mockups) && product.mockups.length > 0
      ? product.mockups
      : null) ||
    (Array.isArray(product?.mockupImages) && product.mockupImages.length > 0
      ? product.mockupImages
      : null) ||
    (Array.isArray(product?.images) && product.images.length > 0
      ? product.images
      : null) ||
    (product?.imageUrl ? [product.imageUrl] : null) ||
    (product?.thumbnailUrl ? [product.thumbnailUrl] : null) ||
    (product?.mockupUrl ? [product.mockupUrl] : null) ||
    (product?.image ? [product.image] : null) ||
    [];

  const galleryImages = Array.from(
    new Set(
      preferredImageSet
        .map((img) => normalizeImageUrl(img))
        .filter(Boolean)
    )
  );
  const safeGalleryImages =
    galleryImages.length > 0 ? galleryImages : ['/placeholder.png'];

  const productImage = safeGalleryImages[0];

  // ---- derived display values ----
  const productName = String(product.title || product.name || 'Product');
  const productPrice =
    typeof product.price === 'number' ? product.price : 0;

  const productDescription =
    typeof product.description === 'string'
      ? product.description
      : 'This unique design combines style and comfort. Perfect for everyday wear or special occasions.';
  const productBaseType = String(
    product.baseProduct || product.catalogProductName || 'Product'
  );
  const salesCount =
    typeof product.salesCount === 'number' ? product.salesCount : 0;
  const creatorSlug = String(creator?.username || creator?.id || 'unknown');

  const averageRating =
    mockReviews.length > 0
      ? mockReviews.reduce((sum, r) => sum + r.rating, 0) / mockReviews.length
      : 4.8;

  return (
    <div className="min-h-screen bg-background">
      <ShowroomNav />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/showroom" className="hover:text-foreground">
            Showroom
          </Link>
          <span>/</span>
          <span className="text-foreground">{productName}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Product Image + Gallery */}
              <div className="space-y-4">
                <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  {productImage ? (
                    <Image
                      src={productImage}
                      alt={productName}
                      fill
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      No Image
                    </div>
                  )}
                  {salesCount > 20 && (
                    <Badge className="absolute top-4 right-4 bg-red-500 text-white">
                      🔥 Trending
                    </Badge>
                  )}
                </div>

                {/* Thumbnail Gallery */}
                {safeGalleryImages.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {safeGalleryImages.slice(0, 4).map((img, i) => (
                      <div
                        key={img + '-' + i}
                        className="relative aspect-square rounded-md overflow-hidden border-2 border-primary cursor-pointer bg-muted"
                      >
                        <Image
                          src={img || '/placeholder.png'}
                          alt={'View ' + (i + 1)}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Info + Controls */}
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{productName}</h1>
                  <p className="text-muted-foreground">{productBaseType}</p>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={
                          'w-5 h-5 ' +
                          (star <= Math.round(averageRating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300')
                        }
                      />
                    ))}
                  </div>
                  <span className="font-semibold">
                    {averageRating.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground">
                    ({mockReviews.length} reviews)
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">
                    {salesCount} sold
                  </span>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold text-primary">
                    ${productPrice.toFixed(2)}
                  </span>
                  <span className="text-xl text-muted-foreground line-through">
                    ${(productPrice * 1.3).toFixed(2)}
                  </span>
                  <Badge variant="secondary">Save 30%</Badge>
                </div>

                <Separator />

                {/* Size Selector */}
                {uniqueSizes.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold mb-3">
                      Available Sizes
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {uniqueSizes.map((size) => (
                        <Button
                          key={size}
                          variant={
                            selectedSize === size ? 'default' : 'outline'
                          }
                          onClick={() => setSelectedSize(size)}
                          className="min-w-[64px]"
                        >
                          {size}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-semibold mb-3">
                    Quantity
                  </label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setQuantity((q) => Math.max(1, q - 1))
                      }
                    >
                      -
                    </Button>
                    <span className="w-12 text-center font-bold text-lg">
                      {quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity((q) => q + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Main Actions */}
                <div className="space-y-3">
                  <Button
                    className="w-full text-lg py-7 shadow-lg"
                    onClick={handleAddToCart}
                  >
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    Add to Cart - ${(productPrice * quantity).toFixed(2)}
                  </Button>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setIsFavorited(!isFavorited)}
                      className="gap-2"
                    >
                      <Heart
                        className={
                          'w-5 h-5 ' +
                          (isFavorited
                            ? 'fill-red-500 text-red-500 border-none'
                            : '')
                        }
                      />
                      {isFavorited ? 'Saved' : 'Save'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleShare}
                      className="gap-2"
                    >
                      <Share2 className="w-5 h-5" />
                      Share
                    </Button>
                  </div>
                </div>

                {/* Navigation */}
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <Link href="/showroom">
                    <Button variant="outline" className="w-full gap-2">
                      <ArrowLeft className="w-4 h-4" />
                      Back to Showroom
                    </Button>
                  </Link>
                  {creator && (
                    <Link href={`/aisle/${creatorSlug}`}>
                      <Button variant="outline" className="w-full gap-2">
                        Visit Creator's Aisle
                        <TrendingUp className="w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Info Tabs */}
            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Product Specs</TabsTrigger>
                <TabsTrigger value="shipping">Shipping & Returns</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Product Description
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {productDescription}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-bold text-foreground block mb-1">
                        Fulfillment
                      </span>
                      <span className="text-muted-foreground">
                        Direct-to-Garment (DTG)
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-foreground block mb-1">
                        Production
                      </span>
                      <span className="text-muted-foreground">
                        On-demand (approx. 2-5 days)
                      </span>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="shipping" className="mt-6">
                <Card className="p-6 text-muted-foreground">
                  Orders are typically delivered within 10 - 14 business days.
                  Shipping rates and delivery estimates are calculated at
                  checkout based on your location.
                </Card>
              </TabsContent>
            </Tabs>

            {/* Related Products */}
            {relatedProducts.length > 0 && (
              <div>
                <h3 className="text-2xl font-bold mb-6">You May Also Like</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {relatedProducts.map((relatedProduct) => (
                    <Link
                      key={relatedProduct.id}
                      href={`/showroom/product/${relatedProduct.id}`}
                    >
                      <Card className="group overflow-hidden cursor-pointer transition-all hover:shadow-lg">
                        <div className="relative aspect-square overflow-hidden bg-muted">
                          {relatedProduct.imageUrl ? (
                            <Image
                              src={relatedProduct.imageUrl}
                              alt={
                                String(
                                  relatedProduct.name ||
                                    relatedProduct.title ||
                                    'Product'
                                )
                              }
                              fill
                              className="object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              No Image
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h4 className="font-semibold text-sm mb-1 line-clamp-1">
                            {String(
                              relatedProduct.name ||
                                relatedProduct.title ||
                                'Product'
                            )}
                          </h4>
                          <p className="text-lg font-bold text-primary">
                            $
                            {(
                              typeof relatedProduct.price === 'number'
                                ? relatedProduct.price
                                : 0
                            ).toFixed(2)}
                          </p>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-20 space-y-6">
              <AisleAdPlacement type="sidebar" accentColor="#3b82f6" />

              {creator && (
                <Card className="p-4">
                  <h4 className="font-semibold mb-3">About the Creator</h4>
                  <Link href={`/aisle/${creatorSlug}`}>
                    <div className="flex items-center gap-3 mb-3 cursor-pointer hover:opacity-80">
                      <div className="relative w-12 h-12 rounded-full overflow-hidden bg-muted">
                        {creator.avatar ? (
                          <Image
                            src={creator.avatar}
                            alt={creator.name || 'Creator'}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                            {(creator.name || 'C')[0]}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">
                          {String(
                            creator.name || creator.username || 'Creator'
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @{String(creator.username || 'creator')}
                        </p>
                      </div>
                    </div>
                  </Link>
                  {creator.bio && typeof creator.bio === 'string' && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {creator.bio}
                    </p>
                  )}
                  <Link href={`/aisle/${creatorSlug}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      Visit Aisle
                    </Button>
                  </Link>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}