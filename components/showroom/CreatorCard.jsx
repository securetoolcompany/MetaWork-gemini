'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Package, 
  ImageIcon as LucideImageIcon, 
  ExternalLink, 
  Crown,
  Star,
  Sparkles,
  MapPin
} from 'lucide-react';
import AisleDetailDialog from './AisleDetailDialog';

const getCountryFlag = (countryCode) => {
  if (!countryCode) return null;
  const code = countryCode.toUpperCase();
  const flagOffset = 127397;
  try {
    return String.fromCodePoint(...[...code].map(c => c.charCodeAt(0) + flagOffset));
  } catch {
    return null;
  }
};

const tierConfig = {
  premium: { label: 'Premium', color: 'bg-gradient-to-r from-amber-500 to-yellow-500', icon: Crown },
  pro: { label: 'Pro', color: 'bg-gradient-to-r from-purple-500 to-indigo-500', icon: Star },
  free: { label: 'Creator', color: 'bg-slate-500', icon: null }
};

export default function CreatorCard({ creator, compact = false }) {
  const [bannerError, setBannerError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
// 1. Check for standard creator properties OR nested aisle.user properties
  const creatorName = creator.name || creator.user?.name || creator.title || creator.username || creator.user?.username || 'Creator';
  const creatorBio = creator.bio || creator.description || '';
  
  // 2. Map the tier, checking the nested user object as well
  const membershipTier = creator.membershipTier || creator.user?.membershipTier || 'free';
  const tierInfo = tierConfig[membershipTier] || tierConfig.free;
  
  // 3. Map images (including aisle.headerImage)
  const bannerUrl = creator.banner || creator.bannerUrl || creator.headerImage;
  const avatarUrl = creator.aisleSettings?.logo || creator.avatar || '/placeholder-avatar.png';  
  // 4. Map stats (aisles return totalProducts at the root level)
  const stats = creator.stats || creator.user?.stats || {};
  const totalProducts = creator.totalProducts ?? stats.totalProducts ?? 0;
  const totalIPAssets = creator.totalIPAssets ?? stats.totalIPAssets ?? 0;
  
  const isTrending = stats.trending || false;
  const isFeatured = stats.featured || false;  
  const countryFlag = getCountryFlag(creator.country);
  const categoryBadges = [...(creator.artStyles || []), ...(creator.mediums || [])].slice(0, 3);

  return (
    <>
      <Card 
        onClick={() => setIsDialogOpen(true)}
        className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-2xl hover:border-primary/50"
      >
        {/* 1. Banner Section */}
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
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          
          <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
            {isFeatured && (
              <Badge className="bg-amber-500/90 text-white border-0 backdrop-blur-sm shadow-lg">
                <Star className="w-3 h-3 mr-1 fill-current" />
                Featured
              </Badge>
            )}
            {isTrending && !isFeatured && (
              <Badge className="bg-emerald-500/90 text-white border-0 backdrop-blur-sm shadow-lg">
                <TrendingUp className="w-3 h-3 mr-1" />
                Trending
              </Badge>
            )}
            <Badge className={`${tierInfo.color} text-white border-0 backdrop-blur-sm shadow-lg ml-auto`}>
              {tierInfo.icon && <tierInfo.icon className="w-3 h-3 mr-1" />}
              {tierInfo.label}
            </Badge>
          </div>
        </div>

        {/* 2. Content Section (Avatar sits here now) */}
        <div className="p-4 pt-0">
          {/* Full Circle Avatar with Negative Margin */}
          <div className="relative z-20 -mt-10 mb-3">
            <div className="w-20 h-20 rounded-full border-4 border-card overflow-hidden bg-muted shadow-xl group-hover:scale-105 transition-transform duration-300">
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

          {/* Name and Bio */}
          <div className="mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold group-hover:text-primary transition-colors line-clamp-1">
                {creatorName}
              </h3>
              {countryFlag && <span className="text-lg">{countryFlag}</span>}
            </div>
            {creatorBio && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{creatorBio}</p>}
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-4 py-3 border-y border-border/50 mb-4">
            <div className="flex items-center gap-1.5 text-sm">
              <Package className="w-4 h-4 text-blue-500" />
              <span className="font-semibold">{totalProducts}</span>
              <span className="text-muted-foreground text-xs">Products</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5 text-sm">
              <LucideImageIcon className="w-4 h-4 text-purple-500" />
              <span className="font-semibold">{totalIPAssets}</span>
              <span className="text-muted-foreground text-xs">IP Assets</span>
            </div>
          </div>

          {/* Action Button */}
          <Button className="w-full gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300">
            <Sparkles className="w-4 h-4" />
            View Aisle Details
          </Button>
        </div>
      </Card>

      {/* The Detail Dialog */}
      <AisleDetailDialog 
        aisle={creator} 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
      />
    </>
  );
}