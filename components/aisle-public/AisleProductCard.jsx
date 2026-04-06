'use client';
import Link from 'next/link';

export default function AisleProductCard({ product, accentColor = '#10b981' }) {
  const productUrl = `/products/${product.id || product._id}`;
  
  // Try to find a valid URL
  const imageSrc = product.mockupUrl || product.imageUrl || product.thumbnailUrl || product.image;

  return (
    <Link href={`/products/${product.id || product._id}`} className="...">
      <div className="relative w-full aspect-square overflow-hidden bg-slate-900/50"> 
        <img
          src={imageSrc}
          alt={product.name}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          onError={(e) => {
            // Instead of hiding the card, just hide the broken image icon
            e.target.style.opacity = '0';
          }}
        />
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="text-sm font-semibold line-clamp-2 text-white">{product.name}</h3>
        <p className="text-xs text-gray-400 line-clamp-2">{product.description || 'Custom merchandise'}</p>
        <div className="mt-auto pt-2 font-bold text-sm" style={{ color: accentColor }}>
          ${(Number(product.price || 0)).toFixed(2)}
        </div>
      </div>
    </Link>
  );
}