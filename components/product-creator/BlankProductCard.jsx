import React from 'react';
import { Info, Paintbrush } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Add `isPublicView = false` to the destructuring. It defaults to false so it doesn't break your existing creator page.
export function BlankProductCard({ product, onSelect, onInspect, isPublicView = false }) {
  return (
    <div className="border rounded-lg p-4 shadow-sm bg-card transition-all hover:shadow-md">
      <img src={product.thumbnailUrl} alt={product.name} className="w-full h-40 object-contain mb-4" />
      <h3 className="font-bold text-sm h-10 overflow-hidden mb-2">{product.name}</h3>
      
      <div className="space-y-2 mt-4">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={(e) => {
            e.stopPropagation(); // Prevents selecting the product by accident
            if (onInspect) {
              onInspect(product); // This triggers the modal in page.js
            } else {
              console.warn("Product inspection not available in this view.");
            }
          }}
        >
          Product Information
        </Button>

        {/* If it's the public catalog, link them to the creator page. Otherwise, use the standard onSelect function */}
        {isPublicView ? (
          <Link href="/products/creator" className="w-full block">
            <Button size="sm" className="w-full">
              Test Design
            </Button>
          </Link>
        ) : (
          <Button 
            size="sm" 
            className="w-full"
            onClick={() => onSelect && onSelect(product)}
          >
            Design This Product
          </Button>
        )}
      </div>
    </div>
  );
}