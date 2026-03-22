'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  ExternalLink, 
  Package, 
  ImageIcon, 
  Calendar,
  TrendingUp,
  Eye,
  Crown,
  Star,
  User,
  Globe,
  Twitter,
  Instagram
} from 'lucide-react';

// Country code to flag emoji mapping
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

// Tier badge config
const tierConfig = {
  premium: { label: 'Premium Creator', color: 'from-amber-500 to-yellow-500', icon: Crown },
  pro: { label: 'Pro Creator', color: 'from-purple-500 to-indigo-500', icon: Star },
  free: { label: 'Creator', color: 'from-slate-500 to-slate-600', icon: User }
};

export default function CreatorProfileDialog({ creator, open, onClose }) {
  const router = useRouter();
  const [bannerError, setBannerError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  
  if (!creator) return null;
  
  const creatorName = creator.name || creator.username || creator.displayName || 'Creator';
  const membershipTier = creator.membershipTier || 'free';
  const tierInfo = tierConfig[membershipTier] || tierConfig.free;
  const TierIcon = tierInfo.icon;
  
  const bannerUrl = creator.banner || creator.bannerUrl;
  const avatarUrl = creator.avatar || creator.avatarUrl;
  
  const stats = creator.stats || {};
  const countryFlag = getCountryFlag(creator.country);
  
  // Format date
  const memberSince = creator.createdAt 
    ? new Date(creator.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Unknown';
  
  // Category badges
  const allCategories = [
    ...(creator.artStyles || []).map(c => ({ ...c, type: 'art_style' })),
    ...(creator.mediums || []).map(c => ({ ...c, type: 'medium' })),
    ...(creator.commercialServices || []).map(c => ({ ...c, type: 'commercial' }))
  ];

  const handleVisitAisle = () => {
    router.push(`/aisle/${creator.username || creator.id}`);
    onClose();
  };

  const handleViewProfile = () => {
    router.push(`/profile/${creator.username || creator.id}`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-0 bg-background/95 backdrop-blur-xl">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Banner Background with Blur */}
        <div className="relative h-40">
          {bannerUrl && !bannerError ? (
            <>
              <Image
                src={bannerUrl}
                alt={`${creatorName} banner`}
                fill
                className="object-cover"
                onError={() => setBannerError(true)}
                unoptimized
              />
              <div className="absolute inset-0 backdrop-blur-sm bg-black/30" />
            </>
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${tierInfo.color} opacity-80`} />
          )}
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          
          {/* Tier Badge */}
          <Badge className={`absolute top-4 left-4 bg-gradient-to-r ${tierInfo.color} text-white border-0 shadow-lg`}>
            <TierIcon className="w-3 h-3 mr-1" />
            {tierInfo.label}
          </Badge>
        </div>

        {/* Profile Content */}
        <div className="relative px-6 pb-6 -mt-16">
          {/* Avatar */}
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="w-24 h-24 rounded-full border-4 border-background overflow-hidden bg-muted shadow-2xl">
              {avatarUrl && !avatarError ? (
                <Image
                  src={avatarUrl}
                  alt={creatorName}
                  width={96}
                  height={96}
                  className="object-cover w-full h-full"
                  onError={() => setAvatarError(true)}
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-purple-500/20">
                  <span className="text-3xl font-bold text-primary">
                    {creatorName[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
            </div>
            
            {/* Featured/Trending indicator */}
            {stats.featured && (
              <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-amber-500 shadow-lg">
                <Star className="w-4 h-4 text-white fill-white" />
              </div>
            )}
          </div>

          {/* Name and Country */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-2xl font-bold">{creatorName}</h2>
              {countryFlag && (
                <span className="text-2xl" title={creator.country}>
                  {countryFlag}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <Calendar className="w-3 h-3" />
              Member since {memberSince}
            </p>
          </div>

          {/* Bio */}
          {creator.bio && (
            <p className="text-center text-muted-foreground mb-6 leading-relaxed">
              {creator.bio}
            </p>
          )}

          {/* Category Badges */}
          {allCategories.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {allCategories.map((cat, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary"
                  className="px-3 py-1"
                  style={cat.color ? { 
                    backgroundColor: `${cat.color}20`,
                    borderColor: cat.color,
                    borderWidth: '1px'
                  } : {}}
                >
                  {cat.name || cat}
                </Badge>
              ))}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="text-center p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Package className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <div className="text-xl font-bold">{stats.totalProducts || 0}</div>
              <div className="text-xs text-muted-foreground">Products</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <ImageIcon className="w-5 h-5 mx-auto mb-1 text-purple-500" />
              <div className="text-xl font-bold">{stats.totalIPAssets || 0}</div>
              <div className="text-xs text-muted-foreground">IP Assets</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <TrendingUp className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
              <div className="text-xl font-bold">{stats.totalSales || 0}</div>
              <div className="text-xs text-muted-foreground">Sales</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Eye className="w-5 h-5 mx-auto mb-1 text-amber-500" />
              <div className="text-xl font-bold">{stats.monthlyViews || 0}</div>
              <div className="text-xs text-muted-foreground">Views</div>
            </div>
          </div>

          {/* Social Links */}
          {(creator.portfolioUrl || creator.socials?.twitter || creator.socials?.instagram) && (
            <div className="flex justify-center gap-3 mb-6">
              {creator.portfolioUrl && (
                <a 
                  href={creator.portfolioUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 rounded-full bg-muted hover:bg-primary/20 transition-colors"
                >
                  <Globe className="w-5 h-5" />
                </a>
              )}
              {creator.socials?.twitter && (
                <a 
                  href={`https://twitter.com/${creator.socials.twitter}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 rounded-full bg-muted hover:bg-blue-500/20 transition-colors"
                >
                  <Twitter className="w-5 h-5" />
                </a>
              )}
              {creator.socials?.instagram && (
                <a 
                  href={`https://instagram.com/${creator.socials.instagram}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 rounded-full bg-muted hover:bg-pink-500/20 transition-colors"
                >
                  <Instagram className="w-5 h-5" />
                </a>
              )}
            </div>
          )}

          {/* CTA Buttons */}
          <div className="flex gap-3">
            <Button 
              className="flex-1 gap-2 h-12 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg"
              onClick={handleVisitAisle}
            >
              <Package className="w-4 h-4" />
              Visit Their Aisle
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 gap-2 h-12"
              onClick={handleViewProfile}
            >
              <User className="w-4 h-4" />
              View Full Profile
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
