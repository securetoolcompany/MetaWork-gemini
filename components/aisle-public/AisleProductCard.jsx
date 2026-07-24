'use client';

import Link from 'next/link';

export default function AisleProductCard({ 
  product, 
  accentColor = '#10b981'
}) {
  const productUrl = `/products/${product.id || product._id}`;
  
  // 1. Price Logic Restoration
  const rawPrice = product.price || product.basePrice || 0;
  const displayPrice = typeof rawPrice === 'object' 
    ? (rawPrice.$numberDecimal || rawPrice.toString()) 
    : rawPrice;

  // 2. URL Normalization (fixes //res.cloudinary URLs)
  const normalizeUrl = (url) => {
    if (!url) return null;
    if (typeof url === 'object') url = url.secure_url || url.url;
    if (!url || typeof url !== 'string') return null;

    const trimmed = url.trim();
    if (!trimmed) return null;
    if (trimmed === 'https://files.cdn.printful.com/') return null;
    if (trimmed.includes('/undefined')) return null;
    if (trimmed.includes('null')) return null;

    return trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
  };


  // 3. Image Priority Logic
  const rawImageSrc =
    product.imageUrl ||
    product.thumbnailUrl ||
    product.mockupUrl ||
    product.mockupImages?.[0] ||
    product.images?.[0] ||
    product.image;

    console.log('product image fields:', {
      mockupUrl: product.mockupUrl,
      thumbnailUrl: product.thumbnailUrl,
      mockupImages: product.mockupImages,
      imageUrl: product.imageUrl,
      images: product.images,
      image: product.image,
    });

  const imageSrc = normalizeUrl(rawImageSrc);

  return (
    <Link
      href={productUrl}
      className="bg-[#111] rounded-2xl overflow-hidden border border-white/5 flex flex-col h-full hover:border-white/20 transition-all cursor-pointer block group"
    >
      {/* IMAGE CONTAINER - Fixed Aspect Ratio to prevent "long" cards */}
      <div className="relative w-full aspect-square overflow-hidden bg-white">
        <img
          src={imageSrc || '/placeholder.png'}
          alt={product.name || product.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          onError={(e) => {
            // Hides broken image icon without killing the card layout
            e.target.style.opacity = '0';
            e.target.parentElement.style.backgroundColor = '#1a1a1a';
          }} 
        />
      </div>

      {/* CONTENT AREA - Full Styling Restored */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="text-sm font-semibold line-clamp-2 text-white">
          {product.name || product.title}
        </h3>
        
        {/* Restored Description */}
        <p className="text-xs text-gray-400 line-clamp-2">
          {product.description || 'Custom merchandise'}
        </p>

        {/* Restored Price Stat */}
        <div className="mt-auto pt-2">
          <span className="font-bold text-sm" style={{ color: accentColor }}>
            ${Number(displayPrice).toFixed(2)}
          </span>
        </div>
        
        {/* Restored Action Button */}
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