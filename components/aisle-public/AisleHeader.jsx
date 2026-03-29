'use client';

import Image from 'next/image';
import Link from 'next/link';
import { User, MapPin, Mail, Phone, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShareButton } from '@/components/ui/share-button';

export default function AisleHeader({ creator }) {
  const settings = creator?.aisleSettings || {};
  const accentColor = settings?.accentColor || '#3b82f6';
  
  // Data Mapping
  const title = settings?.title || creator?.username || 'Creator';
  const bio = settings?.description || creator?.bio || '';
  const avatar = settings?.logo || creator?.avatar;
  const banner = settings?.heroImage || creator?.banner;
  
  const locationStr = [settings?.location, settings?.country].filter(Boolean).join(', ');

  return (
    <div className="relative mb-8">
      {/* 1. Hero Banner */}
      <div className="h-64 md:h-80 relative overflow-hidden bg-slate-900">
        {banner ? (
          <Image src={banner} alt="Banner" fill className="object-cover" priority />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-slate-800 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-transparent" />
      </div>

      {/* 2. Content Overlap */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="relative -mt-16 flex flex-col md:flex-row md:items-end gap-6 pb-6 border-b border-slate-800">
          {/* Avatar */}
          <div className="relative w-32 h-32 rounded-full border-4 border-[#0f172a] overflow-hidden bg-slate-800 flex-shrink-0">
            {avatar ? (
              <Image src={avatar} alt={title} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-slate-500">
                {title.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Text Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{title}</h1>
            {bio && <p className="text-slate-300 text-sm max-w-2xl line-clamp-2 mb-3">{bio}</p>}
            
            {/* Contact Badges */}
            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
              {locationStr && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{locationStr}</span>}
              {settings?.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{settings.email}</span>}
              {settings?.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{settings.phone}</span>}
              {settings?.website && <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" />{settings.website.replace(/^https?:\/\//, '')}</span>}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pb-2">
            <Button asChild style={{ backgroundColor: accentColor, color: '#fff' }} className="hover:opacity-90">
              <Link href={`/profile/${creator?.username}`}>
                <User className="w-4 h-4 mr-2" /> Visit Profile
              </Link>
            </Button>
            <ShareButton 
              url={typeof window !== 'undefined' ? window.location.href : ''} 
              buttonText="Share My Aisle"
              style={{ backgroundColor: accentColor, color: '#fff' }}
              className="hover:opacity-90"
            />
          </div>
        </div>
      </div>
    </div>
  );
}