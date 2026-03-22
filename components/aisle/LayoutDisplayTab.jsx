'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const CARD_STYLES = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Image + name + price only',
    preview: 'Clean and simple'
  },
  {
    id: 'standard',
    name: 'Standard',
    description: '+ creator attribution + hover effects',
    preview: 'Balanced design'
  },
  {
    id: 'detailed',
    name: 'Detailed',
    description: '+ description + sales count',
    preview: 'Maximum info'
  }
];

const HEADER_STYLES = [
  {
    id: 'full-banner',
    name: 'Full Banner',
    description: 'Large banner with overlapping avatar',
    preview: 'Most visual impact'
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Smaller banner, side-by-side layout',
    preview: 'Balanced space'
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'No banner, just avatar and name',
    preview: 'Clean and simple'
  }
];

export default function LayoutDisplayTab({ settings, updateSettings }) {
  const aisleSettings = settings?.aisleSettings || {};

  return (
    <div className="space-y-6">
      {/* Global Layout Settings */}
      <Card data-tutorial="global-products-row">
        <CardHeader>
          <CardTitle>Global Layout Settings</CardTitle>
          <CardDescription>Set default display preferences for your Aisle</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Products Per Row */}
          <div className="space-y-2">
            <Label>Default Products Per Row</Label>
            <p className="text-xs text-muted-foreground mb-3">How many products to show in each row</p>
            <div className="flex gap-2">
              {[2, 3, 4].map(num => (
                <Button
                  key={num}
                  variant={aisleSettings.productsPerRow === num ? 'default' : 'outline'}
                  onClick={() => updateSettings('aisleSettings.productsPerRow', num)}
                  className="flex-1"
                >
                  {num} Products
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Card Style */}
      <Card data-tutorial="card-style">
        <CardHeader>
          <CardTitle>Product Card Style</CardTitle>
          <CardDescription>Choose how much information to display on product cards</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {CARD_STYLES.map(style => (
              <button
                key={style.id}
                onClick={() => updateSettings('aisleSettings.cardStyle', style.id)}
                className={cn(
                  "w-full text-left p-4 rounded-lg border-2 transition-all hover:shadow-md",
                  aisleSettings.cardStyle === style.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-foreground mb-1">{style.name}</div>
                    <div className="text-sm text-muted-foreground">{style.description}</div>
                    <div className="text-xs text-muted-foreground mt-1 italic">{style.preview}</div>
                  </div>
                  <div className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center",
                    aisleSettings.cardStyle === style.id
                      ? "border-primary"
                      : "border-muted-foreground"
                  )}>
                    {aisleSettings.cardStyle === style.id && (
                      <div className="h-3 w-3 rounded-full bg-primary" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Aisle Header Style */}
      <Card data-tutorial="header-style">
        <CardHeader>
          <CardTitle>Aisle Header Style</CardTitle>
          <CardDescription>Configure how your profile appears at the top</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {HEADER_STYLES.map(style => (
              <button
                key={style.id}
                onClick={() => updateSettings('aisleSettings.headerStyle', style.id)}
                className={cn(
                  "w-full text-left p-4 rounded-lg border-2 transition-all hover:shadow-md",
                  aisleSettings.headerStyle === style.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-foreground mb-1">{style.name}</div>
                    <div className="text-sm text-muted-foreground">{style.description}</div>
                    <div className="text-xs text-muted-foreground mt-1 italic">{style.preview}</div>
                  </div>
                  <div className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center",
                    aisleSettings.headerStyle === style.id
                      ? "border-primary"
                      : "border-muted-foreground"
                  )}>
                    {aisleSettings.headerStyle === style.id && (
                      <div className="h-3 w-3 rounded-full bg-primary" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Product Sorting */}
      <Card data-tutorial="default-sorting">
        <CardHeader>
          <CardTitle>Default Product Sorting</CardTitle>
          <CardDescription>How products are ordered by default</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Default Sort Order</Label>
            <Select 
              value={aisleSettings.defaultSort || 'newest'} 
              onValueChange={(value) => updateSettings('aisleSettings.defaultSort', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="best-selling">Best Selling</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="trending">Trending</SelectItem>
                <SelectItem value="custom">Custom (in Collections)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Visibility Settings */}
      <Card data-tutorial="visibility-toggles">
        <CardHeader>
          <CardTitle>Visibility Settings</CardTitle>
          <CardDescription>Control what information is displayed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show "Powered by MetaWork" Badge</Label>
              <p className="text-xs text-muted-foreground">Display platform attribution in footer</p>
            </div>
            <Switch
              checked={aisleSettings.showPoweredBy || false}
              onCheckedChange={(checked) => updateSettings('aisleSettings.showPoweredBy', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Allow Product Reviews</Label>
              <p className="text-xs text-muted-foreground">Let customers leave reviews on products</p>
            </div>
            <Switch
              checked={aisleSettings.allowReviews || false}
              onCheckedChange={(checked) => updateSettings('aisleSettings.allowReviews', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Sales Counter on Products</Label>
              <p className="text-xs text-muted-foreground">Display number of sales per product</p>
            </div>
            <Switch
              checked={aisleSettings.showSalesCounter || false}
              onCheckedChange={(checked) => updateSettings('aisleSettings.showSalesCounter', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
