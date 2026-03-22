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
  Palette,
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

export default function ProductDetailDialog({ open, onOpenChange, productId }) {
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
  
  // Reviews/Comments state
  const [reviews, setReviews] = useState([]);
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (open && productId) {
      fetchProductDetails();
      fetchReviews();
    } else {
      // Reset state when dialog closes
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
    }
  }, [open, productId]);

  const fetchProductDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/products/${productId}`);
      const data = await response.json();
      
      if (data.success && data.product) {
        setProduct(data.product);
        console.log('📦 Full product:', data.product);

        setCreator(data.creator);
        setRelatedProducts(data.relatedProducts || []);
        
        // Set default selection to first variation
        if (data.product.variations?.length > 0) {
          const firstVariation = data.product.variations[0];
          setSelectedVariation(firstVariation);
          setSelectedSize(firstVariation.attributes?.pa_size || null);
        }
        
        setCurrentMockupIndex(0);
      } else {
        toast.error('Product not found');
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const response = await fetch(`/api/products/${productId}/reviews`);
      if (!response.ok) {
        console.log('Reviews API not available');
        setReviews([]);
        return;
      }
      const data = await response.json();
      if (data.success) {
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
    }
  };

  const handleSubmitReview = async () => {
    if (userRating === 0) {
      toast.error('Please select a rating');
      return;
    }
    if (!userComment.trim()) {
      toast.error('Please write a comment');
      return;
    }

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
        fetchReviews(); // Refresh reviews
      } else {
        toast.error(data.error || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSizeChange = (size) => {
    setSelectedSize(size);
    // Find matching variation
    const variation = product.variations?.find(
      v => v.attributes?.pa_size === size
    );
    if (variation) {
      setSelectedVariation(variation);
    }
  };

  const handleAddToCart = async () => {
  console.log('🔥 BUTTON CLICKED - handleAddToCart called');
  
  if (addingToCart.current) {
    console.log('⚠️ Already adding to cart, skipping');
    return;
  }
  
  if (!product?._id) {
    toast.error('Invalid product');
    return;
  }

  addingToCart.current = true;
  
  try {
    const variationId = selectedVariation?.id?.toString() || null;
    console.log('📤 Calling addToCart with:', { productId: product._id, variationId, quantity });
    
    const result = await addToCart(product._id, variationId, quantity);
    
    console.log('📥 Got result:', result);
    console.log('📊 result.success:', result?.success);
          
    if (result && result.success) {
  console.log('✅ About to show SUCCESS toast');
  toast.success('Added to cart! 🛒', { 
    id: 'cart-add-success' 
  });
} else {
  console.log('❌ About to show ERROR toast');
  toast.error('Failed to add to cart', {
    id: 'cart-add-error'
  });
}

  } catch (error) {
    console.error('Error adding to cart:', error);
    toast.error('Failed to add to cart');
  } finally {
    addingToCart.current = false;
  }
};



  const handleCategoryClick = (category) => {
    onOpenChange(false);
    if (creator && (category === creator.name || category === creator.username)) {
      // Direct them to the dedicated Aisle instead of a filtered showroom
      router.push(`/aisle/${creator.username}`);
      toast.info(`Entering ${creator.name}'s Aisle`);
    } else {
    router.push(`/showroom?category=${encodeURIComponent(category)}`);
    }
  };

  const nextMockup = () => {
    const images = product?.images || product?.mockupImages || [];
    if (images.length > 0) {
      setCurrentMockupIndex((prev) => 
        prev === images.length - 1 ? 0 : prev + 1
      );
    }
  };

  const prevMockup = () => {
    const images = product?.images || product?.mockupImages || [];
    if (images.length > 0) {
      setCurrentMockupIndex((prev) => 
        prev === 0 ? images.length - 1 : prev - 1
      );
    }
  };

  if (!open) return null;

  const displayImages = product?.images || product?.mockupImages || [];
  const productName = product?.name || product?.title || 'Product';
  const productPrice = selectedVariation?.price || product?.price || 0;
  const productDescription = product?.description || '';
  const regularPrice = selectedVariation?.regular_price || product?.regularPrice;
  const hasDiscount = regularPrice && parseFloat(regularPrice) > parseFloat(productPrice);

  // Extract available sizes from variations and sort them
const sizeOrder = ['xs', 's', 'm', 'l', 'xl', '2xl', '2xs', '3xl', '4xl', '5xl', '6xl'];

