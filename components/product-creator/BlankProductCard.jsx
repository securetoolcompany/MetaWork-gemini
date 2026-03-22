import React from 'react';
import { Info, Paintbrush } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Ensure onInspect is included in the { } braces here!
export function BlankProductCard({ product, onSelect, onInspect }) {
  return (
    <div className="border rounded-lg p-4 shadow-sm bg-card">
      <img src={product.thumbnailUrl} alt={product.name} className="w-full h-40 object-contain mb-4" />
      <h3 className="font-bold text-sm h-10 overflow-hidden mb-2">{product.name}</h3>
      
      <div className="space-y-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={(e) => {
            e.stopPropagation(); // Prevents selecting the product by accident
            if (onInspect) {
              onInspect(product); // This triggers the modal in page.js
            } else {
              console.error("onInspect prop is missing!");
            }
          }}
        >
          Product Information
        </Button>

        <Button 
          size="sm" 
          className="w-full"
          onClick={() => onSelect(product)}
        >
          Design This Product
        </Button>
      </div>
    </div>
  );
}
