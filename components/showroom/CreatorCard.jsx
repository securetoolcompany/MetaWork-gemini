'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Package, 
  ImageIcon, 
  ExternalLink, 
  User,
  Crown,
  Star,
  Sparkles,
  MapPin
} from 'lucide-react';

// Country code to flag emoji mapping
const getCountryFlag = (countryCode) => {
  if (!countryCode) return null;
  const code = countryCode.toUpperCase();
  // Convert country code to flag emoji
  const flagOffset = 127397;
  try {
    return String.fromCodePoint(...[...code].map(c => c.charCodeAt(0) + flagOffset));
  } catch {
    return null;
  }
};

// Tier badge config
const tierConfig = {
  premium: { label: 'Premium', color: 'bg-gradient-to-r from-amber-500 to-yellow-500', icon: Crown },
  pro: { label: 'Pro', color: 'bg-gradient-to-r from-purple-500 to-indigo-500', icon: Star },
  free: { label: 'Creator', color: 'bg-slate-500', icon: null }
};

export default function CreatorCard({ creator, onViewProfile, compact = false }) {
  const [bannerError, setBannerError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  
  // Ensure we have valid data
  const creatorLink = creator.username || creator.slug || creator.id;
  const creatorName = creator.name || creator.username || creator.displayName || 'Creator';
  const creatorBio = creator.bio || '';
  const membershipTier = creator.membershipTier || 'free';
  const tierInfo = tierConfig[membershipTier] || tierConfig.free;
  
  // Get images with fallbacks
  const bannerUrl = creator.banner || creator.bannerUrl;
  const avatarUrl = creator.avatar || creator.avatarUrl;
  
  // Stats with fallbacks
  const stats = creator.stats || {};
  const totalProducts = stats.totalProducts || 0;
  const totalIPAssets = stats.totalIPAssets || 0;
  const isTrending = stats.trending || false;
  const isFeatured = stats.featured || false;
  
  // Country flag
  const countryFlag = getCountryFlag(creator.country);
  
  // Art style/medium badges (show first 3)
  const categoryBadges = [
    ...(creator.artStyles || []),
    ...(creator.mediums || [])
  ].slice(0, 3);

  const handleCardClick = (e) => {
    if (onViewProfile) {
      e.preventDefault();
      onViewProfile(creator);
    }
  };

  return (
    <Card 
      className="group overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 bg-card/80 backdrop-blur-sm border-border/50"
      onClick={handleCardClick}
    >
      {/* Banner with gradient overlay */}
      <div className="relative h-36 overflow-hidden">
        {bannerUrl && !bannerError ? (
          <Image
            src={bannerUrl}
            alt={`${creatorName} banner`}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-700"
            onError={() => setBannerError(true)}
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-purple-500/30 to-blue-500/40" />
        )}
        
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        
        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
          {/* Featured Badge */}
          {isFeatured && (
            <Badge className="bg-amber-500/90 text-white border-0 backdrop-blur-sm shadow-lg">
              <Star className="w-3 h-3 mr-1 fill-current" />
              Featured
            </Badge>
          )}
          
          {/* Trending Badge */}
          {isTrending && !isFeatured && (
            <Badge className="bg-emerald-500/90 text-white border-0 backdrop-blur-sm shadow-lg">
              <TrendingUp className="w-3 h-3 mr-1" />
              Trending
            </Badge>
          )}
          
          {/* Tier Badge */}
          <Badge className={`${tierInfo.color} text-white border-0 backdrop-blur-sm shadow-lg ml-auto`}>
            {tierInfo.icon && <tierInfo.icon className="w-3 h-3 mr-1" />}
            {tierInfo.label}
          </Badge>
        </div>

        {/* Avatar - positioned at bottom of banner */}
        <div className="absolute -bottom-10 left-4 z-10">
          <div className="w-20 h-20 rounded-full border-4 border-background overflow-hidden bg-muted shadow-xl group-hover:scale-105 transition-transform duration-300">
            {avatarUrl && !avatarError ? (
              <Image
                src={avatarUrl}
                alt={creatorName}
                width={80}
                height={80}
                className="object-cover w-full h-full"
                onError={() => setAvatarError(true)}
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-purple-500/20">
                <span className="text-2xl font-bold text-primary">
                  {creatorName[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pt-12">
        {/* Name and Country */}
        <div className="mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold group-hover:text-primary transition-colors line-clamp-1">
              {creatorName}
            </h3>
            {countryFlag && (
              <span className="text-lg" title={creator.country}>
                {countryFlag}
              </span>
            )}
          </div>
          
          {/* Bio */}
          {creatorBio && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {creatorBio}
            </p>
          )}
        </div>

        {/* Category Badges */}
        {categoryBadges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {categoryBadges.map((cat, idx) => (
              <Badge 
                key={idx} 
                variant="secondary" 
                className="text-xs px-2 py-0.5 bg-secondary/50"
                style={cat.color ? { borderLeft: `3px solid ${cat.color}` } : {}}
              >
                {cat.name || cat}
              </Badge>
            ))}
          </div>
        )}

        {/* Stats Bar */}
        <div className="flex items-center gap-4 py-3 border-y border-border/50 mb-4">
          <div className="flex items-center gap-1.5 text-sm">
            <Package className="w-4 h-4 text-blue-500" />
            <span className="font-semibold">{totalProducts}</span>
            <span className="text-muted-foreground text-xs">Products</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5 text-sm">
            <ImageIcon className="w-4 h-4 text-purple-500" />
            <span className="font-semibold">{totalIPAssets}</span>
            <span className="text-muted-foreground text-xs">IP Assets</span>
          </div>
        </div>

        {/* Hover Overlay CTA */}
        <div className="relative">
          <Button 
            className="w-full gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground"
          >
            <Sparkles className="w-4 h-4" />
            View Profile
            <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
