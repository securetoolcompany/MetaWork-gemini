'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Eye, Save } from 'lucide-react';
import ThemeBrandingTab from '@/components/aisle/ThemeBrandingTab';
import LayoutDisplayTab from '@/components/aisle/LayoutDisplayTab';
import CollectionsTab from '@/components/aisle/CollectionsTab';
import CommunityCurationTab from '@/components/aisle/CommunityCurationTab';
import FeaturesTab from '@/components/aisle/FeaturesTab'; // NEW
import LayoutTab from '@/components/aisle/LayoutTab'; // NEW
import AislePreview from '@/components/aisle/AislePreview';

export default function AisleSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [user, setUser] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [settings, setSettings] = useState({});
  const [collections, setCollections] = useState([]);
  const [products, setProducts] = useState([]);
  const [ipAssets, setIpAssets] = useState([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/aisle-settings');
      const data = await res.json();
      
      if (data.success) {
        setSettings(prev => ({ 
          ...prev, 
          ...data.aisleSettings,
          slug: data.aisleSettings.slug || data.user?.username
        }));
        setCollections(data.collections || []);
        setProducts(data.products || []);
        setIpAssets(data.ipAssets || []);
      }
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/aisle-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          aisleSettings: settings,
          collections: collections 
        })
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Settings saved successfully!');
      } else {
        throw new Error(data.error || 'Failed to save');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (key, value) => {
    setSettings(prev => {
      if (key.includes('.')) {
        const [parent, child] = key.split('.');
        return {
          ...prev,
          [parent]: {
            ...(prev[parent] || {}),
            [child]: value
          }
        };
      }
      return { ...prev, [key]: value };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl">
      {/* Header Section: Stacks on mobile, Rows on desktop */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold">Aisle Settings</h1>
          <p className="text-muted-foreground text-sm">Customize your creator storefront</p>
        </div>
        
        {/* Buttons: Full width and side-by-side on mobile */}
        <div className="flex gap-3 w-full md:w-auto">
          <Button 
            variant="outline" 
            onClick={() => setShowPreviewModal(true)}
            className="flex-1 md:flex-none h-11 md:h-10"
          >
            <Eye className="w-4 h-4 mr-2" /> Preview
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="flex-1 md:flex-none h-11 md:h-10"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-white/5">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="community">Community</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <ThemeBrandingTab settings={settings} updateSettings={updateSettings} />
        </TabsContent>
        
        <TabsContent value="layout">
          <LayoutTab 
            settings={settings} 
            updateSettings={updateSettings} 
            products={products} 
            ipAssets={ipAssets} 
            collections={collections} 
            setCollections={setCollections}
            setActiveTab={setActiveTab}
          />
        </TabsContent>

        <TabsContent value="collections">
          <CollectionsTab 
            settings={{ collections }} 
            updateSettings={(key, value) => setCollections(value)} 
            products={products} // <-- Ensure this is passed here
            ipAssets={ipAssets} 
          />
        </TabsContent>

        <TabsContent value="community">
          <CommunityCurationTab 
            creatorId={user?._id || settings.userId} 
            accentColor={settings.accentColor} 
          />
        </TabsContent>

        <TabsContent value="appearance">
          <LayoutDisplayTab settings={settings} updateSettings={updateSettings} />
        </TabsContent>

        <TabsContent value="features">
          <FeaturesTab settings={settings} updateSettings={updateSettings} />
        </TabsContent>

      </Tabs>

      {showPreviewModal && (
        <AislePreview
          settings={{
            aisleSettings: settings, 
            collections: collections, 
            username: settings.title || "Your Store",
            bio: settings.description,
            avatarUrl: settings.logo,
            bannerUrl: settings.heroImage
          }}
          products={products}
          ipAssets={ipAssets} 
          fullscreen={true}
          onCloseFullscreen={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
}