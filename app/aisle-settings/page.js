'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Upload, Eye, Save, Plus, Trash2, GripVertical, X } from 'lucide-react';
import Image from 'next/image';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import CommunityCurationTab from '@/components/aisle/CommunityCurationTab';
import AislePreview from '@/components/aisle/AislePreview';

const StrictModeDroppable = ({ 
  children, 
  isDropDisabled = false, 
  isCombineEnabled = false, 
  ignoreContainerClipping = false,
  ...props 
}) => {
  const [enabled, setEnabled] = useState(false);
  
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <Droppable 
      {...props} 
      isDropDisabled={isDropDisabled} 
      isCombineEnabled={isCombineEnabled} 
      ignoreContainerClipping={ignoreContainerClipping}
    >
      {children}
    </Droppable>
  );
};

export default function AisleSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [user, setUser] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [settings, setSettings] = useState({
    // ... your initial settings state
  });

  const [collections, setCollections] = useState([]);
  const [products, setProducts] = useState([]);
  const [ipAssets, setIpAssets] = useState([]);

  // FIXED: Logic moved to component level and made sequential
  // Inside AisleSettingsPage component

  // 1. THIS IS YOUR NEW, SUPER SIMPLE USE EFFECT
  useEffect(() => {
    // Just call this one function, it does all the work now!
    fetchSettings();
    
    // This solves the Invariant failed error
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => cancelAnimationFrame(animation);
  }, []);

  // 2. THIS IS YOUR FETCH SETTINGS (It looks perfect in your message)
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
        
        // This is the magic! It saves the 167 products right to your page
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
    console.log("💾 Save initiated..."); // Add this for debugging
    
    try {
      const res = await fetch('/api/aisle-settings', {
        method: 'PUT', // Ensure this matches your API route (PUT vs POST)
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          aisleSettings: settings,
          collections: collections 
        })
      });
      
      const data = await res.json();

      // 🛑 DEBUGGING BLOCK 🛑
      console.log("=== FRONTEND DEBUG ===");
      console.log("Payload from API:", data);
      console.log("Products Array:", data.products);
      console.log("IP Assets Array:", data.ipAssets);
      console.log("======================");

      console.log("📡 Server response:", data);

      if (data.success) {
        toast.success('Settings saved successfully!');
      } else {
        throw new Error(data.error || 'Failed to save');
      }
    } catch (error) {
      console.error("❌ Save Error:", error);
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(settings.sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setSettings({
      ...settings,
      sections: items
    });
    
    toast.success("Layout updated locally. Save to apply changes.");
  };

  const handleImageUpload = async (file, field) => {
    const formData = new FormData();
    formData.append('file', file);
    // Pattern: ALWAYS use folderContext for organization
    formData.append('folderContext', 'aisle-assets'); 
    
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        // data.url is the Cloudinary URL returned by the pipeline
        setSettings(prev => ({ ...prev, [field]: data.url }));
        toast.success(`${field === 'logo' ? 'Logo' : 'Banner'} uploaded!`);
      }
    } catch (error) {
      toast.error('Failed to upload image');
    }
  };

  const createCollection = () => {
    const newCollection = {
      id: Date.now().toString(),
      name: 'New Collection',
      description: '',
      type: 'products',
      itemIds: [],
      publishDate: ''
    };
    setCollections([...collections, newCollection]);
  };

  const updateCollection = (id, updates) => {
    setCollections(prev => 
      prev.map(col => col.id === id ? { ...col, ...updates } : col)
    );
  };

  const deleteCollection = (id) => {
    setCollections(prev => prev.filter(col => col.id !== id));
  };

