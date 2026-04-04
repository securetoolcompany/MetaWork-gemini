'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ThemeBrandingTab({ settings, updateSettings }) {
  return (
    <div className="space-y-6">
      <Card className="border-2 border-muted-foreground/10 shadow-sm">
        <CardHeader>
          <CardTitle>Aisle Identity</CardTitle>
          <CardDescription>Core identifiers and meta details for your storefront.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <div className="space-y-2">
            <Label>Aisle Name</Label>
            <Input
              value={settings?.title || ''}
              onChange={(e) => updateSettings('title', e.target.value)}
              placeholder="e.g., Blake's MMA Gear"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Custom URL Slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline-block">
                metawork.com/aisle/
              </span>
              <Input
                value={settings?.slug || ''}
                onChange={(e) => updateSettings('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="your-aisle-name"
                className="font-mono bg-muted/50"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This is the permanent link you will share with your audience.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label>Meta Description</Label>
            <Textarea
              value={settings?.description || ''}
              onChange={(e) => updateSettings('description', e.target.value)}
              placeholder="Briefly describe your store for search engines and link previews..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Base Country</Label>
            <Select 
              value={settings?.country || 'US'} 
              onValueChange={(val) => updateSettings('country', val)}
            >
              <SelectTrigger className="w-full sm:max-w-xs">
                <SelectValue placeholder="Select Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">🇺🇸 United States</SelectItem>
                <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                <SelectItem value="AU">🇦🇺 Australia</SelectItem>
                <SelectItem value="KR">🇰🇷 South Korea</SelectItem>
                <SelectItem value="JP">🇯🇵 Japan</SelectItem>
                <SelectItem value="DE">🇩🇪 Germany</SelectItem>
                <SelectItem value="FR">🇫🇷 France</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}