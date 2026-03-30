'use client';

import Link from 'next/link';

export default function AisleProductCard({ 
  product, 
  accentColor = '#10b981' // Defaults to the emerald-500 color from the showroom
}) {
  const productUrl = `/products/${product.id || product._id}`;
  
  // Safely parse price to avoid React "Object is not valid as child" crashes
  const rawPrice = product.price || product.basePrice || 0;
  const displayPrice = typeof rawPrice === 'object' 
    ? (rawPrice.$numberDecimal || rawPrice.toString()) 
    : rawPrice;

  // Hierarchical image lookup protecting your multiple mockup/images feature
  const imageSrc = 
    product.images?.[0] || 
    product.mockupImages?.[0] || 
    product.mockupUrl || 
    product.imageUrl || 
    product.thumbnailUrl || 
    product.image || 
    '/placeholder.png';

  return (
    <Link
      href={productUrl}
      className="bg-[#111] rounded-2xl overflow-hidden border border-white/5 flex flex-col h-full hover:border-white/20 transition-all cursor-pointer block group"
    >
      {/* Image Container */}
      <div className="relative w-full pt-[100%] overflow-hidden bg-[#0a0a0a]">
        <img
          src={imageSrc}
          alt={product.name || product.title || 'Product image'}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            e.target.style.opacity = '0';
          }}
        />
      </div>

      {/* Content Area */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="text-sm font-semibold line-clamp-2 text-white">
          {product.name || product.title}
        </h3>
        <p className="text-xs text-gray-400 line-clamp-2">
          {product.description || 'Custom merchandise'}
        </p>

        <div className="mt-auto pt-2">
          <span className="font-bold text-sm" style={{ color: accentColor }}>
            ${Number(displayPrice).toFixed(2)}
          </span>
        </div>
        
        <div className="mt-3">
          <div 
            className="w-full text-[15px] font-bold py-2 rounded-md text-white text-center transition-opacity group-hover:opacity-90 shadow-md"
            style={{ backgroundColor: accentColor }}
          >
            View Product
          </div>
        </div>
      </div>
    </Link>
  );
}