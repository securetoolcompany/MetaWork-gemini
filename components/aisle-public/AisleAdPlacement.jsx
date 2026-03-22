'use client';

import { Sparkles, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AisleAdPlacement({ type, accentColor }) {
  // Header Banner Ad
  if (type === 'header') {
    return (
      <div 
        className="relative overflow-hidden rounded-lg p-6 flex items-center justify-between"
        style={{ 
          background: `linear-gradient(135deg, ${accentColor}20, ${accentColor}10)`,
          borderLeft: `4px solid ${accentColor}`
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4" style={{ color: accentColor }} />
            <span className="text-xs font-semibold uppercase" style={{ color: accentColor }}>
              Sponsored
            </span>
          </div>
          <h3 className="text-lg font-bold mb-1">Premium Design Tools for Creators</h3>
          <p className="text-sm text-muted-foreground">Create stunning visuals in minutes with AI-powered design suite</p>
        </div>
        <Button style={{ backgroundColor: accentColor }} className="text-white">
          Learn More
          <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  // Sidebar Ad
  if (type === 'sidebar') {
    return (
      <div 
        className="rounded-lg p-4 border"
        style={{ borderColor: `${accentColor}40` }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-3 h-3" style={{ color: accentColor }} />
          <span className="text-xs font-semibold uppercase" style={{ color: accentColor }}>
            Sponsored
          </span>
        </div>
        
        <div className="aspect-square bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg mb-3 flex items-center justify-center">
          <Sparkles className="w-12 h-12 opacity-20" />
        </div>
        
        <h4 className="font-semibold mb-2 text-sm">Boost Your Creative Business</h4>
        <p className="text-xs text-muted-foreground mb-3">Tools and resources for growing creators</p>
        
        <Button size="sm" variant="outline" className="w-full">
          Discover
        </Button>
      </div>
    );
  }

  // In-Grid Ad
  if (type === 'in-grid') {
    return (
      <div 
        className="rounded-lg p-6 border flex flex-col items-center justify-center text-center min-h-[300px]"
        style={{ 
          borderColor: `${accentColor}40`,
          background: `linear-gradient(135deg, ${accentColor}10, transparent)`
        }}
      >
        <Sparkles className="w-8 h-8 mb-3" style={{ color: accentColor }} />
        <span className="text-xs font-semibold uppercase mb-2" style={{ color: accentColor }}>
          Sponsored Content
        </span>
        <h4 className="font-bold mb-2">Level Up Your Creative Game</h4>
        <p className="text-sm text-muted-foreground mb-4">Professional tools at creator-friendly prices</p>
        <Button size="sm" style={{ backgroundColor: accentColor }} className="text-white">
          Explore Now
        </Button>
      </div>
    );
  }

  return null;
}