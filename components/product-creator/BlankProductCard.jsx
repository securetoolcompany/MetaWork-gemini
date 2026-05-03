import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function BlankProductCard({ product, onSelect, onInspect, isPublicView = false, hideButtons = false }) {
  // Safely extract the starting price from the variants array or fallback to a default prop
  const basePrice = product.price || product.variants?.[0]?.price;
  const formattedPrice = basePrice ? `$${Number(basePrice).toFixed(2)}` : 'TBD';

  return (
    <div className="border rounded-xl p-4 shadow-sm bg-zinc-950 border-zinc-800 transition-all hover:border-zinc-700 flex flex-col h-full relative group">
      
      {/* Image Container */}
      <div className="w-full bg-white/5 rounded-lg mb-4 p-2">
        <img 
          src={product.thumbnailUrl} 
          alt={product.name} 
          className="w-full h-32 md:h-40 object-contain mix-blend-normal" 
        />
      </div>
      
      {/* Content Container (Grows to fill space) */}
      <div className="flex flex-col flex-grow">
        {/* line-clamp-2 safely truncates after 2 lines without breaking flexbox on mobile */}
        <h3 className="font-bold text-sm text-zinc-200 leading-snug line-clamp-2 mb-3 min-h-[2.5rem]">
          {product.name}
        </h3>
        
        {/* Price Badge (Forced to bottom of content area) */}
        <div className="mt-auto mb-4">
          <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-500/10 text-[10px] sm:text-[11px] font-mono text-emerald-400 tracking-tight border border-emerald-500/20 whitespace-nowrap">
            Starting at {formattedPrice}
          </span>
        </div>
      </div>
      
      {/* Buttons Container */}
      {!hideButtons && (
        <div className="space-y-2 mt-auto pt-4 border-t border-zinc-800/50 shrink-0">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full border-zinc-800 text-zinc-300 hover:bg-zinc-800 h-9"
            onClick={(e) => {
              e.stopPropagation();
              if (onInspect) onInspect(product);
            }}
          >
            Product Information
          </Button>

          {isPublicView ? (
            <Link href="/products/creator" className="w-full block">
              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9 font-bold tracking-tight">
                Test Design
              </Button>
            </Link>
          ) : (
            <Button 
              size="sm" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9 font-bold tracking-tight"
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