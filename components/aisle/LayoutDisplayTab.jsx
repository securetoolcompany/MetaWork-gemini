'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const THEME_PRESETS = [
  {
    id: 'dark-professional',
    name: 'Dark Professional',
    preview: { bg: '#0f172a', card: '#1e293b', accent: '#3b82f6', text: '#ffffff' },
  },
  {
    id: 'light-clean',
    name: 'Light & Clean',
    preview: { bg: '#ffffff', card: '#f8fafc', accent: '#0ea5e9', text: '#1e293b' },
  },
  {
    id: 'bold-vibrant',
    name: 'Bold & Vibrant',
    preview: { bg: '#1a1a2e', card: '#16213e', accent: '#e94560', text: '#ffffff' },
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    preview: { bg: '#000000', card: '#1a1a1a', accent: '#ffffff', text: '#ffffff' },
  }
];

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
  const currentTheme = settings?.theme || 'dark-professional';
  const accentColor = settings?.accentColor || '#3b82f6';

  const handleThemeSelect = (themeId) => {
    updateSettings('theme', themeId);
    const theme = THEME_PRESETS.find(t => t.id === themeId);
    if (theme) {
      updateSettings('accentColor', theme.preview.accent);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Theme Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Theme Colors</CardTitle>
          <CardDescription>Customize your primary brand color</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            {THEME_PRESETS.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeSelect(theme.id)}
                className={cn(
                  "relative rounded-lg border-2 p-4 transition-all hover:shadow-lg text-left",
                  currentTheme === theme.id ? "border-primary ring-2 ring-primary" : "border-border"
                )}
              >
                <div className="text-sm font-medium">{theme.name}</div>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <div className="space-y-2 flex-1">
              <Label>Accent Color</Label>
              <div className="flex gap-2">
                <Input 
                  type="color" 
                  value={accentColor} 
                  onChange={(e) => updateSettings('accentColor', e.target.value)} 
                  className="w-20 h-10" 
                />
                <Input 
                  type="text" 
                  value={accentColor} 
                  onChange={(e) => updateSettings('accentColor', e.target.value)} 
                  className="flex-1" 
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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