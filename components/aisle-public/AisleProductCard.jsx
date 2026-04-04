'use client';

import Link from 'next/link';

export default function AisleProductCard({ 
  product, 
  accentColor = '#10b981'
}) {
  const productUrl = `/products/${product.id || product._id}`;
  
  const rawPrice = product.price || product.basePrice || 0;
  const displayPrice = typeof rawPrice === 'object' 
    ? (rawPrice.$numberDecimal || rawPrice.toString()) 
    : rawPrice;

  // 1. Helper to fix protocol-relative URLs (//res.cloudinary.com -> https://res...)
  const normalizeUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    return url.startsWith('//') ? `https:${url}` : url;
  };

  // 2. Fix Priority: mockupUrl must be first to support Printful correctly
  const rawImageSrc = 
    product.mockupUrl || 
    product.thumbnailUrl || 
    product.mockupImages?.[0] || 
    product.imageUrl || 
    product.images?.[0] || 
    product.image;

  const imageSrc = normalizeUrl(rawImageSrc) || '/placeholder.png';

  return (
    <Link
      href={productUrl}
      className="bg-[#111] rounded-2xl overflow-hidden border border-white/5 flex flex-col h-full hover:border-white/20 transition-all cursor-pointer block group"
    >
      {/* Image Container */}
      <div className="relative w-full pt-[100%] overflow-hidden bg-[#0a0a0a]">
        <img 
          src={imageSrc} 
          alt={product.title || product.name || 'Product Image'} 
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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