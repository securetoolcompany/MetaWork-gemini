'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  ShoppingCart,
  Star,
  MapPin,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Package,
  Ruler,
  Tag,
  User,
  MessageSquare,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { ShareButton } from '@/components/ui/share-button';

// ── REPO IMPROVEMENT #1: normalizeProduct extracted as a standalone utility ──
function normalizeProduct(rawProduct) {
  if (!rawProduct) return null;

  const existingVariations = Array.isArray(rawProduct.variations) ? rawProduct.variations : [];
  const creatorVariants = Array.isArray(rawProduct.variants) ? rawProduct.variants : [];
  const baseVariants = Array.isArray(rawProduct.baseProduct?.variants) ? rawProduct.baseProduct.variants : [];

  const normalizedVariations =
    existingVariations.length > 0
      ? existingVariations
      : creatorVariants.length > 0
        ? creatorVariants.map((v, index) => {
          const catalogVariantId =
            v.printful_id ??
            v.variantId ??
            v.variant_id ??
            v.id ??
            null;

          return {
            id: String(catalogVariantId || `creator-${index}`),
            catalogVariantId: catalogVariantId
              ? Number(catalogVariantId)
              : null,
            printfulVariantId: v.sync_variant_id ?? v.printfulVariantId ?? null,
            price: Number(v.retail_price ?? v.price ?? 0),
            image: v.image || null,
            name: v.name || '',
            attributes: {
              pa_color: v.color || null,
              pa_size: v.size || null,
            },
            in_stock: v.inStock ?? v.in_stock ?? true,
          };
        })
      : baseVariants.map((v, index) => ({
          id: String(v.id || `base-${index}`),
          printfulVariantId: v.id || null,
          price: Number(v.price ?? 0),
          image: v.image || null,
          name: v.name || '',
          attributes: {
            pa_color: v.color || null,
            pa_size: v.size || null,
          },
          in_stock: v.in_stock ?? true,
        }));

  return {
    ...rawProduct,
    variations: normalizedVariations,
  };
}

