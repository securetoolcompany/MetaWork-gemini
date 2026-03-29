'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function FeaturesTab({ settings, updateSettings }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Display Features</CardTitle>
          <CardDescription>Toggle what visitors see on your aisle</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Customer Reviews</Label>
              <p className="text-xs text-muted-foreground">Show product reviews and ratings</p>
            </div>
            <Switch
              checked={settings.showReviews || false}
              onCheckedChange={(checked) => updateSettings('showReviews', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Sales Counter</Label>
              <p className="text-xs text-muted-foreground">Display total sales on products</p>
            </div>
            <Switch
              checked={settings.showSalesCount || false}
              onCheckedChange={(checked) => updateSettings('showSalesCount', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Tip Jar</Label>
              <p className="text-xs text-muted-foreground">Allow visitors to leave tips</p>
            </div>
            <Switch
              checked={!!settings?.tipJarEnabled}
              onCheckedChange={(checked) => updateSettings('tipJarEnabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ad Placements</CardTitle>
          <CardDescription>Choose where ads appear on your aisle</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Top Banner Ad</Label>
              <p className="text-xs text-muted-foreground">Horizontal banner at the top</p>
            </div>
            <Switch
              checked={!!settings?.ads?.topBanner}
              onCheckedChange={(checked) => updateSettings('ads.topBanner', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Sidebar Ad</Label>
              <p className="text-xs text-muted-foreground">Vertical banner in sidebar</p>
            </div>
            <Switch
              checked={!!settings?.ads?.sidebar}
              onCheckedChange={(checked) => updateSettings('ads.sidebar', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>In-Grid Ad</Label>
              <p className="text-xs text-muted-foreground">Ads between products in grid</p>
            </div>
            <Switch
              checked={!!settings?.ads?.inGrid}
              onCheckedChange={(checked) => updateSettings('ads.inGrid', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}