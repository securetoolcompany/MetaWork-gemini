'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const THEME_PRESETS = [
  {
    id: 'dark-professional',
    name: 'Dark Professional',
    preview: { bg: '#0f172a', card: '#1e293b', accent: '#3b82f6', text: '#ffffff' },
    fonts: 'inter-system'
  },
  {
    id: 'light-clean',
    name: 'Light & Clean',
    preview: { bg: '#ffffff', card: '#f8fafc', accent: '#0ea5e9', text: '#1e293b' },
    fonts: 'poppins-inter'
  },
  {
    id: 'bold-vibrant',
    name: 'Bold & Vibrant',
    preview: { bg: '#1a1a2e', card: '#16213e', accent: '#e94560', text: '#ffffff' },
    fonts: 'montserrat-roboto'
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    preview: { bg: '#000000', card: '#1a1a1a', accent: '#ffffff', text: '#ffffff' },
    fonts: 'space-inter'
  }
];

export default function ThemeBrandingTab({ settings, updateSettings }) {
  const currentTheme = settings?.aisleSettings?.theme || 'dark-professional';
  const accentColor = settings?.aisleSettings?.accentColor || '#3b82f6';

  const handleThemeSelect = (themeId) => {
    updateSettings('aisleSettings.theme', themeId);
    const theme = THEME_PRESETS.find(t => t.id === themeId);
    if (theme) {
      updateSettings('aisleSettings.accentColor', theme.preview.accent);
      updateSettings('aisleSettings.fontPairing', theme.fonts);
    }
  };

  const handleFileUpload = (type, event) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      if (type === 'banner') {
        updateSettings('bannerUrl', url);
      } else if (type === 'avatar') {
        updateSettings('avatarUrl', url);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Theme Presets */}
      <Card data-tutorial="theme-presets">
        <CardHeader>
          <CardTitle>Theme Presets</CardTitle>
          <CardDescription>Choose a starting point for your Aisle</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {THEME_PRESETS.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeSelect(theme.id)}
                className={cn(
                  "relative rounded-lg border-2 p-4 transition-all hover:shadow-lg",
                  currentTheme === theme.id
                    ? "border-primary ring-2 ring-primary ring-offset-2"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="space-y-3">
                  {/* Preview */}
                  <div className="h-20 rounded-md overflow-hidden" style={{ backgroundColor: theme.preview.bg }}>
                    <div className="p-2 space-y-1">
                      <div className="h-3 rounded" style={{ backgroundColor: theme.preview.card, width: '80%' }} />
                      <div className="h-2 rounded" style={{ backgroundColor: theme.preview.accent, width: '60%' }} />
                    </div>
                  </div>
                  {/* Name */}
                  <div className="text-sm font-medium text-foreground">{theme.name}</div>
                  {/* Radio */}
                  <div className="absolute top-2 right-2">
                    <div className={cn(
                      "h-4 w-4 rounded-full border-2",
                      currentTheme === theme.id
                        ? "border-primary bg-primary"
                        : "border-muted-foreground"
                    )}>
                      {currentTheme === theme.id && (
                        <div className="h-full w-full rounded-full bg-white scale-50" />
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Accent Color */}
      <Card data-tutorial="accent-color">
        <CardHeader>
          <CardTitle>Accent Color</CardTitle>
          <CardDescription>Customize your primary brand color</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="space-y-2 flex-1">
              <Label>Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={accentColor}
                  onChange={(e) => updateSettings('aisleSettings.accentColor', e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={accentColor}
                  onChange={(e) => updateSettings('aisleSettings.accentColor', e.target.value)}
                  className="flex-1"
                  placeholder="#3b82f6"
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const theme = THEME_PRESETS.find(t => t.id === currentTheme);
                if (theme) updateSettings('aisleSettings.accentColor', theme.preview.accent);
              }}
            >
              Reset to Default
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Branding Assets */}
      <Card>
        <CardHeader>
          <CardTitle>Branding Assets</CardTitle>
          <CardDescription>Upload your logo and banner images</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Banner */}
          <div className="space-y-2" data-tutorial="banner-upload">
            <Label>Banner Image</Label>
            <p className="text-xs text-muted-foreground">Recommended: 1200x300px</p>
            {settings?.bannerUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img src={settings.bannerUrl} alt="Banner" className="w-full h-32 object-cover" />
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2"
                  onClick={() => updateSettings('bannerUrl', null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Click to upload banner</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload('banner', e)} />
              </label>
            )}
          </div>

          {/* Avatar/Logo */}
          <div className="space-y-2" data-tutorial="logo-upload">
            <Label>Profile Picture / Logo</Label>
            <p className="text-xs text-muted-foreground">Recommended: 128x128px, circular crop</p>
            {settings?.avatarUrl ? (
              <div className="relative inline-block">
                <img src={settings.avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-2 border-border" />
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute -top-2 -right-2 rounded-full h-6 w-6 p-0"
                  onClick={() => updateSettings('avatarUrl', null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-border rounded-full cursor-pointer hover:border-primary transition-colors">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload('avatar', e)} />
              </label>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bio */}
      <Card data-tutorial="bio-text">
        <CardHeader>
          <CardTitle>Bio</CardTitle>
          <CardDescription>Tell your audience about your brand</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={settings?.bio || ''}
            onChange={(e) => updateSettings('bio', e.target.value)}
            placeholder="Tell your audience about your brand..."
            maxLength={300}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground mt-2 text-right">
            {(settings?.bio || '').length}/300
          </p>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card data-tutorial="social-links">
        <CardHeader>
          <CardTitle>Social Links</CardTitle>
          <CardDescription>Connect your social media profiles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Twitter / X</Label>
            <Input
              type="url"
              value={settings?.socials?.twitter || ''}
              onChange={(e) => updateSettings('socials.twitter', e.target.value)}
              placeholder="https://twitter.com/yourusername"
            />
          </div>
          <div className="space-y-2">
            <Label>Instagram</Label>
            <Input
              type="url"
              value={settings?.socials?.instagram || ''}
              onChange={(e) => updateSettings('socials.instagram', e.target.value)}
              placeholder="https://instagram.com/yourusername"
            />
          </div>
          <div className="space-y-2">
            <Label>TikTok</Label>
            <Input
              type="url"
              value={settings?.socials?.tiktok || ''}
              onChange={(e) => updateSettings('socials.tiktok', e.target.value)}
              placeholder="https://tiktok.com/@yourusername"
            />
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input
              type="url"
              value={settings?.socials?.website || ''}
              onChange={(e) => updateSettings('socials.website', e.target.value)}
              placeholder="https://yourwebsite.com"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