export default function ProductDetailDialog({
  open,
  onOpenChange,
  productId,
  asPage = false, // ── REPO IMPROVEMENT #4: asPage prop ──
}) {
  const router = useRouter();
  const { addToCart, loading: cartLoading } = useCart();
  const addingToCart = useRef(false);
  const [product, setProduct] = useState(null);
  const [creator, setCreator] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [currentMockupIndex, setCurrentMockupIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(null);

  // Reviews/Comments state
  const [reviews, setReviews] = useState([]);
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if ((open || asPage) && productId) {
      fetchProductDetails();
      fetchReviews();
      fetch(`/api/products/${productId}`, { method: 'POST' }).catch(() => {});
    } else if (!asPage) {
      setProduct(null);
      setCreator(null);
      setRelatedProducts([]);
      setReviews([]);
      setCurrentMockupIndex(0);
      setQuantity(1);
      setUserRating(0);
      setUserComment('');
      setSelectedVariation(null);
      setSelectedSize(null);
      setSelectedColor(null);
    }
  }, [open, productId, asPage]);

  // ── REPO IMPROVEMENT #3: useEffect to reactively sync selectedVariation ──
  useEffect(() => {
    if (!product?.variations?.length) return;

    const nextVariation =
      product.variations.find(
        (v) =>
          (!selectedColor || v?.attributes?.pa_color === selectedColor) &&
          (!selectedSize || v?.attributes?.pa_size === selectedSize)
      ) || null;

    if (nextVariation) {
      setSelectedVariation(nextVariation);
    }
  }, [selectedColor, selectedSize, product?.variations]);

  const fetchProductDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/products/${productId}`);
      const data = await response.json();

      if (data.success && data.product) {
        // ── Uses standalone normalizeProduct (Improvement #1) ──
        const p = normalizeProduct(data.product);

        setProduct(p);
        setCreator(data.creator);
        setRelatedProducts(data.relatedProducts || []);

        if (p.variations?.length > 0) {
          const firstVariation = p.variations[0];
          setSelectedVariation(firstVariation);
          setSelectedColor(firstVariation?.attributes?.pa_color || null);
          setSelectedSize(firstVariation?.attributes?.pa_size || null);
        }

        setCurrentMockupIndex(0);
      } else {
        toast.error('Product not found');
      }
    } catch (error) {
      toast.error('Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const response = await fetch(`/api/products/${productId}/reviews`);
      if (!response.ok) {
        setReviews([]);
        return;
      }
      const data = await response.json();
      if (data.success) {
        setReviews(data.reviews || []);
      }
    } catch (error) {
      setReviews([]);
    }
  };

  const handleSubmitReview = async () => {
    if (userRating === 0 || !userComment.trim()) return;

    setSubmittingReview(true);
    try {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: userRating,
          comment: userComment,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Review submitted!');
        setUserRating(0);
        setUserComment('');
        fetchReviews();
      }
    } catch (error) {
      toast.error('Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleAddToCart = async () => {
    if (addingToCart.current || !product?._id) return;
    addingToCart.current = true;
    try {
      const variationId = String(
        selectedVariation?.catalogVariantId ?? selectedVariation?.id ?? ''
      );
      const result = await addToCart(product._id, variationId, quantity, {
        color: selectedColor,
        size: selectedSize,
      });
      if (result && result.success) toast.success('Added to cart! 🛒');
    } catch (error) {
      toast.error('Failed to add to cart');
    } finally {
      addingToCart.current = false;
    }
  };

  const handleCategoryClick = (category) => {
    onOpenChange?.(false);

    if (creator && (category === creator.name || category === creator.username)) {
      router.push(`/aisle/${creatorSlug}`);
      return;
    }

    router.push(`/showroom?category=${encodeURIComponent(category)}`);
  };

  if (!open && !asPage) return null;

  const normalizeImageUrl = (url) => {
  if (!url) return null;
  if (typeof url === 'object') url = url.secure_url || url.url;
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed === 'https://files.cdn.printful.com/') return null;
  if (trimmed.includes('/undefined')) return null;
  if (trimmed.includes('null')) return null;

  return trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
};

  const preferredImageSet =
    (Array.isArray(product?.mockups) && product.mockups.length > 0 ? product.mockups : null) ||
    (Array.isArray(product?.mockupImages) && product.mockupImages.length > 0 ? product.mockupImages : null) ||
    (Array.isArray(product?.images) && product.images.length > 0 ? product.images : null) ||
    (product?.imageUrl ? [product.imageUrl] : null) ||
    (product?.thumbnailUrl ? [product.thumbnailUrl] : null) ||
    (product?.mockupUrl ? [product.mockupUrl] : null) ||
    (product?.image ? [product.image] : null) ||
    [];

  const galleryImages = [...new Set(preferredImageSet.map(normalizeImageUrl).filter(Boolean))];
  const safeGalleryImages = galleryImages.length > 0 ? galleryImages : ['/placeholder.png'];

  const productName = product?.name || product?.title || 'Product';
  const creatorSlug = creator?.username || creator?.id || 'unknown';
  const productPrice = selectedVariation?.price || product?.price || 0;
  const productDescription = product?.description || '';
  const regularPrice = selectedVariation?.regular_price || product?.regularPrice;
  const hasDiscount = regularPrice && parseFloat(regularPrice) > parseFloat(productPrice);

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0;

  const availableColors = Array.from(
    new Set((product?.variations || []).map((v) => v.attributes?.pa_color).filter(Boolean))
  );

  const availableSizes = Array.from(
    new Set(
      (product?.variations || [])
        .filter((v) => !selectedColor || v.attributes?.pa_color === selectedColor)
        .map((v) => {
          const raw = v.attributes?.pa_size || v.name;
          if (!raw) return null;
          return raw.includes(' / ') ? raw.split(' / ')[1] : raw;
        })
        .filter(Boolean)
    )
  ).sort((a, b) => {
    const order = ['xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'];
    const ai = order.indexOf(a.toLowerCase());
    const bi = order.indexOf(b.toLowerCase());
    if (ai !== -1 && bi !== -1) return ai - bi;
    return a.localeCompare(b);
  });

  const content = (
    <div className="flex flex-col gap-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 w-full">
        {/* Left Column - Gallery */}
        <div className="space-y-4 lg:sticky lg:top-0 h-fit">
          <div className="relative aspect-square bg-white rounded-xl overflow-hidden border border-white/10">
            {safeGalleryImages.length > 0 ? (
              <>
                <img
                  src={safeGalleryImages[currentMockupIndex] || safeGalleryImages[0] || '/placeholder.png'}
                  alt={productName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/placeholder.png';
                  }}
                />
                {safeGalleryImages.length > 1 && (
                  <>
                    <button
                      onClick={() =>
                        setCurrentMockupIndex((prev) =>
                          prev === 0 ? safeGalleryImages.length - 1 : prev - 1
                        )
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 p-2 rounded-full"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() =>
                        setCurrentMockupIndex((prev) =>
                          prev === safeGalleryImages.length - 1 ? 0 : prev + 1
                        )
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 p-2 rounded-full"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Package className="w-16 h-16 mb-2" />
              </div>
            )}
          </div>

          {safeGalleryImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {safeGalleryImages.map((image, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentMockupIndex(idx)}
                  className={`relative w-20 h-20 flex-shrink-0 rounded-lg border-2 overflow-hidden ${
                    currentMockupIndex === idx ? 'border-emerald-500' : 'border-white/20'
                  }`}
                >
                  <img
                    src={image || '/placeholder.png'}
                    alt={`View ${idx + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column - Purchase Info */}
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold mb-4">{productName}</h2>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black text-emerald-400">
                  ${parseFloat(productPrice).toFixed(2)}
                </span>
                {hasDiscount && (
                  <span className="text-xl text-gray-500 line-through">
                    ${parseFloat(regularPrice).toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {product?.categories?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {product.categories.map((cat, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCategoryClick(cat)}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-[#1e293b] border border-emerald-500/30 text-emerald-400 rounded-full text-sm hover:bg-emerald-500/20 transition-all"
                  >
                    <Tag className="w-3 h-3" /> {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {creator && (
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-[#1e293b] to-[#0f172a] rounded-xl border border-white/10">
              <Avatar className="h-12 w-12 border-2 border-emerald-500/50">
                <AvatarImage src={creator.avatar} />
                <AvatarFallback>{creator.username?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold">{creator.name || creator.username}</div>
                <div className="text-sm text-gray-400">@{creator.username}</div>
              </div>
              <div className="flex gap-2">
                <a
                  href={`/aisle/${creatorSlug}`}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-emerald-400 border-emerald-500/30"
                  >
                    <MapPin className="w-4 h-4 mr-1" /> Aisle
                  </Button>
                </a>
              </div>
            </div>
          )}

          <ShareButton
            url={`${typeof window !== 'undefined' ? window.location.origin : ''}/products/${product?.id}`}
            title={`Buy ${productName}`}
            variant="secondary"
          />

          {/* ── REPO IMPROVEMENT #2: Color auto-advances size on select ── */}
          {availableColors.length > 0 && (
            <div>
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full border border-white/30 inline-block"
                  style={{ background: selectedColor || '#fff' }}
                />
                Color: <span className="text-emerald-400">{selectedColor || 'Select'}</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {availableColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setSelectedColor(color);
                      // Auto-select first available size for this color
                      const nextSize =
                        (product?.variations || []).find(
                          (v) => v.attributes?.pa_color === color
                        )?.attributes?.pa_size || null;
                      if (nextSize) {
                        const raw = nextSize.includes(' / ') ? nextSize.split(' / ')[1] : nextSize;
                        setSelectedSize(raw);
                      } else {
                        setSelectedSize(null);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg border-2 text-sm transition-all ${
                      selectedColor === color
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {availableSizes.length > 0 && (
            <div>
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Ruler className="w-5 h-5 text-emerald-500" />
                Size: <span className="text-emerald-400">{selectedSize?.toUpperCase() || 'Select'}</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {availableSizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-4 py-2 rounded-lg border-2 uppercase text-sm transition-all ${
                      selectedSize === size
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add to Cart */}
          <div className="space-y-4 pt-6 border-t border-white/10">
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleAddToCart}
                disabled={cartLoading}
                className="w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/50 py-6 font-bold transition-all"
              >
                <ShoppingCart className="w-5 h-5 mr-2" /> Add to Cart
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Reviews Section */}
      <div className="max-w-4xl mx-auto w-full pb-8">
        <h3 className="font-bold text-2xl mb-6 flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-emerald-500" /> Customer Reviews ({reviews.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-[#1e293b] p-6 rounded-xl border border-white/10 h-fit">
            <h4 className="font-semibold mb-4 text-lg">Leave a Review</h4>
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  onClick={() => setUserRating(s)}
                  className={`w-6 h-6 cursor-pointer ${
                    s <= userRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'
                  }`}
                />
              ))}
            </div>
            <Textarea
              value={userComment}
              onChange={(e) => setUserComment(e.target.value)}
              className="bg-[#0f172a] border-white/10 text-white mb-4 min-h-[120px]"
            />
            <Button
              onClick={handleSubmitReview}
              disabled={submittingReview}
              className="w-full bg-emerald-500 text-black hover:bg-emerald-600 font-semibold"
            >
              <Send className="w-4 h-4 mr-2" /> Submit
            </Button>
          </div>
          <div className="md:col-span-2 space-y-4">
            {reviews.length > 0 ? (
              reviews.map((r, i) => (
                <div key={i} className="bg-[#1e293b] p-5 rounded-xl border border-white/10">
                  <div className="font-medium mb-1">{r.userName || 'Anonymous'}</div>
                  <p className="text-gray-300 leading-relaxed">{r.comment}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500 border border-dashed border-white/10 rounded-xl">
                No reviews yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related Products Grid */}
      {relatedProducts.length > 0 && (
        <div className="pt-8">
          <h3 className="font-bold text-2xl mb-6">More from this creator</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map((p) => (
              <button
                key={p.id}
                className="text-left group"
                onClick={() => {
                  setProduct(null);
                  router.push(`/products/${p.id}`);
                }}
              >
                <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-900 border border-white/10 mb-3 group-hover:border-emerald-500/50 transition-all">
                  {p.imageUrl && (
                    <Image
                      src={p.imageUrl}
                      alt={p.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  )}
                </div>
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-emerald-400 font-bold">${parseFloat(p.price).toFixed(2)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── REPO IMPROVEMENT #4: asPage rendering path ──
  if (asPage) {
    return (
      <div className="min-h-screen bg-[#020617] px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {loading ? (
            <div className="flex items-center justify-center p-12 min-h-[50vh]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
            </div>
          ) : product ? (
            content
          ) : (
            <div className="p-12 text-center text-gray-400 min-h-[50vh] flex items-center justify-center">
              Product not found.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-6xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto bg-[#020617] border-white/10 text-white p-4 md:p-8">
        <DialogHeader>
          <DialogTitle className="sr-only">{productName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-12 min-h-[50vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
          </div>
        ) : product ? (
          content
        ) : (
          <div className="p-12 text-center text-gray-400 min-h-[50vh] flex items-center justify-center">
            Product not found.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}