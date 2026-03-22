'use client';

import AisleProductCard from './AisleProductCard';
import AisleAdPlacement from './AisleAdPlacement';
import React from 'react';

export default function AisleCollectionGrid({ collection, products, settings, accentColor }) {
  if (products.length === 0) return null;

  return (
    <div className="mb-12">
      {/* Collection Header */}
      {collection.showHeader && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2" style={{ color: accentColor }}>
            {collection.name}
          </h2>
          {collection.description && (
            <p className="text-muted-foreground">{collection.description}</p>
          )}
        </div>
      )}

      {/* Products Grid with In-Grid Ads */}
      <div 
        className="grid gap-6" 
        style={{ 
          gridTemplateColumns: `repeat(${collection.columns || settings.productsPerRow}, minmax(0, 1fr))` 
        }}
      >
        {products.map((product, idx) => {
          // Show in-grid ad after certain products based on frequency
          const showAd = settings.adSettings?.inGrid && 
                       idx > 0 && 
                       (idx + 1) % (settings.adSettings?.inGridFrequency || 8) === 0;
          
          return (
            <React.Fragment key={product.id}>
              <AisleProductCard
                product={product}
                cardStyle={settings.cardStyle}
                accentColor={accentColor}
                showReviews={settings.allowReviews}
                showSalesCounter={settings.showSalesCounter}
              />
              {showAd && (
                <div className="flex items-center justify-center">
                  <AisleAdPlacement type="in-grid" accentColor={accentColor} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}