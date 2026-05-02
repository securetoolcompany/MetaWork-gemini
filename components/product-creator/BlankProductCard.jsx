import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function BlankProductCard({ product, onSelect, onInspect, isPublicView = false, hideButtons = false }) {
  return (
    <div className="border rounded-lg p-4 shadow-sm bg-zinc-950 border-zinc-800 transition-all hover:border-zinc-700">
      <img src={product.thumbnailUrl} alt={product.name} className="w-full h-40 object-contain mb-4" />
      <h3 className="font-bold text-sm h-10 overflow-hidden mb-2 text-zinc-200">{product.name}</h3>
      
      {/* Conditionally render the buttons based on the hideButtons prop */}
      {!hideButtons && (
        <div className="space-y-2 mt-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            onClick={(e) => {
              e.stopPropagation();
              if (onInspect) onInspect(product);
            }}
          >
            Product Information
          </Button>

          {isPublicView ? (
            <Link href="/products/creator" className="w-full block">
              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Test Design
              </Button>
            </Link>
          ) : (
            <Button 
              size="sm" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => onSelect && onSelect(product)}
            >
              Design This Product
            </Button>
          )}
        </div>
      )}
    </div>
  );
}