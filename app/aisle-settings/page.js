'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, ExternalLink, Save } from 'lucide-react'; // Changed Eye to ExternalLink

// Existing Components we kept
import ThemeBrandingTab from '@/components/aisle/ThemeBrandingTab';
import CollectionsTab from '@/components/aisle/CollectionsTab';
import FeaturesTab from '@/components/aisle/FeaturesTab'; 

// NEW Storefront Builder Components
import AisleEditMode from '@/components/aisle/AisleEditMode';
import AisleItemPickerModal from '@/components/aisle/AisleItemPickerModal';

export default function AisleSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('storefront'); // Defaults to the new builder
  const [user, setUser] = useState(null);

  const [settings, setSettings] = useState({});
  const [collections, setCollections] = useState([]);
  const [products, setProducts] = useState([]);
  const [ipAssets, setIpAssets] = useState([]);

  // Picker Modal State
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(null);

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
        setUser(data.user);
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
  
  const handleLayoutUpdate = (updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const handleOpenPicker = (sectionId) => {
    setActiveSectionId(sectionId);
    setIsPickerOpen(true);
  };

  const handleSelectItems = (sectionId, newItems) => {
    if (sectionId === 'featured') {
      setSettings(prev => ({ 
        ...prev, 
        featuredItemId: newItems[0].id,
        featuredItemType: newItems[0].itemType,
        featuredItemData: newItems[0] // Stores local reference for instant UI updates
      }));
    } else {
      setSettings(prev => {
        const currentSections = prev.aisleSections || [];
        const updatedSections = currentSections.map(sec => {
          if (sec.id === sectionId) {
            // Prevent exact duplicates, but allow appending
            const existingIds = (sec.items || []).map(i => i.id);
            const filteredNewItems = newItems.filter(i => !existingIds.includes(i.id));
            return { ...sec, items: [...(sec.items || []), ...filteredNewItems] };
          }
          return sec;
        });
        return { ...prev, aisleSections: updatedSections };
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold">Aisle Settings</h1>
          <p className="text-muted-foreground text-sm">Customize your creator storefront</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          {/* UPDATED VIEW BUTTON */}
          <Button 
            variant="outline" 
            onClick={() => window.open(`/aisle/${settings.slug || user?.username}`, '_blank')}
            className="flex-1 md:flex-none h-11 md:h-10"
          >
            <ExternalLink className="w-4 h-4 mr-2" /> View Public Aisle
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
        <TabsList className="bg-slate-900 border border-white/5 flex flex-wrap h-auto p-1">
          <TabsTrigger value="storefront" className="flex-1 md:flex-none">Storefront Builder</TabsTrigger>
          <TabsTrigger value="basic" className="flex-1 md:flex-none">Basic Info</TabsTrigger>
          <TabsTrigger value="collections" className="flex-1 md:flex-none">Collections</TabsTrigger>
          <TabsTrigger value="features" className="flex-1 md:flex-none">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="storefront" className="mt-6 border-none p-0 outline-none">
          <AisleEditMode 
            data={settings} 
            onUpdate={handleLayoutUpdate} 
            onOpenPicker={handleOpenPicker} 
          />
        </TabsContent>

        <TabsContent value="basic" className="mt-6">
          <ThemeBrandingTab settings={settings} updateSettings={updateSettings} />
        </TabsContent>
        
        <TabsContent value="collections" className="mt-6">
          <CollectionsTab 
            settings={{ collections }} 
            updateSettings={(key, value) => setCollections(value)} 
            products={products} 
            ipAssets={ipAssets} 
          />
        </TabsContent>

        <TabsContent value="features" className="mt-6">
          <FeaturesTab settings={settings} updateSettings={updateSettings} />
        </TabsContent>

      </Tabs>

      {/* The Item Picker Modal */}
      <AisleItemPickerModal 
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        sectionId={activeSectionId}
        maxSelection={activeSectionId === 'featured' ? 1 : null}
        accentColor={settings.accentColor || '#10b981'}
        onSelectItems={handleSelectItems}
      />
    </div>
  );
}