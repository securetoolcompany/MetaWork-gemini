'use client';

import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';

export default function AisleIPAssetCard({ item, accentColor = '#3b82f6' }) {
  const title = item.title || item.name || 'Untitled Asset';
  
  // IP Specific image logic
  const imageSrc = item.imageUrl || item.thumbnailUrl || item.image || '/placeholder.png';
  
  // IP Specific price logic (Licensing Fee)
  const rawFee = item.licensingFee || item.price || 0;
  const displayFee = typeof rawFee === 'object' 
    ? (rawFee.$numberDecimal || rawFee.toString()) 
    : rawFee;

  return (
    <Link href={`/ip/${item.id || item._id}`} className="group block">
      <div className="bg-[#0f172a] border border-white/5 rounded-2xl overflow-hidden hover:border-blue-500/50 transition-all flex flex-col h-full shadow-xl">
        {/* Visual Container */}
        <div className="aspect-square relative overflow-hidden bg-slate-900">
          <img 
            src={imageSrc} 
            alt={title} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
          />
          <div className="absolute top-3 left-3">
             <Badge className="bg-blue-600/90 text-white border-none flex gap-1 items-center py-1">
                <ShieldCheck className="w-3 h-3" /> IP ASSET
             </Badge>
          </div>
        </div>
        
        {/* Detail Container */}
        <div className="p-5 flex flex-col flex-1">
          <h3 className="font-bold text-white text-lg truncate mb-1 group-hover:text-blue-400 transition-colors">
            {title}
          </h3>
          <p className="text-slate-400 text-xs line-clamp-2 mb-4 flex-1">
            {item.description || 'Digital IP Asset available for licensing.'}
          </p>

          <div className="flex justify-between items-center mt-auto pt-4 border-t border-white/5">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Licensing Fee</span>
              <span className="text-xl font-black text-white">
                ${Number(displayFee).toFixed(2)}
              </span>
            </div>
            <div 
              className="px-4 py-2 rounded-lg text-xs font-bold text-white transition-all"
              style={{ backgroundColor: accentColor }}
            >
              View License
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}