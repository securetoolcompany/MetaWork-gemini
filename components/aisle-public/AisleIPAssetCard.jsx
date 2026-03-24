'use client';

import Image from 'next/image';
import { Zap, Eye, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function AisleIPAssetCard({ asset, cardStyle, accentColor, onClick }) {
  
  // Pattern: Notify parent to update URL state
  const handleCardClick = () => {
    if (onClick) {
      onClick(asset);
    }
  };

  // Minimal Card Style
  if (cardStyle === 'minimal') {
    return (
      <div 
        className="group relative bg-gray-900/50 rounded-lg overflow-hidden border border-gray-800 hover:border-gray-600 transition-all cursor-pointer"
        onClick={handleCardClick}
      >
        {/* Image */}
        <div className="relative aspect-square bg-gray-800/50">
          <Image
            src={asset.imageUrl || asset.ipfsUrl}
            alt={asset.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        </div>
        
        {/* Info */}
        <div className="p-3">
          <h3 className="font-semibold text-white truncate text-sm">
            {asset.title || 'Untitled'}
          </h3>
          <p className="text-xs text-gray-400 mt-1">IP Asset</p>
        </div>
      </div>
    );
  }
  
  // Detailed Card Style
  if (cardStyle === 'detailed') {
    return (
      <div 
        className="group relative bg-gray-900/50 rounded-xl overflow-hidden border border-gray-800 hover:border-gray-600 transition-all shadow-lg hover:shadow-2xl cursor-pointer"
        onClick={handleCardClick}
      >
        {/* Image */}
        <div className="relative aspect-square bg-gray-800/50">
          <Image
            src={asset.imageUrl || asset.ipfsUrl}
            alt={asset.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
          
          {/* Badges */}
          <div className="absolute top-2 right-2 flex gap-2">
            {asset.collection && asset.collection !== 'default' && (
              <Badge className="bg-black/80 text-white text-xs border-none">
                {asset.collection}
              </Badge>
            )}
            <Badge 
              className="text-white text-xs font-semibold border-none"
              style={{ backgroundColor: accentColor }}
            >
              Available
            </Badge>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-4">
          <h3 className="font-bold text-white text-lg mb-2 line-clamp-1">
            {asset.title || 'Untitled'}
          </h3>
          
          {asset.description && (
            <p className="text-sm text-gray-400 line-clamp-2 mb-3">
              {asset.description}
            </p>
          )}
          
          {/* Tags */}
          {asset.tags && asset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {asset.tags.slice(0, 3).map((tag, idx) => (
                <span 
                  key={idx}
                  className="text-xs px-2 py-0.5 bg-gray-800 rounded-full text-gray-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          {/* Action Button */}
          <Button
            className="w-full gap-2 border-none"
            style={{ backgroundColor: accentColor }}
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
          >
            <Zap className="w-4 h-4" />
            View Details
          </Button>
        </div>
      </div>
    );
  }
  
  // Standard Card Style (default)
  return (
    <div 
      className="group relative bg-gray-900/50 rounded-lg overflow-hidden border border-gray-800 hover:border-gray-600 transition-all hover:shadow-xl cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Image */}
      <div className="relative aspect-square bg-gray-800/50">
        <Image
          src={asset.imageUrl || asset.ipfsUrl}
          alt={asset.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        
        {/* Status Badge */}
        <div 
          className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold text-white"
          style={{ backgroundColor: accentColor }}
        >
          <Sparkles className="w-3 h-3 inline mr-1" />
          Available
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-white line-clamp-1 mb-2">
          {asset.title || 'Untitled'}
        </h3>
        
        {/* Tags */}
        {asset.tags && asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {asset.tags.slice(0, 2).map((tag, idx) => (
              <span 
                key={idx}
                className="text-xs px-2 py-0.5 bg-gray-800 rounded text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        
        {/* Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={(e) => {
            e.stopPropagation();
            handleCardClick();
          }}
        >
          <Eye className="w-4 h-4" />
          View
        </Button>
      </div>
    </div>
  );
}