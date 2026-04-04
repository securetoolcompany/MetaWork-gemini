'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  GripVertical, 
  Trash2, 
  Plus, 
  Star,
  Sparkles,
  LayoutGrid,
  Upload,
  Crop,
  Pencil,
  MapPin,
  Mail,
  Phone,
  Globe,
  X // <-- NEW IMPORT
} from 'lucide-react';
import { toast } from 'sonner';
import ImageCropper from '@/components/profile/ImageCropper';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Supported Social Platforms Array
const SOCIAL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'twitter', label: 'Twitter / X' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'twitch', label: 'Twitch' },
  { id: 'discord', label: 'Discord' },
  { id: 'website', label: 'Custom Link' }
];

// --- SORTABLE SECTION BLOCK ---
function SortableAisleSection({ section, updateSection, deleteSection, onOpenPicker, accentColor }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const items = section.items || [];

  return (
    <div ref={setNodeRef} style={style} className="mb-6 last:mb-0">
      <div className="group border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 md:p-6 hover:border-primary/50 transition-all bg-card/50">
        
        <div className="flex items-center gap-3 mb-4">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded transition-colors touch-none">
            <GripVertical className="w-5 h-5 text-muted-foreground" />
          </div>

          <Input
            value={section.title || ''}
            onChange={(e) => updateSection(section.id, 'title', e.target.value)}
            className="text-lg md:text-xl font-bold flex-1 bg-transparent border-none focus-visible:ring-1 p-0 h-auto"
            placeholder="Section Title (e.g., 'Summer Collection')..."
          />

          <Button
            size="sm"
            variant="ghost"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => {
              if (window.confirm('Delete this section from your Aisle?')) {
                deleteSection(section.id);
              }
            }}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>

        <div className="rounded-lg bg-background/30 p-4 border border-white/5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <LayoutGrid className="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm mb-4">This section is empty.</p>
              <Button 
                onClick={() => onOpenPicker(section.id)}
                style={{ backgroundColor: accentColor, color: '#fff' }}
                className="hover:opacity-90"
              >
                <Plus className="w-4 h-4 mr-2" /> Add First Item
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* NEW VISUAL THUMBNAIL GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {items.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="relative group/item rounded-md overflow-hidden border border-white/10 bg-black/50 aspect-square shadow-sm">
                    
                    <img 
                      src={item.imageUrl || '/placeholder.png'} 
                      alt={item.title} 
                      className="w-full h-full object-cover opacity-80 group-hover/item:opacity-100 group-hover/item:scale-105 transition-all duration-500"
                    />
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-2 pointer-events-none">
                       <span className="text-[10px] font-semibold text-white truncate w-full text-center drop-shadow-md">
                         {item.title}
                       </span>
                    </div>

                    {/* Badge for Type */}
                    <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider text-white border border-white/10">
                      {item.itemType === 'products' ? 'Product' : item.itemType}
                    </div>

                    {/* Delete Item Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newItems = items.filter(i => i.id !== item.id);
                        updateSection(section.id, 'items', newItems);
                      }}
                      className="absolute top-1.5 right-1.5 bg-red-500/90 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover/item:opacity-100 transition-opacity shadow-lg backdrop-blur-sm"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-2 pt-4 border-t border-white/5">
                <span className="text-xs text-muted-foreground">{items.length} items in this block</span>
                <Button variant="outline" size="sm" onClick={() => onOpenPicker(section.id)} className="border-dashed">
                  <Plus className="w-4 h-4 mr-2" /> Add Another
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- MAIN EDITOR COMPONENT ---
export default function AisleEditMode({ data, onUpdate, onOpenPicker }) {
  const [activeId, setActiveId] = useState(null);
  const [editingField, setEditingField] = useState(null);

  // --- CROPPER STATE ---
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImage, setCropperImage] = useState(null);
  const [cropperType, setCropperType] = useState(null); // 'heroImage' or 'logo'
  const [cropperAspect, setCropperAspect] = useState(16/9);
  const [cropperShape, setCropperShape] = useState('rect');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // --- CROPPER HELPERS ---
  const base64ToFile = async (base64, filename) => {
    const res = await fetch(base64);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type });
  };

  const uploadMedia = async (file, type = 'image') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderContext', 'aisle-assets');

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || 'Upload failed');
    return result.url;
  };

  const openCropper = (file, type, aspect = 16/9, shape = 'rect') => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropperImage(reader.result);
      setCropperType(type);
      setCropperAspect(aspect);
      setCropperShape(shape);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedImageBase64) => {
    const loadingToast = toast.loading(`Uploading ${cropperType === 'logo' ? 'logo' : 'banner'}...`);
    try {
      const file = await base64ToFile(croppedImageBase64, `${cropperType}-${Date.now()}.webp`);
      const secureUrl = await uploadMedia(file, 'image');

      if (cropperType === 'heroImage') {
        onUpdate({ heroImage: secureUrl });
      } else if (cropperType === 'logo') {
        onUpdate({ logo: secureUrl });
      }
      
      toast.success('Image updated successfully!', { id: loadingToast });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image.', { id: loadingToast });
    } finally {
      setCropperOpen(false);
      setCropperImage(null);
      setCropperType(null);
    }
  };

  // --- SECTION HELPERS ---
  const addSection = () => {
    const currentSections = data.aisleSections || [];
    const newSection = {
      id: `section_${Date.now()}`,
      title: `New Section ${currentSections.length + 1}`,
      items: []
    };
    onUpdate({ aisleSections: [...currentSections, newSection] });
    toast.success('New layout block added!');
  };

  const updateSection = (sectionId, field, value) => {
    const updatedSections = (data.aisleSections || []).map(section =>
      section.id === sectionId ? { ...section, [field]: value } : section
    );
    onUpdate({ aisleSections: updatedSections });
  };

  const deleteSection = (sectionId) => {
    const updatedSections = (data.aisleSections || []).filter(s => s.id !== sectionId);
    onUpdate({ aisleSections: updatedSections });
    toast.success('Section removed');
  };

  const handleDragStart = (event) => setActiveId(event.active.id);
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const sections = data.aisleSections || [];
      const oldIndex = sections.findIndex(s => s.id === active.id);
      const newIndex = sections.findIndex(s => s.id === over.id);
      onUpdate({ aisleSections: arrayMove(sections, oldIndex, newIndex) });
    }
    setActiveId(null);
  };

  // Active Socials List
  const activeSocialKeys = Object.keys(data.socialLinks || {});

  return (
    <div className="min-h-screen pb-24 bg-background">
      
      <ImageCropper
        open={cropperOpen}
        onClose={() => { setCropperOpen(false); setCropperImage(null); setCropperType(null); }}
        imageSrc={cropperImage}
        onCropComplete={handleCropComplete}
        aspectRatio={cropperAspect}
        cropShape={cropperShape}
        title={cropperType === 'heroImage' ? 'Crop Hero Banner' : 'Crop Logo'}
      />

      <div className="relative w-full h-[250px] md:h-[350px] group rounded-b-3xl overflow-hidden shadow-2xl">
        {data.heroImage ? (
          <img src={data.heroImage} alt="Hero Banner" className="w-full h-full object-cover" />
        ) : (
          <div 
            className="w-full h-full bg-gradient-to-br" 
            style={{ backgroundImage: `linear-gradient(135deg, ${data.accentColor || '#10b981'}40 0%, ${data.accentColor || '#10b981'}10 100%)` }} 
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent pointer-events-none" />

        <div className="absolute inset-0 z-[5] flex items-center justify-center p-4">
          <div className="flex flex-col sm:flex-row gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            {data.heroImage && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCropperImage(data.heroImage);
                  setCropperType('heroImage');
                  setCropperAspect(1200/300);
                  setCropperShape('rect');
                  setCropperOpen(true);
                }}
                className="bg-white/90 text-black backdrop-blur h-11"
              >
                <Crop className="w-4 h-4 mr-2" /> Adjust Banner
              </Button>
            )}
            <label className="cursor-pointer">
              <div className="bg-white/90 text-black h-11 px-4 rounded-md flex items-center justify-center text-sm font-medium backdrop-blur shadow-sm hover:bg-white transition-colors">
                <Upload className="w-4 h-4 mr-2" /> {data.heroImage ? 'Replace Banner' : 'Upload Banner'}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                if (e.target.files?.[0]) openCropper(e.target.files[0], 'heroImage', 1200/300, 'rect');
              }} />
            </label>
          </div>
        </div>
      </div>

      <div className="relative -mt-20 md:-mt-24 px-4 md:px-8 z-10 max-w-7xl mx-auto mb-12">
        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
          
          <div className="relative group">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-background bg-muted overflow-hidden shadow-2xl">
              {data.logo ? (
                <img src={data.logo} className="w-full h-full object-cover" alt="Aisle Logo" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full cursor-pointer opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <Pencil className="w-6 h-6 text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                if (e.target.files?.[0]) openCropper(e.target.files[0], 'logo', 1, 'round');
              }} />
            </label>
          </div>

          <div className="flex-1 space-y-2 pb-2 w-full md:w-auto">
            {editingField === 'title' ? (
              <Input
                value={data.title || ''}
                onChange={(e) => onUpdate({ title: e.target.value })}
                onBlur={() => setEditingField(null)}
                className="text-2xl md:text-4xl font-bold bg-background/50 h-auto text-center md:text-left"
                placeholder="Your Store Name"
                autoFocus
              />
            ) : (
              <h1 
                className="text-3xl md:text-5xl font-bold text-foreground cursor-pointer hover:text-primary transition-colors border-b-2 border-dashed border-transparent hover:border-primary/30 inline-block"
                onClick={() => setEditingField('title')}
              >
                {data.title || 'Click to add Store Name'}
              </h1>
            )}
            
            {editingField === 'description' ? (
              <Textarea
                value={data.description || ''}
                onChange={(e) => onUpdate({ description: e.target.value })}
                onBlur={() => setEditingField(null)}
                className="text-base bg-background/50 text-center md:text-left min-h-[80px]"
                placeholder="Describe your store..."
                autoFocus
              />
            ) : (
              <p 
                className="text-base md:text-lg text-muted-foreground cursor-pointer hover:text-foreground line-clamp-3"
                onClick={() => setEditingField('description')}
              >
                {data.description || 'Click to add a brief description of your store...'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
            <div className="border-2 border-primary/20 rounded-xl p-4 md:p-6 bg-card/30 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: data.accentColor || '#10b981' }} />
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <h3 className="text-xl font-bold">Featured Item</h3>
                </div>
                <Switch 
                  checked={data.featuredItemEnabled || false}
                  onCheckedChange={(checked) => onUpdate({ featuredItemEnabled: checked })}
                />
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                Highlight a specific product, IP asset, or collection at the very top of your Aisle.
              </p>
              
              {data.featuredItemEnabled && (
                <div className="space-y-4">
                  {/* NEW VISUAL PREVIEW FOR FEATURED ITEM */}
                  {data.featuredItemData && (
                    <div className="flex items-center gap-4 p-3 bg-black/40 rounded-lg border border-white/10 w-full max-w-sm">
                      <div className="w-16 h-16 rounded bg-muted/30 overflow-hidden shrink-0">
                        <img 
                          src={data.featuredItemData.imageUrl || '/placeholder.png'} 
                          alt="Featured" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-xs uppercase text-primary font-bold tracking-wider mb-1">
                          {data.featuredItemData.itemType === 'products' ? 'Product' : data.featuredItemData.itemType}
                        </span>
                        <span className="text-sm font-semibold text-white truncate">
                          {data.featuredItemData.title}
                        </span>
                      </div>
                    </div>
                  )}

                  <Button 
                    variant="outline" 
                    className="w-full md:w-auto border-dashed"
                    onClick={() => onOpenPicker('featured')} 
                  >
                    <Star className="w-4 h-4 mr-2" />
                    {data.featuredItemId ? 'Change Featured Item' : 'Select Featured Item'}
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold" style={{ color: data.accentColor || '#10b981' }}>
                  Aisle Layout Blocks
                </h2>
                <Button onClick={addSection} size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Add Block
                </Button>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={(data.aisleSections || []).map(s => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-6">
                    {(data.aisleSections || []).map((section) => (
                      <SortableAisleSection
                        key={section.id}
                        section={section}
                        updateSection={updateSection}
                        deleteSection={deleteSection}
                        onOpenPicker={onOpenPicker}
                        accentColor={data.accentColor || '#10b981'}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              
              {(data.aisleSections || []).length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/10">
                  <LayoutGrid className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">Build your Storefront</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-4">
                    Add blocks below your featured item to organize your products, IP, and collections.
                  </p>
                  <Button onClick={addSection}>
                    <Plus className="w-4 h-4 mr-2" /> Add First Block
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <Card className="p-6 border-2 border-dashed border-muted-foreground/30 sticky top-8">
              <h3 className="font-bold mb-4">Aisle Accent Color</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This color highlights buttons, prices, and section titles on your public Aisle.
              </p>
              <div className="flex flex-wrap gap-3">
                {['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'].map(color => (
                  <button
                    key={color}
                    className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${data.accentColor === color ? 'border-white ring-2 ring-primary shadow-lg scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => onUpdate({ accentColor: color })}
                  />
                ))}
              </div>
            </Card>

            <Card className="p-6 border-2 border-dashed border-muted-foreground/30">
              <h3 className="font-bold mb-4">Contact Info</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <Input value={data.location || ''} onChange={(e) => onUpdate({ location: e.target.value })} placeholder="Physical Location" />
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <Input type="email" value={data.email || ''} onChange={(e) => onUpdate({ email: e.target.value })} placeholder="Public Email" />
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <Input value={data.phone || ''} onChange={(e) => onUpdate({ phone: e.target.value })} placeholder="Public Phone" />
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-muted-foreground" />
                  <Input type="url" value={data.website || ''} onChange={(e) => onUpdate({ website: e.target.value })} placeholder="https://yourwebsite.com" />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-2 border-dashed border-muted-foreground/30">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold">Social Links</h3>
                <Select onValueChange={(val) => onUpdate({ socialLinks: { ...(data.socialLinks || {}), [val]: '' } })}>
                  <SelectTrigger className="w-[120px] h-8 text-xs bg-muted/50 border-none">
                    <SelectValue placeholder="+ Add Link" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIAL_PLATFORMS.filter(p => !activeSocialKeys.includes(p.id)).map(platform => (
                      <SelectItem key={platform.id} value={platform.id}>{platform.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                {activeSocialKeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2 bg-muted/20 rounded-md border border-white/5">
                    No social links added yet.
                  </p>
                ) : (
                  activeSocialKeys.map(platform => {
                    const platformConfig = SOCIAL_PLATFORMS.find(p => p.id === platform) || { label: platform };
                    const url = data.socialLinks[platform];
                    
                    return (
                      <div className="flex items-center gap-2" key={platform}>
                        <div className="w-[85px] text-xs font-bold text-muted-foreground shrink-0 truncate">
                          {platformConfig.label}
                        </div>
                        <Input 
                          type="url"
                          value={url || ''} 
                          onChange={(e) => onUpdate({ socialLinks: { ...(data.socialLinks || {}), [platform]: e.target.value } })} 
                          placeholder={platform === 'website' ? 'https://...' : `https://${platform}.com/...`} 
                          className="flex-1 h-9 bg-background/50"
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => {
                            const newSocials = { ...data.socialLinks };
                            delete newSocials[platform];
                            onUpdate({ socialLinks: newSocials });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

          </div>

        </div>
      </div>
    </div>
  );
}