const addSection = () => {
    const newSection = {
      id: Date.now().toString(),
      type: 'products', // Internal data model
      title: 'New Section',
      description: '',
      enabled: true,
      displayType: 'all-products', // The key for our new logic
      category: null,
      collectionId: null
    };
    setSettings(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
  };

  const updateSection = (id, updates) => {
    setSettings(prev => ({
      ...prev,
      sections: prev.sections.map(section => 
        section.id === id ? { ...section, ...updates } : section
      )
    }));
  };

  const deleteSection = (id) => {
    setSettings(prev => ({
      ...prev,
      sections: prev.sections.filter(section => section.id !== id)
    }));
  };

  const handlePreview = () => {
    setShowPreviewModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Aisle Settings</h1>
          <p className="text-muted-foreground">Customize your creator storefront</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handlePreview}>
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="basic">Basic Info</TabsTrigger>
        <TabsTrigger value="layout">Layout</TabsTrigger>
        <TabsTrigger value="collections">Collections</TabsTrigger>
        <TabsTrigger value="community">Community</TabsTrigger> {/* Add this */}
        <TabsTrigger value="appearance">Appearance</TabsTrigger>
        <TabsTrigger value="features">Features</TabsTrigger>
      </TabsList>

        {/* BASIC INFO TAB */}
        <TabsContent value="basic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Aisle Identity</CardTitle>
              <CardDescription>Your aisle's name, URL, and description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Aisle Name</Label>
                <Input
                  value={settings.title || ''}
                  onChange={(e) => setSettings({...settings, title: e.target.value})}
                  placeholder="e.g., Blake's MMA Gear"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave blank to use your full name
                </p>
              </div>

              <div>
                <Label>Custom URL Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">metawork.com/aisle/</span>
                  <Input
                    value={settings.slug || ''}
                    onChange={(e) => setSettings({...settings, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                    placeholder="your-aisle-name"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  This will be your aisle's web address
                </p>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={settings.description || ''}
                  onChange={(e) => setSettings({...settings, description: e.target.value})}
                  placeholder="Describe your aisle and what you offer..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used for SEO and social media previews
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
              <CardDescription>Hero banner and profile logo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Hero Image */}
              <div>
                <Label>Hero Banner</Label>
                <div className="mt-2 border-2 border-dashed rounded-lg p-4 text-center">
                  {settings.heroImage ? (
                    <div className="relative">
                      <Image src={settings.heroImage} alt="Hero" width={800} height={200} className="rounded-lg mx-auto" />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => setSettings({...settings, heroImage: ''})}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click to upload banner (1200x300px recommended)</p>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e.target.files[0], 'heroImage')}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Logo */}
              <div>
                <Label>Logo / Profile Picture</Label>
                <div className="mt-2 border-2 border-dashed rounded-lg p-4 text-center">
                  {settings.logo ? (
                    <div className="relative inline-block">
                      <Image src={settings.logo} alt="Logo" width={150} height={150} className="rounded-full mx-auto" />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-0 right-0"
                        onClick={() => setSettings({...settings, logo: ''})}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click to upload logo (500x500px recommended)</p>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e.target.files[0], 'logo')}
                      />
                    </label>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Social Media Links</CardTitle>
              <CardDescription>Display your social profiles on your aisle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.keys(settings?.socialLinks ?? {}).map((platform) => (
                <div key={platform}>
                  <Label className="capitalize">{platform}</Label>
                  <Input
                    value={settings?.socialLinks?.[platform] ?? ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        socialLinks: {
                          ...(settings?.socialLinks ?? {}),
                          [platform]: e.target.value,
                        },
                      })
                    }
                    placeholder={`https://${platform}.com/yourprofile`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

{/* LAYOUT TAB */}
        <TabsContent value="layout" className="space-y-6">
          {/* Featured Spotlight Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Featured Spotlight</CardTitle>
                  <CardDescription>Highlight one top-tier item at the very top of your aisle</CardDescription>
                </div>
                <Switch
                  checked={!!settings?.featuredSpotlight?.enabled}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      featuredSpotlight: {
                        ...(settings?.featuredSpotlight ?? {}),
                        enabled: checked,
                      },
                    })
                  }
                />
              </div>
            </CardHeader>
            {settings?.featuredSpotlight?.enabled && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Spotlight Type</Label>
                    <Select
                      value={settings?.featuredSpotlight?.type ?? ''}
                      onValueChange={(value) =>
                        setSettings((prev) => ({
                          ...(prev || {}),
                          featuredSpotlight: {
                            ...(prev?.featuredSpotlight || {}),
                            type: value,
                            itemId: null,
                          },
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="product">Product</SelectItem>
                        <SelectItem value="ip-asset">IP Asset</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Select Item</Label>
                    <Select
                      value={settings.featuredSpotlight.itemId || ''}
                      onValueChange={(value) => setSettings({
                        ...settings,
                        featuredSpotlight: { ...settings.featuredSpotlight, itemId: value }
                      })}
                    >
                      <SelectTrigger><SelectValue placeholder="Choose an item" /></SelectTrigger>
                      <SelectContent>
                        {(settings.featuredSpotlight.type === 'product' ? products : ipAssets).map(item => {
                          // Standardize the ID here
                          const itemId = item.id || item._id?.toString();
                          return (
                            <SelectItem key={itemId} value={itemId}>
                              {item.title || item.name}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Dynamic Aisle Sections */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Aisle Sections</CardTitle>
                  <CardDescription>Drag handles to reorder your page layout</CardDescription>
                </div>
                <Button size="sm" onClick={() => addSection('products')}>
                  <Plus className="w-4 h-4 mr-1" /> Add New Section
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {enabled && (
              <DragDropContext onDragEnd={onDragEnd}>
                <StrictModeDroppable droppableId="sections">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                      {settings.sections.map((section, index) => (
                        <Draggable key={section.id} draggableId={section.id} index={index}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} className="mb-4">
                              <Card className="bg-slate-900/50 border-slate-800">
                                <CardContent className="pt-6 space-y-4">
                                  {/* Section Header Controls */}
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2 flex-1">
                                      <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-1">
                                        <GripVertical className="w-5 h-5 text-muted-foreground" />
                                      </div>
                                      <div className="flex-1">
                                        <Input
                                          value={section.title}
                                          onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                          placeholder="Section Title (e.g. Combat Sports)"
                                          className="font-semibold bg-background"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                      <Switch
                                        checked={section.enabled}
                                        onCheckedChange={(checked) => updateSection(section.id, { enabled: checked })}
                                      />
                                      <Button variant="ghost" size="sm" onClick={() => deleteSection(section.id)}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>

                                  <Textarea
                                    value={section.description}
                                    onChange={(e) => updateSection(section.id, { description: e.target.value })}
                                    placeholder="Optional subtitle for this section..."
                                    rows={1}
                                  />

                                  {/* Selection Logic */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Content Type</Label>
                                      <Select
                                        value={section.displayType}
                                        onValueChange={(val) => updateSection(section.id, { 
                                          displayType: val, 
                                          category: null, 
                                          collectionId: null,
                                          // Sync the internal type based on the selection
                                          type: val.includes('ip-assets') ? 'ip-assets' : 'products'
                                        })}
                                      >
                                        <SelectTrigger className="bg-background">
                                          <SelectValue placeholder="Select source..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="all-products">All My Products</SelectItem>
                                          <SelectItem value="all-ip-assets">All My IP Assets</SelectItem>
                                          <SelectItem value="category">Specific Category</SelectItem>
                                          <SelectItem value="collection">Hand-Picked Collection</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {/* DYNAMIC CATEGORY SELECTOR */}
                                    {section.displayType === 'category' && (
                                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                        <Label>Select Category</Label>
                                        <Select
                                          value={section.category || ''}
                                          onValueChange={(val) => updateSection(section.id, { category: val, title: val })}
                                        >
                                          <SelectTrigger className="bg-background">
                                            <SelectValue placeholder="Choose category..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {[...new Set(
                                              (section.type === 'products' ? products : ipAssets)
                                                .flatMap(item => Array.isArray(item.categories) ? item.categories : (item.category ? [item.category] : []))
                                                .filter(Boolean)
                                            )].sort().map(cat => (
                                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}

                                    {/* COLLECTION SELECTOR (Keep your existing one, but add the Plus button) */}
                                    {section.displayType === 'collection' && (
                                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                        <Label>Select Collection</Label>
                                        <div className="flex gap-2">
                                          <Select
                                            value={section.collectionId || ''}
                                            onValueChange={(val) => updateSection(section.id, { collectionId: val })}
                                          >
                                            <SelectTrigger className="flex-1"><SelectValue placeholder="Choose group..." /></SelectTrigger>
                                            <SelectContent>
                                              {collections.map(col => (
                                                <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <Button variant="outline" size="icon" onClick={() => { createCollection(); setActiveTab('collections'); }}>
                                            <Plus className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </StrictModeDroppable>
              </DragDropContext>
              )}
            </CardContent>
          </Card>
        </TabsContent>        
        
        {/* COLLECTIONS TAB */}
<TabsContent value="collections" className="space-y-6">
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>Collections</CardTitle>
          <CardDescription>Group products or IP assets together</CardDescription>
        </div>
        <Button onClick={createCollection}>
          <Plus className="w-4 h-4 mr-2" />
          New Collection
        </Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      {collections.map(collection => (
        <Card key={collection.id}>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-4">
                <Input
                  value={collection.name}
                  onChange={(e) => updateCollection(collection.id, { name: e.target.value })}
                  placeholder="Collection name"
                  className="font-semibold"
                />
                
                <Textarea
                  value={collection.description}
                  onChange={(e) => updateCollection(collection.id, { description: e.target.value })}
                  placeholder="Collection description"
                  rows={2}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={collection.type}
                      onValueChange={(value) => updateCollection(collection.id, { type: value, itemIds: [] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="products">Products</SelectItem>
                        <SelectItem value="ip-assets">IP Assets</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Publish Date (Optional)</Label>
                    <Input
                      type="datetime-local"
                      value={collection.publishDate}
                      onChange={(e) => updateCollection(collection.id, { publishDate: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label>Items ({collection.itemIds.length})</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Select {collection.type === 'products' ? 'products' : 'IP assets'} for this collection
                  </p>
                  
                  <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
                    {(collection.type === 'products' ? products : ipAssets).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No {collection.type === 'products' ? 'products' : 'IP assets'} available. Create some first!
                      </p>
                    ) : (
                      (collection.type === 'products' ? products : ipAssets).map(item => {
                        const itemId = item.id || item._id?.toString();
                        const isSelected = collection.itemIds.includes(itemId);
                        
                        return (
                          <div 
                            key={itemId}
                            className="flex items-center gap-2 p-2 hover:bg-accent rounded-md cursor-pointer"
                            onClick={() => {
                              const newItemIds = isSelected
                                ? collection.itemIds.filter(id => id !== itemId)
                                : [...collection.itemIds, itemId];
                              updateCollection(collection.id, { itemIds: newItemIds });
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4"
                            />
                            <span className="flex-1 text-sm">
                              {item.name || item.title || 'Untitled'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-2">
                    {collection.itemIds.length} items selected
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteCollection(collection.id)}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {collections.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No collections yet. Click &quot;New Collection&quot; to get started.
        </p>
      )}
    </CardContent>
  </Card>
</TabsContent>

        <TabsContent value="community">
          <CommunityCurationTab 
            creatorId={user?._id || settings.userId} 
            accentColor={settings.accentColor} 
          />
        </TabsContent>

        {/* APPEARANCE TAB */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Theme & Colors</CardTitle>
              <CardDescription>Customize your aisle's look and feel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Theme</Label>
                <Select
                  value={settings.theme}
                  onValueChange={(value) => setSettings({...settings, theme: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark-professional">Dark Professional</SelectItem>
                    <SelectItem value="light-modern">Light Modern</SelectItem>
                    <SelectItem value="bold-vibrant">Bold Vibrant</SelectItem>
                    <SelectItem value="monochrome">Monochrome</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={settings.bgColor}
                      onChange={(e) => setSettings({...settings, bgColor: e.target.value})}
                      className="w-20 h-10"
                    />
                    <Input
                      value={settings.bgColor}
                      onChange={(e) => setSettings({...settings, bgColor: e.target.value})}
                      placeholder="#0f172a"
                    />
                  </div>
                </div>

                <div>
                  <Label>Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={settings.accentColor}
                      onChange={(e) => setSettings({...settings, accentColor: e.target.value})}
                      className="w-20 h-10"
                    />
                    <Input
                      value={settings.accentColor}
                      onChange={(e) => setSettings({...settings, accentColor: e.target.value})}
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Header Style</Label>
                <Select
                  value={settings.headerStyle}
                  onValueChange={(value) => setSettings({...settings, headerStyle: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-banner">Full Banner</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Layout Options</CardTitle>
              <CardDescription>Control how items are displayed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Products Per Row</Label>
                <Select
                  value={settings.productsPerRow.toString()}
                  onValueChange={(value) => setSettings({...settings, productsPerRow: parseInt(value)})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Columns</SelectItem>
                    <SelectItem value="3">3 Columns</SelectItem>
                    <SelectItem value="4">4 Columns</SelectItem>
                    <SelectItem value="5">5 Columns</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Items Per Section</Label>
                <Input
                  type="number"
                  min="4"
                  max="50"
                  step="4"
                  value={settings.itemsPerSection}
                  onChange={(e) => setSettings({...settings, itemsPerSection: parseInt(e.target.value)})}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Number of items to show before pagination
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FEATURES TAB */}
        <TabsContent value="features" className="space-y-6">
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
                  checked={settings.showReviews}
                  onCheckedChange={(checked) => setSettings({...settings, showReviews: checked})}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Sales Counter</Label>
                  <p className="text-xs text-muted-foreground">Display total sales on products</p>
                </div>
                <Switch
                  checked={settings.showSalesCount}
                  onCheckedChange={(checked) => setSettings({...settings, showSalesCount: checked})}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Tip Jar</Label>
                  <p className="text-xs text-muted-foreground">Allow visitors to leave tips</p>
                </div>
                <Switch
                  checked={settings.tipJarEnabled}
                  onCheckedChange={(checked) => setSettings({...settings, tipJarEnabled: checked})}
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
                  checked={settings.ads.topBanner}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    ads: { ...settings.ads, topBanner: checked }
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Sidebar Ad</Label>
                  <p className="text-xs text-muted-foreground">Vertical banner in sidebar</p>
                </div>
                <Switch
                  checked={settings.ads.sidebar}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    ads: { ...settings.ads, sidebar: checked }
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>In-Grid Ad</Label>
                  <p className="text-xs text-muted-foreground">Ads between products in grid</p>
                </div>
                <Switch
                  checked={settings.ads.inGrid}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    ads: { ...settings.ads, inGrid: checked }
                  })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {/* Put this right before the final closing </div> */}
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