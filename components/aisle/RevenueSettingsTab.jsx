'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const AD_PLACEMENTS = [
  {
    id: 'header',
    name: 'Header Banner Ad',
    description: 'Displayed at the top of your Aisle',
    estimate: '$15-30/month per 1,000 visitors',
    diagram: '━━━━━━━━━━━━━━━\n[    AD    ]\n━━━━━━━━━━━━━━━'
  },
  {
    id: 'sidebar',
    name: 'Sidebar Ad',
    description: 'Shows on the right side (desktop only)',
    estimate: '$20-40/month per 1,000 visitors',
    diagram: '┌─────┬──┐\n│     │AD│\n│     │  │\n└─────┴──┘'
  },
  {
    id: 'inGrid',
    name: 'In-Grid Ads',
    description: 'Appears between products in the grid',
    estimate: '$10-25/month per 1,000 visitors',
    diagram: '[P][P][AD][P]\n[P][P][P][AD]',
    hasFrequency: true
  }
];

const TIP_PLACEMENTS = [
  { id: 'header', name: 'Profile Header', description: 'In the profile section at top' },
  { id: 'floating', name: 'Floating Button', description: 'Bottom-right corner button' },
  { id: 'both', name: 'Both', description: 'Header and floating button' }
];

export default function RevenueSettingsTab({ settings, updateSettings }) {
  const aisleSettings = settings?.aisleSettings || {};
  const adSettings = aisleSettings.adSettings || {};

  return (
    <div className="space-y-6">
      {/* Ad Placements */}
      <Card data-tutorial="ad-placements">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Ad Placements
          </CardTitle>
          <CardDescription>Enable ad slots to generate additional revenue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {AD_PLACEMENTS.map((placement, index) => (
            <div 
              key={placement.id} 
              className="border border-border rounded-lg p-4 space-y-3"
              data-tutorial={
                placement.id === 'header' ? 'header-ad-toggle' :
                placement.id === 'sidebar' ? 'sidebar-ad-toggle' :
                placement.id === 'inGrid' ? 'grid-ad-toggle' : undefined
              }
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-foreground">{placement.name}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {adSettings[placement.id] ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{placement.description}</p>
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <DollarSign className="h-3 w-3" />
                    <span>Est: {placement.estimate}</span>
                  </div>
                </div>
                <Switch
                  checked={adSettings[placement.id] || false}
                  onCheckedChange={(checked) => 
                    updateSettings(`aisleSettings.adSettings.${placement.id}`, checked)
                  }
                />
              </div>

              {/* Visual Diagram */}
              <div className="bg-muted/50 rounded p-3 font-mono text-xs text-center text-muted-foreground">
                <pre className="whitespace-pre">{placement.diagram}</pre>
              </div>

              {/* Frequency Slider for In-Grid */}
              {placement.hasFrequency && adSettings.inGrid && (
                <div className="space-y-2 pt-2 border-t border-border" data-tutorial="ad-frequency">
                  <Label className="text-xs">Ad Frequency: Every {adSettings.inGridFrequency || 8} products</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[adSettings.inGridFrequency || 8]}
                      onValueChange={(value) => 
                        updateSettings('aisleSettings.adSettings.inGridFrequency', value[0])
                      }
                      min={6}
                      max={10}
                      step={1}
                      className="flex-1"
                    />
                    <div className="text-sm font-medium text-foreground w-12 text-right">
                      {adSettings.inGridFrequency || 8}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Lower = more ads, higher revenue (but may affect UX)</p>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Revenue Split Info */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base">Ad Revenue Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
            <span className="text-sm font-medium text-foreground">Your Split:</span>
            <span className="text-2xl font-bold text-primary">70%</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium text-foreground">MetaWork Platform:</span>
            <span className="text-2xl font-bold text-muted-foreground">30%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            💡 Revenue split is negotiated based on performance and traffic volume
          </p>
          <Button variant="outline" size="sm" className="w-full">
            <ExternalLink className="mr-2 h-4 w-4" />
            Request Custom Split
          </Button>
        </CardContent>
      </Card>

      {/* Tip Jar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Tip Jar
          </CardTitle>
          <CardDescription>Allow supporters to send you tips directly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg" data-tutorial="tip-jar-toggle">
            <div>
              <Label>Enable Tip Jar</Label>
              <p className="text-xs text-muted-foreground">Let fans support you with tips</p>
            </div>
            <Switch
              checked={aisleSettings.tipJarEnabled || false}
              onCheckedChange={(checked) => updateSettings('aisleSettings.tipJarEnabled', checked)}
            />
          </div>

          {aisleSettings.tipJarEnabled && (
            <div className="space-y-4 pt-2 border-t border-border">
              {/* Wallet Address */}
              <div className="space-y-2" data-tutorial="tip-wallet">
                <Label>Connected Wallet</Label>
                <div className="flex gap-2">
                  <Input
                    value={aisleSettings.tipJarWallet || ''}
                    onChange={(e) => updateSettings('aisleSettings.tipJarWallet', e.target.value)}
                    placeholder="0x..."
                    className="flex-1 font-mono text-sm"
                  />
                  <Button variant="outline">Change</Button>
                </div>
                <p className="text-xs text-muted-foreground">Tips will be sent to this wallet address</p>
              </div>

              {/* Preset Amounts */}
              <div className="space-y-2" data-tutorial="tip-presets">
                <Label>Preset Tip Amounts</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Input
                      type="number"
                      value={aisleSettings.tipPresets?.[0] || 5}
                      onChange={(e) => {
                        const presets = [...(aisleSettings.tipPresets || [5, 10, 25])];
                        presets[0] = parseFloat(e.target.value) || 5;
                        updateSettings('aisleSettings.tipPresets', presets);
                      }}
                      className="text-center"
                      min="1"
                    />
                  </div>
                  <div className="space-y-1">
                    <Input
                      type="number"
                      value={aisleSettings.tipPresets?.[1] || 10}
                      onChange={(e) => {
                        const presets = [...(aisleSettings.tipPresets || [5, 10, 25])];
                        presets[1] = parseFloat(e.target.value) || 10;
                        updateSettings('aisleSettings.tipPresets', presets);
                      }}
                      className="text-center"
                      min="1"
                    />
                  </div>
                  <div className="space-y-1">
                    <Input
                      type="number"
                      value={aisleSettings.tipPresets?.[2] || 25}
                      onChange={(e) => {
                        const presets = [...(aisleSettings.tipPresets || [5, 10, 25])];
                        presets[2] = parseFloat(e.target.value) || 25;
                        updateSettings('aisleSettings.tipPresets', presets);
                      }}
                      className="text-center"
                      min="1"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Quick tip amount options (in USD)</p>
              </div>

              {/* Button Customization */}
              <div className="space-y-2" data-tutorial="tip-button-text">
                <Label>Button Text</Label>
                <Input
                  value={aisleSettings.tipButtonText || 'Support My Work'}
                  onChange={(e) => updateSettings('aisleSettings.tipButtonText', e.target.value)}
                  placeholder="Support My Work"
                  maxLength={30}
                />
                <p className="text-xs text-muted-foreground">{(aisleSettings.tipButtonText || 'Support My Work').length}/30</p>
              </div>

              {/* Button Placement */}
              <div className="space-y-2" data-tutorial="tip-button-placement">
                <Label>Button Placement</Label>
                <div className="space-y-2">
                  {TIP_PLACEMENTS.map(placement => (
                    <button
                      key={placement.id}
                      onClick={() => updateSettings('aisleSettings.tipPlacement', placement.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border-2 transition-all",
                        aisleSettings.tipPlacement === placement.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-foreground text-sm">{placement.name}</div>
                          <div className="text-xs text-muted-foreground">{placement.description}</div>
                        </div>
                        <div className={cn(
                          "h-4 w-4 rounded-full border-2",
                          aisleSettings.tipPlacement === placement.id
                            ? "border-primary bg-primary"
                            : "border-muted-foreground"
                        )}>
                          {aisleSettings.tipPlacement === placement.id && (
                            <div className="h-full w-full rounded-full bg-white scale-50" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
