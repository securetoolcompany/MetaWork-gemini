'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation'; // Added usePathname
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ShareButton } from '@/components/ui/share-button';
import { 
  User, 
  MapPin, 
  Info, 
  Tag, 
  DollarSign, 
  CheckCircle, 
  ArrowLeft,
  Paintbrush,
  Globe,
  Lock,
  ExternalLink,
  TrendingUp,
  ShoppingCart,
  Eye,
  Star
} from 'lucide-react';

export default function IPConsumerDialog({ ip, onBack, onSelect, ...props }) {
  const router = useRouter();
  const pathname = usePathname(); // Detect where the user is

  if (!ip) return null;

  // Check if we are currently on the creator page
  const isInsideCreator = pathname.includes('/products/creator');

  const handleAction = () => {
    if (isInsideCreator && onSelect) {
      // SCENARIO 1: User is in the Library Panel of the Creator
      // Apply the art directly to the canvas and close the dialog
      onSelect(ip);
    } else {
      // SCENARIO 2: User is in the Marketplace/Aisle
      // Send them to the creator with this IP pre-selected
      router.push(`/products/creator?ipId=${ip.id || ip._id}`);
    }
  }; 
  
  
  // Calculate stats
  const usageCount = ip.usageCount || 0;
  const totalRevenue = ip.totalRevenue || 0;
  const avgPrice = ip.avgProductPrice || 0;
  const viewCount = ip.viewCount || 0;

  return (
    <div className="flex flex-col min-h-0 h-full bg-background text-foreground animate-in fade-in slide-in-from-right-4 duration-200">      
      {/* Header / Nav */}
      <div className="flex items-center gap-3 p-4 border-b">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Library
        </Button>
        <div className="h-4 w-px bg-border" />
        <h2 className="font-semibold text-sm truncate">Asset Details</h2>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-0 flex-1 overflow-y-auto md:overflow-hidden">          
          {/* Left: Image */}
          <div className="md:col-span-4 lg:col-span-5 bg-muted/30 p-4 md:p-8 flex items-center justify-center border-b md:border-b-0 md:border-r">
            <div className="relative aspect-square w-full max-w-[250px] md:max-w-sm rounded-lg ...">
                <img 
                  src={ip.imageUrl || ip.thumbnailUrl} 
                  alt={ip.name}
                  className="w-full h-full object-contain"
                />
             </div>
          </div>

          {/* Right: Info */}
            <div className="md:col-span-8 lg:col-span-7 flex flex-col h-full min-h-0">            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">
                
                {/* Header Info */}
                <div>
                   <div className="flex items-start justify-between">
                      <div>
                        <h1 className="text-2xl font-bold">{ip.name}</h1>
                        <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                           <Badge variant="secondary">{ip.category}</Badge>
                           {ip.isPublic ? (
                              <span className="flex items-center gap-1 text-xs"><Globe className="h-3 w-3" /> Public License</span>
                           ) : (
                              <span className="flex items-center gap-1 text-xs"><Lock className="h-3 w-3" /> Private Asset</span>
                           )}
                        </div>
                      </div>
                      <div className="text-right">
                         <div className="text-2xl font-bold text-green-600 flex items-center justify-end gap-1">
                            <DollarSign className="h-5 w-5" />
                            {ip.licensingFee?.toFixed(2) || '0.00'}
                         </div>
                         <p className="text-xs text-muted-foreground">per product sold</p>
                      </div>
                   </div>
                </div>

                {/* GLOBAL STATS SECTION */}
                <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-lg p-4 border border-blue-200/50">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" /> 
                    Marketplace Performance
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Products Using This Design */}
                    <div className="bg-background/80 rounded-md p-3 border">
                      <div className="flex items-center gap-2 mb-1">
                        <ShoppingCart className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-muted-foreground">Products Listed</span>
                      </div>
                      <p className="text-2xl font-bold">{usageCount}</p>
                    </div>

                    {/* Total Revenue Generated */}
                    <div className="bg-background/80 rounded-md p-3 border">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-yellow-500" />
                        <span className="text-xs text-muted-foreground">Revenue</span>
                      </div>
                      <p className="text-2xl font-bold">${totalRevenue.toFixed(0)}</p>
                    </div>

                    {/* Average Product Price */}
                    <div className="bg-background/80 rounded-md p-3 border">
                      <div className="flex items-center gap-2 mb-1">
                        <Tag className="h-4 w-4 text-purple-500" />
                        <span className="text-xs text-muted-foreground">Avg Price</span>
                      </div>
                      <p className="text-2xl font-bold">${avgPrice.toFixed(2)}</p>
                    </div>

                    {/* Views/Interest */}
                    <div className="bg-background/80 rounded-md p-3 border">
                      <div className="flex items-center gap-2 mb-1">
                        <Eye className="h-4 w-4 text-blue-500" />
                        <span className="text-xs text-muted-foreground">Views</span>
                      </div>
                      <p className="text-2xl font-bold">{viewCount}</p>
                    </div>
                  </div>
                  
                  {/* Popularity Indicator */}
                  {usageCount > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Popularity:</span>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`h-3 w-3 ${i < Math.min(Math.ceil(usageCount / 5), 5) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                            />
                          ))}
                          <span className="ml-1 font-medium">
                            {usageCount >= 25 ? 'Trending' : usageCount >= 10 ? 'Popular' : 'Growing'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Author Card */}
                <div className="bg-muted/40 rounded-lg p-4 border border-muted flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg overflow-hidden">
                         {ip.ownerAvatar ? (
                             <img src={ip.ownerAvatar} alt={ip.ownerName} className="w-full h-full object-cover" />
                         ) : (
                             ip.ownerName ? ip.ownerName.charAt(0).toUpperCase() : 'U'
                         )}
                      </div>
                      <div>
                         <p className="font-medium text-sm">{ip.ownerName || 'Unknown Artist'}</p>
                         <p className="text-xs text-muted-foreground">Creator</p>
                      </div>
                   </div>
                   
                   {ip.ownerUsername && (
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="gap-2 text-xs h-8"
                         onClick={() => window.open(`/aisle/${ip.ownerUsername}`, '_blank')}
                       >
                         View Profile
                         <ExternalLink className="h-3 w-3" />
                       </Button>
                   )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                   <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-500" /> Description
                   </h3>
                   <p className="text-sm text-muted-foreground leading-relaxed">
                      {ip.description || "No description provided by the creator."}
                   </p>
                </div>

                {/* Tags */}
                {ip.tags && ip.tags.length > 0 && (
                   <div className="space-y-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                         <Tag className="h-4 w-4 text-purple-500" /> Tags
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                         {ip.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">#{tag}</Badge>
                         ))}
                      </div>
                   </div>
                )}
              </div>
            </ScrollArea>

            {/* Footer Action */}
            <div className="p-4 border-t bg-muted/10">
               <div className="flex items-center justify-between gap-4">
                  <div className="text-xs text-muted-foreground">
                     <p className="flex items-center gap-1.5">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Valid for commercial use
                     </p>
                  </div>
                  <div className="flex flex-wrap md:flex-nowrap gap-2 justify-end w-full">
                     <ShareButton 
                       url={typeof window !== 'undefined' ? `${window.location.origin}/ip/${ip.id || ip._id}` : ''}
                       title={`Check out this IP: ${ip.name}`}
                       text="License this IP to create your own products!"
                       buttonText="Share"
                       variant="outline"
                     />
                     <Button variant="outline" onClick={onBack}>
                        Keep Searching
                     </Button>
                     <Button onClick={() => onSelect?.(ip)}
                         className="bg-blue-600 hover:bg-blue-500 text-white gap-2">
                        <Paintbrush className="h-4 w-4" />
                        Use This IP
                     </Button>
                  </div>
               </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}