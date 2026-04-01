'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Star, ShoppingCart, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export default function TrendingProductsSection() {
  const [startIndex, setStartIndex] = useState(0);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const itemsToShow = 4;

  // Fetch products from API
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        const response = await fetch('/api/showroom');
        const data = await response.json();
        
        // ✅ Check if it's an array (which your API currently returns)
        if (Array.isArray(data)) {
          // Filter out only the products from the mixed array
          const productsOnly = data.filter(item => 
             item.type === 'product' || 
             item.id?.startsWith('prod_') || 
             item.externalProductId
          );

          // Sort by sales count and take top 8
          const sorted = [...productsOnly]
            .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
            .slice(0, 8);
            
          setProducts(sorted);
        }
      } catch (err) {
        console.error('Error fetching trending products:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchProducts();
  }, []);

  const canScrollLeft = startIndex > 0;
  const canScrollRight = startIndex + itemsToShow < products.length;

  const scrollLeft = () => {
    setStartIndex(Math.max(0, startIndex - itemsToShow));
  };

  const scrollRight = () => {
    setStartIndex(Math.min(products.length - itemsToShow, startIndex + itemsToShow));
  };

  const visibleProducts = products.slice(startIndex, startIndex + itemsToShow);

  // If no products, don't render this section
  if (!loading && products.length === 0) {
    return null;
  }

  return (
    <div className="mb-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-green-500" />
            Trending Products
          </h2>
          <p className="text-muted-foreground">Hot items everyone's buying</p>
        </div>

        {/* Scroll Controls */}
        {products.length > itemsToShow && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={scrollLeft}
              disabled={!canScrollLeft}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={scrollRight}
              disabled={!canScrollRight}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading trending products...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {visibleProducts.map((product) => {
            const productName = product.title || product.name || 'Product';
            const productPrice = product.price || 0;
            const productImage = product.imageUrl || '/placeholder.png';
            const salesCount = product.salesCount || 0;
            
            return (
              <Link key={product.id} href={`/products/${product.id}`}>
                <Card className="group overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
                  {/* Product Image */}
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {productImage ? (
                      <Image
                        src={productImage}
                        alt={productName}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No Image
                      </div>
                    )}
                    {/* Hot Badge */}
                    {salesCount > 20 && (
                      <Badge className="absolute top-3 right-3 bg-red-500 text-white border-0 animate-pulse">
                        🔥 Hot
                      </Badge>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors line-clamp-1">
                      {productName}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      {product.baseProduct || product.catalogProductName || 'Product'}
                    </p>

                    {/* Stats */}
                    <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span>4.8</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" />
                        <span>{salesCount} sold</span>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-primary">${productPrice.toFixed(2)}</span>
                      <Button size="sm" variant="outline" className="text-xs">
                        View
                      </Button>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
