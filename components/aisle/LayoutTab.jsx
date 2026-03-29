'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

// StrictModeDroppable helps beautiful-dnd work in Next.js
const StrictModeDroppable = ({ children, ...props }) => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);
  if (!enabled) return null;
  return <Droppable {...props}>{children}</Droppable>;
};

export default function LayoutTab({ 
  settings, 
  updateSettings, 
  products, 
  ipAssets, 
  collections,
  setCollections,
  setActiveTab
}) {
  const [dndEnabled, setDndEnabled] = useState(false);

  useEffect(() => {
    const animation = requestAnimationFrame(() => setDndEnabled(true));
    return () => cancelAnimationFrame(animation);
  }, []);

  const addSection = () => {
    const newSection = {
      id: Date.now().toString(),
      type: 'products',
      title: 'New Section',
      description: '',
      enabled: true,
      displayType: 'all-products',
      category: null,
      collectionId: null
    };
    updateSettings('sections', [...(settings.sections || []), newSection]);
  };

  const updateSection = (id, updates) => {
    const updatedSections = settings.sections.map(section => 
      section.id === id ? { ...section, ...updates } : section
    );
    updateSettings('sections', updatedSections);
  };

  const deleteSection = (id) => {
    updateSettings('sections', settings.sections.filter(section => section.id !== id));
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(settings.sections || []);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    updateSettings('sections', items);
    toast.success("Layout updated locally. Save to apply changes.");
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

  return (
    <div className="space-y-6">
      {/* Featured Spotlight */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Featured Spotlight</CardTitle>
              <CardDescription>Highlight one top-tier item at the very top of your aisle</CardDescription>
            </div>
            <Switch
              checked={!!settings?.featuredSpotlight?.enabled}
              onCheckedChange={(checked) => updateSettings('featuredSpotlight.enabled', checked)}
            />
          </div>
        </CardHeader>
        {settings?.featuredSpotlight?.enabled && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Spotlight Type</Label>
                <Select
                  value={settings?.featuredSpotlight?.type || 'product'}
                  onValueChange={(value) => updateSettings('featuredSpotlight.type', value)}
                >
                  <SelectTrigger><SelectValue placeholder="Choose type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="ip-asset">IP Asset</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Select Item</Label>
                <Select
                  value={settings?.featuredSpotlight?.itemId || ''}
                  onValueChange={(value) => updateSettings('featuredSpotlight.itemId', value)}
                >
                  <SelectTrigger><SelectValue placeholder="Choose an item" /></SelectTrigger>
                  <SelectContent>
                    {((settings?.featuredSpotlight?.type === 'product' ? products : ipAssets) || []).map(item => {
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

      {/* Dynamic Sections */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Aisle Sections</CardTitle>
              <CardDescription>Drag handles to reorder your page layout</CardDescription>
            </div>
            <Button size="sm" onClick={addSection}>
              <Plus className="w-4 h-4 mr-1" /> Add New Section
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {dndEnabled && (
            <DragDropContext onDragEnd={onDragEnd}>
              <StrictModeDroppable droppableId="sections">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                    {(settings.sections || []).map((section, index) => (
                      <Draggable key={section.id} draggableId={section.id} index={index}>
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.draggableProps} className="mb-4">
                            <Card className="bg-slate-900/50 border-slate-800">
                              <CardContent className="pt-6 space-y-4">
                                {/* Header Controls */}
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2 flex-1">
                                    <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-1">
                                      <GripVertical className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1">
                                      <Input
                                        value={section.title}
                                        onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                        placeholder="Section Title"
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
                                  value={section.description || ''}
                                  onChange={(e) => updateSection(section.id, { description: e.target.value })}
                                  placeholder="Optional subtitle for this section..."
                                  rows={1}
                                />
                                
                                {/* Content Type Logic */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Content Type</Label>
                                    <Select
                                      value={section.displayType}
                                      onValueChange={(val) => updateSection(section.id, { 
                                        displayType: val, 
                                        category: null, 
                                        collectionId: null,
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

                                  {/* Dynamic Logic Selectors */}
                                  {section.displayType === 'category' && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                      <Label>Select Category</Label>
                                      <Select
                                        value={section.category || ''}
                                        onValueChange={(val) => updateSection(section.id, { category: val })}
                                      >
                                        <SelectTrigger className="bg-background"><SelectValue placeholder="Choose category..." /></SelectTrigger>
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
    </div>
  );
}