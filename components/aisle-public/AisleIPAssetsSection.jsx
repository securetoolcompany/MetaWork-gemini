'use client';
import AisleIPAssetCard from './AisleIPAssetCard';
import { ImageIcon } from 'lucide-react';
import React from 'react';

export default function AisleIPAssetsSection({ ipAssets, settings }) {
  if (!ipAssets || ipAssets.length === 0) return null;
  
  const accentColor = settings?.accentColor || '#3b82f6';
  const cardStyle = settings?.cardStyle || 'modern';
  const productsPerRow = settings?.productsPerRow || 4;
  
  const gridColsClass = {
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5',
  };
  
  return (
    <section className="mb-12">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <ImageIcon 
          className="w-6 h-6"
          style={{ color: accentColor }}
        />
        <h2 className="text-2xl font-bold">IP Assets</h2>
        <span className="text-sm text-gray-400 ml-auto">
          {ipAssets.length} {ipAssets.length === 1 ? 'asset' : 'assets'}
        </span>
      </div>
      
      {/* IP Assets Grid */}
      <div className={`grid ${gridColsClass[productsPerRow] || gridColsClass[4]} gap-6`}>
        {ipAssets.map((asset) => (
          <AisleIPAssetCard
            key={asset._id}
            asset={asset}
            cardStyle={cardStyle}
            accentColor={accentColor}
          />
        ))}
      </div>
    </section>
  );
}
