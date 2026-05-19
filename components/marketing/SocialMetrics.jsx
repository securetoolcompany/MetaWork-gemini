'use client';

import { Badge } from '@/components/ui/badge';
import { Eye, Share2, Heart, MousePointerClick, Users, Star, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const METRICS = [
  {
    icon: Eye,
    label: 'Product Views',
    description: 'Times your product pages were viewed',
    color: 'text-blue-400',
  },
  {
    icon: MousePointerClick,
    label: 'Click-Through Rate',
    description: 'Views that resulted in add-to-cart',
    color: 'text-cyan-400',
  },
  {
    icon: Share2,
    label: 'Shares',
    description: 'Times your products were shared',
    color: 'text-violet-400',
  },
  {
    icon: Heart,
    label: 'Saves / Wishlist',
    description: 'Products saved by other users',
    color: 'text-pink-400',
  },
  {
    icon: Users,
    label: 'Profile Visits',
    description: 'Unique visits to your creator profile',
    color: 'text-orange-400',
  },
  {
    icon: Star,
    label: 'Reviews',
    description: 'Average rating across all products',
    color: 'text-yellow-400',
  },
  {
    icon: Clock,
    label: 'Avg. Time on Page',
    description: 'How long visitors spend on your listings',
    color: 'text-teal-400',
  },
];

export default function SocialMetrics() {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-bold">Social Metrics</h3>
        <Badge variant="outline" className="text-xs text-muted-foreground border-dashed">
          Coming Soon
        </Badge>
      </div>

      <div className="space-y-1">
        {METRICS.map(({ icon: Icon, label, description, color }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 opacity-50 select-none"
          >
            <div className={cn('shrink-0', color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground truncate">{description}</p>
            </div>
            <div className="h-5 w-10 rounded bg-muted/40" />
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
        Social metrics will be tracked automatically once view and share events are instrumented on product pages.
      </p>
    </div>
  );
}