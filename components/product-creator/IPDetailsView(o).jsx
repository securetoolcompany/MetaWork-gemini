import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  ExternalLink
} from 'lucide-react';

export default function IPDetailsView({ ip, onBack, onSelect }) {
  if (!ip) return null;

  return (
    <div className="flex flex-col h-full bg-background text-foreground animate-in fade-in slide-in-from-right-4 duration-200">
      
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
        <div className="grid md:grid-cols-12 h-full">
          
          {/* Left: Image */}
          <div className="md:col-span-5 bg-muted/30 p-8 flex items-center justify-center border-r">
             <div className="relative aspect-square w-full max-w-sm rounded-lg overflow-hidden shadow-sm border bg-background">
                <img 
                  src={ip.imageUrl || ip.thumbnailUrl} 
                  alt={ip.name}
                  className="w-full h-full object-contain"
                />
             </div>
          </div>

          {/* Right: Info */}
          <div className="md:col-span-7 flex flex-col h-full">
            <ScrollArea className="flex-1">
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

                <Separator />

                {/* Author Card - NOW WITH LINK */}
                <div className="bg-muted/40 rounded-lg p-4 border border-muted flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg overflow-hidden">
                         {/* If we have avatar, use it, else fallback */}
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
                   
                   {/* Profile Link Button */}
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
                  <div className="flex gap-3">
                     <Button variant="outline" onClick={onBack}>
                        Keep Searching
                     </Button>
                     <Button onClick={() => onSelect(ip)} className="bg-blue-600 hover:bg-blue-500 text-white gap-2">
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
