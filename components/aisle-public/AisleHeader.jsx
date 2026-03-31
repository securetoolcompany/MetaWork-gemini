'use client';

import Image from 'next/image';
import Link from 'next/link';
import { User, MapPin, Mail, Phone, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShareButton } from '@/components/ui/share-button';

export default function AisleHeader({ creator }) {
  const settings = creator?.aisleSettings || {};
  const accentColor = settings?.accentColor || '#3b82f6';
  
  const title = settings?.title || creator?.username || 'Creator';
  const bio = settings?.description || creator?.bio || '';
  const avatar = settings?.logo || creator?.avatar;
  const banner = settings?.heroImage || creator?.banner;
  
  const locationStr = [settings?.location, settings?.country].filter(Boolean).join(', ');

  return (
    <div className="relative mb-12">
      {/* 1. Widened Hero Banner */}
      <div className="h-72 md:h-96 relative overflow-hidden bg-slate-900">
        {banner ? (
          <Image src={banner} alt="Banner" fill className="object-cover" priority />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-slate-800 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      {/* 2. Widened Content Container (1600px) */}
      <div className="max-w-[1600px] mx-auto px-6 md:px-12">
        <div className="relative -mt-20 flex flex-col md:flex-row md:items-end gap-8 pb-8 border-b border-white/5">
          
          {/* Avatar on the Edge */}
          <div className="relative w-40 h-40 rounded-3xl border-8 border-background overflow-hidden bg-slate-800 flex-shrink-0 shadow-2xl">
            {avatar ? (
              <Image src={avatar} alt={title} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-slate-500">
                {title.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Text Info Stacked Vertically */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <div>
              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase italic">{title}</h1>
              {bio && <p className="text-slate-400 text-lg max-w-3xl mt-2 leading-relaxed">{bio}</p>}
            </div>
            
            {/* Contact Stats moved just above buttons */}
            <div className="flex flex-wrap gap-6 text-lg font-medium text-slate-300">
              {locationStr && <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-500" />{locationStr}</span>}
              {settings?.email && <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-500" />{settings.email}</span>}
              {settings?.phone && <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-500" />{settings.phone}</span>}
              {settings?.website && (
                <span className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-500" />
                  {settings.website.replace(/^https?:\/\//, '')}
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-2">
              <Button asChild style={{ backgroundColor: accentColor, color: '#fff' }} className="hover:opacity-90 rounded-full px-8 shadow-lg transition-transform hover:scale-105">
                <Link href={`/profile/${creator?.username}`}>
                  <User className="w-4 h-4 mr-2" /> Visit Profile
                </Link>
              </Button>
              <ShareButton 
                url={typeof window !== 'undefined' ? window.location.href : ''} 
                buttonText="Share My Aisle"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff' }}
                className="hover:bg-white/10 rounded-full px-8 border border-white/10 backdrop-blur-md"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}