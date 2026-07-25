// components/ads/AdPlacement.jsx

import React from 'react';
import { cn } from '@/lib/utils';

export default function AdPlacement({ type, adData, className }) {
  if (!adData) return null;

  // These sizes are now used sitewide
  const sizeMap = {
    banner: "w-full max-w-[728px] h-[90px]",
    skyscraper: "w-[160px] h-[600px]",
    square: "w-[250px] h-[250px]",
    grid: "w-full aspect-square" // Matches your Marketplace/Showroom grids
  };

  return (
    <div className={cn("relative overflow-hidden bg-slate-900 border border-white/10 rounded-xl", sizeMap[type], className)}>
      {/* Video or Image Logic */}
      {adData.mediaType === 'video' ? (
        <video src={adData.mediaUrl} autoPlay muted loop className="object-cover w-full h-full" />
      ) : (
        <img src={adData.mediaUrl} className="object-cover w-full h-full" alt={adData.title} />
      )}
      
      {/* Text Overlay (Only if provided) */}
      {(adData.title || adData.description) && (
        <div className="absolute bottom-0 p-4 bg-gradient-to-t from-black to-transparent w-full">
          <p className="text-white text-xs font-bold">{adData.title}</p>
        </div>
      )}
    </div>
  );
}