'use client';

import Link from 'next/link';

export default function AisleIPAssetCard({ 
  item, 
  accentColor = '#3b82f6' 
}) {
  if (!item) return null;

  // Temporarily add this at the top of AisleIPAssetCard, after the null check:
console.log('IP item fields:', JSON.stringify(item, null, 2));

  const assetUrl = `/ip/${item.id || item._id}`;
  
  // 1. URL Normalization (fixes // protocol issues)
  const normalizeUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    return url.startsWith('//') ? `https:${url}` : url;
  };

  const imageSrc = normalizeUrl(item.imageUrl || item.thumbnailUrl || item.image);
  const fee = item.licensingFee ?? item.royaltyFee ?? null;
  const feeLabel = fee != null ? `$${Number(fee).toFixed(2)} / use` : 'Free to use';
  
  return (
    <Link
      href={assetUrl}
      className="bg-[#111] rounded-2xl overflow-hidden border border-white/5 flex flex-col h-full hover:border-white/20 transition-all cursor-pointer block group"
    >
      {/* IMAGE CONTAINER - Fixed Square Ratio */}
      <div className="relative w-full aspect-square overflow-hidden bg-[#0a0a0a]">
        <img
          src={imageSrc || '/placeholder.png'}
          alt={item.title || item.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          onError={(e) => {
            // Hides broken image icon but keeps the card height stable
            e.target.style.opacity = '0';
            e.target.parentElement.style.backgroundColor = '#1a1a1a';
          }} 
        />
      </div>

      {/* CONTENT AREA - Restored UI Elements */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="text-sm font-semibold line-clamp-1 text-white">
          {item.title || item.name}
        </h3>
        
        {/* Restored Creator Name */}
        {item.creator && (
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
            BY {item.creator.displayName || item.creator.username || 'Unknown Creator'}
          </p>
        )}

        {/* Restored Description */}
        <p className="text-xs text-gray-400 line-clamp-2 mt-1">
          {item.description || 'Verified Intellectual Property'}
        </p>

        {/* Restored Royalty and Usage Stats */}
        <div className="mt-auto pt-3 flex items-center justify-between">
          <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
            {feeLabel}
          </span>
          <span className="text-[10px] text-gray-500 italic">
            {item.usageCount || 0} Uses
          </span>
        </div>

        {/* Restored "Use IP" Action Button */}
        <div className="mt-3">
          <div 
            className="w-full text-[15px] font-bold py-2 rounded-md text-white text-center transition-opacity group-hover:opacity-90 shadow-md"
            style={{ backgroundColor: accentColor }}
          >
            Use IP
          </div>
        </div>
      </div>
    </Link>
  );
}