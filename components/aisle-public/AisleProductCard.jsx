'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart, Star, TrendingUp, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProductDialog } from '@/app/providers/ProductDialogProvider';

export default function AisleProductCard({ 
  product, 
  cardStyle, 
  accentColor,
  showReviews,
  showSalesCounter 
}) {
  const { openProduct } = useProductDialog();

  const handleCardClick = () => {
    openProduct(product._id || product.id);
  };

  // Minimal Card Style
  if (cardStyle === 'minimal') {
    return (
      <div 
        className="group cursor-pointer"
        onClick={handleCardClick}
      >
        {/* Image */}
        <div className="relative aspect-square overflow-hidden rounded-lg mb-3">
          <Image
            src={product.imageUrl}
            alt={product.name || 'Product image'}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Info */}
        <div>
          <h3 className="font-medium mb-1 group-hover:opacity-80 transition-opacity">
            {product.name}
          </h3>
          <p className="font-bold" style={{ color: accentColor }}>
            ${product.price.toFixed(2)}
          </p>
        </div>
      </div>
    );
  }

  // Detailed Card Style
  if (cardStyle === 'detailed') {
    return (
      <div 
        className="group cursor-pointer border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
        onClick={handleCardClick}
      >
        {/* Image */}
        <div className="relative aspect-square overflow-hidden">
          <Image
            src={product.imageUrl}
            alt={product.name || 'Product image'}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          
          {/* Badges */}
          <div className="absolute top-2 right-2 flex gap-2">
            {showSalesCounter && product.salesCount > 10 && (
              <Badge className="bg-green-500 text-white">
                <TrendingUp className="w-3 h-3 mr-1" />
                Hot
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {product.description}
          </p>

          {/* Stats Row */}
          <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
            {showReviews && (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span>4.8 (124)</span>
              </div>
            )}
            {showSalesCounter && (
              <div className="flex items-center gap-1">
                <ShoppingCart className="w-3 h-3" />
                <span>{product.salesCount} sold</span>
              </div>
            )}
          </div>

          {/* Price & Button */}
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold" style={{ color: accentColor }}>
              ${product.price.toFixed(2)}
            </span>
            <Button 
              size="sm"
              style={{ backgroundColor: accentColor }}
              className="text-white"
              onClick={(e) => {
                e.stopPropagation();
                handleCardClick();
              }}
            >
              <ShoppingCart className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Standard Card Style (default)
  return (
    <div 
      className="group cursor-pointer border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
      onClick={handleCardClick}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden">
        <Image
          src={product.imageUrl}
          alt={product.name || 'Product image'}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold mb-2">{product.name}</h3>
        
        {/* Stats */}
        {(showReviews || showSalesCounter) && (
          <div className="flex items-center gap-3 mb-2 text-xs text-muted-foreground">
            {showReviews && (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span>4.8</span>
              </div>
            )}
            {showSalesCounter && (
              <span>{product.salesCount} sold</span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold" style={{ color: accentColor }}>
            ${product.price.toFixed(2)}
          </span>
          <Button 
            size="sm" 
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
          >
            View
          </Button>
        </div>
      </div>
    </div>
  );
}