const availableSizes = product?.variations
  ? Array.from(new Set(product.variations.map(v => v.attributes?.pa_size).filter(Boolean)))
      .map(size => decodeURIComponent(size)) // Decode URL-encoded characters
      .sort((a, b) => {
        const aIndex = sizeOrder.indexOf(a.toLowerCase());
        const bIndex = sizeOrder.indexOf(b.toLowerCase());
        
        // If both are in the order array, sort by index
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        
        // If only one is in the array, prioritize it
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        
        // Otherwise sort alphabetically
        return a.localeCompare(b);
      })
  : [];



  // Calculate average rating
  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  // Check stock
  const isInStock = selectedVariation?.stock_status === 'instock' || 
                    product?.stockStatus === 'instock';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-[#020617] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="sr-only">
            {loading ? 'Loading product...' : productName}
          </DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
          </div>
        ) : product ? (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column - Images */}
            <div className="space-y-4">
              {/* Main Mockup Display */}
              <div className="relative aspect-square bg-gray-900 rounded-xl overflow-hidden border border-white/10">
                {displayImages.length > 0 ? (
                  <>
                    <Image
                      src={displayImages[currentMockupIndex]}
                      alt={productName}
                      fill
                      className="object-cover"
                    />
                    {displayImages.length > 1 && (
                      <>
                        <button
                          onClick={prevMockup}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 backdrop-blur transition-all"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={nextMockup}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 backdrop-blur transition-all"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                          {displayImages.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setCurrentMockupIndex(idx)}
                              className={`w-2 h-2 rounded-full transition-all ${
                                currentMockupIndex === idx
                                  ? 'bg-emerald-500 w-6'
                                  : 'bg-white/40'
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={productName}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Package className="w-16 h-16 mb-2" />
                    <span className="text-sm">No image available</span>
                  </div>
                )}
                
                {hasDiscount && (
                  <div className="absolute top-4 right-4 bg-emerald-500 text-black px-3 py-1 rounded-md font-bold text-sm">
                    SALE
                  </div>
                )}
              </div>

              {/* Thumbnail Strip */}
              {displayImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {displayImages.map((image, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentMockupIndex(idx)}
                      className={`relative w-20 h-20 flex-shrink-0 rounded-lg border-2 overflow-hidden transition-all ${
                        currentMockupIndex === idx
                          ? 'border-emerald-500 scale-105'
                          : 'border-white/20 hover:border-white/40'
                      }`}
                    >
                      <Image
                        src={image}
                        alt={`View ${idx + 1}`}
                        fill
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column - Details */}
            <div className="space-y-6">
              {/* Product Name & Price */}
              <div>
                <h2 className="text-3xl font-bold mb-3">
                  {productName}
                </h2>
                
                {/* Price & Rating */}
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
                  
                  {/* Average Rating Display */}
                  {reviews.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-5 h-5 ${
                              star <= Math.round(averageRating)
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-600'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-400">
                        {averageRating} ({reviews.length})
                      </span>
                    </div>
                  )}
                </div>

                {/* Clickable Categories */}
                {product.categories && product.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {product.categories.map((cat, idx) => (
  <button
    key={idx}
    onClick={() => handleCategoryClick(cat)} // This triggers the function above
    className="inline-flex items-center gap-1 px-3 py-1 bg-[#1e293b] border border-emerald-500/30 text-emerald-400 rounded-full text-sm hover:bg-emerald-500/20 transition-all"
  >
    <Tag className="w-3 h-3" />
    {cat}
  </button>
))}
                  
                  </div>
                )}
              </div>

              {/* Creator Info with Links */}
              {creator && (
                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-[#1e293b] to-[#0f172a] rounded-xl border border-white/10">
                  <Avatar className="h-12 w-12 border-2 border-emerald-500/50">
                    <AvatarImage src={creator.avatar} />
                    <AvatarFallback className="bg-emerald-900 text-emerald-200">
                      {creator.name?.[0] || creator.username?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold">{creator.name || creator.username}</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      @{creator.username}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/aisle/${creator.username}`} onClick={() => onOpenChange(false)}>
                      <Button variant="outline" size="sm" className="bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400">
                        <MapPin className="w-4 h-4 mr-1" />
                        Aisle
                      </Button>
                    </Link>
                    <Link href={`/profile/${creator.username}`} onClick={() => onOpenChange(false)}>
                      <Button variant="outline" size="sm" className="bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Profile
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              <Separator className="bg-white/10" />

              {/* Description */}
              {productDescription && (
                <div>
                  <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                    <Package className="w-5 h-5 text-emerald-500" />
                    Description
                  </h3>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {productDescription}
                  </p>
                </div>
              )}

              {/* Size Selection */}
              {availableSizes.length > 0 && (
                <div>
                  <h3 className="font-bold mb-3 flex items-center gap-2">
                    <Ruler className="w-5 h-5 text-emerald-500" />
                    Size: <span className="font-normal text-emerald-400">{selectedSize?.toUpperCase()}</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {availableSizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => handleSizeChange(size)}
                        className={`px-4 py-2 rounded-lg border-2 text-sm font-medium uppercase transition-all ${
                          selectedSize === size
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                            : 'border-white/20 hover:border-white/40 text-gray-300'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div>
                <h3 className="font-bold mb-3">Quantity</h3>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="bg-[#1e293b] border-white/20 hover:bg-[#334155]"
                  >
                    -
                  </Button>
                  <span className="w-12 text-center font-bold text-xl">{quantity}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(quantity + 1)}
                    className="bg-[#1e293b] border-white/20 hover:bg-[#334155]"
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Stock Status */}
              <div>
                {isInStock ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                    In Stock
                  </Badge>
                ) : (
                  <Badge variant="destructive">Out of Stock</Badge>
                )}
              </div>

              {/* Add to Cart Button */}
              <Button 
  onClick={handleAddToCart}
  disabled={cartLoading || !isInStock}
  className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-6 text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
>
  <ShoppingCart className="w-5 h-5 mr-2" />
  {cartLoading ? 'Adding...' : isInStock ? 'Add to Cart' : 'Out of Stock'}
</Button>


              {/* Reviews Section */}
              <Separator className="bg-white/10" />
              
              <div>
                <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-500" />
                  Reviews & Ratings ({reviews.length})
                </h3>

                {/* Write a Review */}
                <div className="bg-[#1e293b] p-4 rounded-xl border border-white/10 mb-6">
                  <h4 className="font-semibold mb-3">Write a Review</h4>
                  
                  {/* Star Rating Input */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm text-gray-400">Your Rating:</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setUserRating(star)}
                          className="transition-all hover:scale-110"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              star <= userRating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-600 hover:text-gray-400'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comment Textarea */}
                  <Textarea
                    placeholder="Share your experience with this product..."
                    value={userComment}
                    onChange={(e) => setUserComment(e.target.value)}
                    className="bg-[#0f172a] border-white/10 text-white mb-3 min-h-[100px]"
                  />

                  <Button
                    onClick={handleSubmitReview}
                    disabled={submittingReview || userRating === 0 || !userComment.trim()}
                    className="w-full bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-400"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </Button>
                </div>

                {/* Display Reviews */}
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {reviews.length > 0 ? (
                    reviews.map((review, idx) => (
                      <div key={idx} className="bg-[#1e293b] p-4 rounded-lg border border-white/10">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={review.userAvatar} />
                              <AvatarFallback className="bg-emerald-900 text-emerald-200 text-xs">
                                {review.userName?.[0] || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-sm">{review.userName || 'Anonymous'}</div>
                              <div className="flex items-center gap-2">
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={`w-3 h-3 ${
                                        star <= review.rating
                                          ? 'fill-yellow-400 text-yellow-400'
                                          : 'text-gray-600'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-xs text-gray-400">
                                  {new Date(review.createdAt || review.date).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {review.comment}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No reviews yet. Be the first to review!
                    </div>
                  )}
                </div>
              </div>

              {/* Related Products */}
              {relatedProducts && relatedProducts.length > 0 && (
                <>
                  <Separator className="bg-white/10" />
                  <div>
                    <h3 className="font-bold text-xl mb-4">More from this creator</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {relatedProducts.map((related) => (
                        <button
                          key={related.id}
                          onClick={() => {
                            onOpenChange(false);
                            setTimeout(() => {
                              window.location.href = `/showroom`;
                            }, 100);
                          }}
                          className="group text-left"
                        >
                          <div className="aspect-square bg-gray-900 rounded-lg overflow-hidden mb-2 border border-white/10 group-hover:border-emerald-500/50 transition-all">
                            {related.imageUrl && (
                              <Image
                                src={related.imageUrl}
                                alt={related.name || related.title}
                                width={200}
                                height={200}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            )}
                          </div>
                          <div className="text-sm font-medium line-clamp-1 group-hover:text-emerald-400 transition-colors">
                            {related.name || related.title}
                          </div>
                          <div className="text-emerald-400 font-bold">${parseFloat(related.price).toFixed(2)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-400">
            Product not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
