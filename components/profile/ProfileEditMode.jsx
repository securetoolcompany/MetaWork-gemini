'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Heart, 
  Store, 
  Mail, 
  MapPin, 
  Phone, 
  Globe,
  Upload,
  Pencil,
  Image as ImageIcon,
  Video,
  Plus,
  Trash2,
  GripVertical,
  Crop,
  Sparkles,
  Eye,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import MediaGrid from '@/components/profile/MediaGrid';
import ImageCropper from '@/components/profile/ImageCropper';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay
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

function SortableStorySection({ section, updateStorySection, deleteStorySection, data, onUpdate, accentColor }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-6 last:mb-0">
      <div className="group border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 md:p-6 hover:border-primary/50 transition-all bg-card/50">
        
        {/* Header: Drag Handle, Title, and Delete */}
        <div className="flex items-center gap-3 mb-4">
          {/* Drag Handle - touch-none is critical for mobile DND */}
          <div 
            {...attributes} 
            {...listeners} 
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded transition-colors touch-none"
          >
            <GripVertical className="w-5 h-5 text-muted-foreground" />
          </div>

          <Input
            value={section.title || ''}
            onChange={(e) => updateStorySection(section.id, 'title', e.target.value)}
            className="text-lg md:text-xl font-bold flex-1 bg-transparent border-none focus-visible:ring-1 p-0 h-auto"
            placeholder="Chapter title..."
          />

          <Button
            size="sm"
            variant="ghost"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => {
              if (window.confirm('Delete this chapter?')) {
                deleteStorySection(section.id);
              }
            }}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>

        {/* Chapter Description */}
        <Textarea
          value={section.description || ''}
          onChange={(e) => updateStorySection(section.id, 'description', e.target.value)}
          className="mb-6 text-base bg-background/50"
          placeholder="Describe this chapter of your story..."
          rows={3}
        />

        {/* Media Grid Integration */}
        <div className="rounded-lg bg-background/30 p-2 md:p-4">
          <MediaGrid
            title=""
            description="Add photos, videos, or audio"
            galleryKey={`storySection_${section.id}`}
            data={data}
            onUpdate={onUpdate}
            accentColor={accentColor}
            allowTypes={['image', 'video', 'audio']}
          />
        </div>
      </div>
    </div>
  );
}

export default function ProfileEditMode({ data, onUpdate }) {
  const [editingField, setEditingField] = useState(null);
  const [bioMode, setBioMode] = useState(data.bioMode || 'image'); // 'image' or 'video'
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [activeId, setActiveId] = useState(null);
  
  // Image cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImage, setCropperImage] = useState(null);
  const [cropperType, setCropperType] = useState(null); // 'hero', 'profile', 'bio'
  const [cropperAspect, setCropperAspect] = useState(16/9);
  const [cropperShape, setCropperShape] = useState('rect');
  const [isUploading, setIsUploading] = useState(false);

  // HELPER: Convert base64 to File object
  const base64ToFile = async (base64, filename) => {
    const res = await fetch(base64);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type });
  };

  // HELPER: Send file to Cloudinary API
  const uploadMedia = async (file, type = 'image') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    formData.append('folderContext', 'profile-media');

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await res.json();
    if (!result.success) throw new Error(result.error || 'Upload failed');
    return result.url; // The secure Cloudinary URL
  };

  // Setup drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  const countryFlags = {
    US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺',
    KR: '🇰🇷', JP: '🇯🇵', DE: '🇩🇪', FR: '🇫🇷',
  };

  // Open cropper with image
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

  // Handle cropped image result
  const handleCropComplete = async (croppedImageBase64) => {
    setIsUploading(true);
    const loadingToast = toast.loading('Uploading image to Cloudinary...');
    
    try {
      const file = await base64ToFile(croppedImageBase64, `${cropperType}-${Date.now()}.webp`);
      const secureUrl = await uploadMedia(file, 'image');

      switch (cropperType) {
        case 'hero':
          onUpdate({ heroMedia: { type: 'image', url: secureUrl } });
          break;
        case 'profile':
          onUpdate({ profilePicture: { url: secureUrl } });
          break;
        case 'bio':
          onUpdate({ bioImage: { type: 'image', url: secureUrl } });
          break;
      }
      toast.success('Image updated successfully!', { id: loadingToast });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image.', { id: loadingToast });
    } finally {
      setIsUploading(false);
      setCropperOpen(false);
      setCropperImage(null);
      setCropperType(null);
    }
  };

  // Handle Video Upload
  const handleVideoUpload = async (file) => {
    setIsUploading(true);
    const loadingToast = toast.loading('Uploading video... this might take a minute.');

    try {
      const secureUrl = await uploadMedia(file, 'video');
      onUpdate({ 
        bioVideo: { type: 'video', url: secureUrl },
        bioMode: 'video'
      });
      setBioMode('video');
      toast.success('Video uploaded successfully!', { id: loadingToast });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload video.', { id: loadingToast });
    } finally {
      setIsUploading(false);
    }
  };

  const handleYouTubeUrl = () => {
    if (youtubeUrl) {
      const videoId = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1];
      if (videoId) {
        onUpdate({ 
          bioVideo: { type: 'youtube', url: `https://www.youtube.com/embed/${videoId}` },
          bioMode: 'video'
        });
        setBioMode('video');
        setYoutubeUrl('');
        toast.success('YouTube video added!');
      } else {
        toast.error('Invalid YouTube URL');
      }
    }
  };

  const addStorySection = () => {
    const currentSections = data.storySections || [];
    const newSection = {
      id: Date.now(),
      title: `Chapter ${currentSections.length + 1}`,
      media: []
    };
    onUpdate({ storySections: [...currentSections, newSection] });
    toast.success('New story section added!');
  };

  const updateStorySection = (sectionId, field, value) => {
    const updatedSections = (data.storySections || []).map(section =>
      section.id === sectionId ? { ...section, [field]: value } : section
    );
    onUpdate({ storySections: updatedSections });
  };

  const deleteStorySection = (sectionId) => {
    const updatedSections = (data.storySections || []).filter(s => s.id !== sectionId);
    onUpdate({ storySections: updatedSections });
    toast.success('Section removed');
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const sections = data.storySections || [];
      const oldIndex = sections.findIndex(s => s.id === active.id);
      const newIndex = sections.findIndex(s => s.id === over.id);

      const reorderedSections = arrayMove(sections, oldIndex, newIndex);
      onUpdate({ storySections: reorderedSections });
      toast.success('Chapters reordered');
    }

    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeSection = (data.storySections || []).find(s => s.id === activeId);

  // Active Socials List (used to filter the dropdown)
  const activeSocialKeys = Object.keys(data.socialLinks || {});

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* 1. Image Cropper Modal */}
      <ImageCropper
        open={cropperOpen}
        onClose={() => {
          setCropperOpen(false);
          setCropperImage(null);
          setCropperType(null);
        }}
        imageSrc={cropperImage}
        onCropComplete={handleCropComplete}
        aspectRatio={cropperAspect}
        cropShape={cropperShape}
        title={
          cropperType === 'hero' ? 'Crop Hero Image' :
          cropperType === 'profile' ? 'Crop Profile Picture' :
          cropperType === 'bio' ? 'Crop Bio Image' : 'Crop Image'
        }
      />

      {/* 2. Hero Media Section */}
      <div className="relative w-full h-[300px] md:h-[400px] group">
        {data.heroMedia?.type === 'image' && data.heroMedia.url ? (
          <img src={data.heroMedia.url} alt="Hero" className="w-full h-full object-cover" />
        ) : (
          <div 
            className="w-full h-full bg-gradient-to-br" 
            style={{
              backgroundImage: `linear-gradient(135deg, ${data.accentColor}40 0%, ${data.accentColor}10 100%)`
            }} 
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent pointer-events-none" />

        {/* Hero Edit Overlay */}
        <div className="absolute inset-0 z-[5] flex items-center justify-center p-4">
          <div className="flex flex-col sm:flex-row gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCropperImage(data.heroMedia.url);
                setCropperType('hero');
                setCropperAspect(16/9);
                setCropperShape('rect');
                setCropperOpen(true);
              }}
              className="bg-white/90 text-black backdrop-blur h-11"
            >
              <Crop className="w-4 h-4 mr-2" />
              Adjust Hero
            </Button>
            <label className="cursor-pointer">
              <div className="bg-white/90 text-black h-11 px-4 rounded-md flex items-center justify-center text-sm font-medium backdrop-blur">
                <Upload className="w-4 h-4 mr-2" />
                Replace Hero
              </div>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) openCropper(file, 'hero', 16/9, 'rect');
                }} 
              />
            </label>
          </div>
        </div>
      </div>

      {/* 3. Main Settings Header (Matches Aisle Settings) */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex gap-3 w-full md:w-auto">
          </div>
        </div>
      </div>

      {/* 4. Profile Identity Section (Avatar/Name/Tagline) */}
      <div className="relative -mt-32 md:-mt-40 px-4 md:px-8 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
            {/* Profile Picture Upload */}
            <div className="relative group">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-background bg-muted overflow-hidden shadow-2xl">
                {data.profilePicture?.url ? (
                  <img src={data.profilePicture.url} className="w-full h-full object-cover" alt="Profile" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full cursor-pointer opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <Pencil className="w-6 h-6 text-white" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) openCropper(file, 'profile', 1, 'round');
                  }} 
                />
              </label>
            </div>

            {/* Identity Info */}
            <div className="flex-1 space-y-2 pb-2">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="text-3xl md:text-4xl">{countryFlags[data.country]}</span>
                {editingField === 'displayName' ? (
                  <Input
                    value={data.displayName || ''}
                    onChange={(e) => onUpdate({ displayName: e.target.value })}
                    onBlur={() => setEditingField(null)}
                    className="text-2xl md:text-4xl font-bold bg-background/50 h-auto"
                    autoFocus
                  />
                ) : (
                  <h1 
                    className="text-3xl md:text-5xl font-bold text-foreground cursor-pointer hover:text-primary transition-colors border-b-2 border-dashed border-transparent hover:border-primary/30"
                    onClick={() => setEditingField('displayName')}
                  >
                    {data.displayName}
                  </h1>
                )}
              </div>
              
              {editingField === 'tagline' ? (
                <Input
                  value={data.tagline || ''}
                  onChange={(e) => onUpdate({ tagline: e.target.value })}
                  onBlur={() => setEditingField(null)}
                  className="text-lg bg-background/50"
                  autoFocus
                />
              ) : (
                <p 
                  className="text-lg md:text-xl text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => setEditingField('tagline')}
                >
                  {data.tagline}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Content Grid */}
      <div className="max-w-7xl mx-auto p-4 md:p-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-12">
            
            {/* Biography / Story Section */}
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-4 md:p-8 hover:border-primary/50 transition-colors bg-card/30">
              <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <h2 
                  className="text-2xl font-bold cursor-pointer px-2 py-1 rounded"
                  style={{ color: data.accentColor }}
                  onClick={() => setEditingField('bioSectionTitle')}
                >
                  {editingField === 'bioSectionTitle' ? (
                    <Input 
                      value={data.bioSectionTitle || 'Biography'} 
                      autoFocus 
                      onBlur={() => setEditingField(null)}
                      onChange={(e) => onUpdate({ bioSectionTitle: e.target.value })}
                    />
                  ) : (data.bioSectionTitle || 'Biography')}
                </h2>
                <div className="flex bg-muted p-1 rounded-lg w-full sm:w-auto">
                  <Button
                    size="sm"
                    className="flex-1 sm:flex-none"
                    variant={bioMode === 'image' ? 'secondary' : 'ghost'}
                    onClick={() => { setBioMode('image'); onUpdate({ bioMode: 'image' }); }}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" /> Image
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 sm:flex-none"
                    variant={bioMode === 'video' ? 'secondary' : 'ghost'}
                    onClick={() => { setBioMode('video'); onUpdate({ bioMode: 'video' }); }}
                  >
                    <Video className="w-4 h-4 mr-2" /> Video
                  </Button>
                </div>
              </div>

              {bioMode === 'image' ? (
                <div className="space-y-6">
                  <div className="relative group max-w-md mx-auto md:mx-0">
                    {data.bioImage?.url ? (
                      <img src={data.bioImage.url} alt="Bio" className="w-full rounded-lg shadow-lg" />
                    ) : (
                      <div className="aspect-[4/3] bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                        <ImageIcon className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg cursor-pointer">
                      <Upload className="text-white w-8 h-8" />
                      <input type="file" className="hidden" onChange={(e) => openCropper(e.target.files[0], 'bio', 4/3)} />
                    </label>
                  </div>
                  <Textarea
                    value={data.bio || ''}
                    onChange={(e) => onUpdate({ bio: e.target.value })}
                    className="min-h-[200px] text-base"
                    placeholder="Tell your story..."
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  {data.bioVideo?.url ? (
                    <div className="aspect-video relative rounded-lg overflow-hidden shadow-lg group">
                      {data.bioVideo.type === 'youtube' ? (
                        <iframe src={data.bioVideo.url} className="w-full h-full" allowFullScreen />
                      ) : (
                        <video src={data.bioVideo.url} controls className="w-full h-full" />
                      )}
                      <Button 
                        variant="destructive" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                        onClick={() => onUpdate({ bioVideo: null })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="p-8 border-2 border-dashed rounded-lg bg-muted/30">
                      <Input 
                        placeholder="Paste YouTube Link..." 
                        value={youtubeUrl} 
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        className="mb-2"
                      />
                      <Button onClick={handleYouTubeUrl} className="w-full">Add Video</Button>
                    </div>
                  )}
                  <Textarea
                    value={data.bio || ''}
                    onChange={(e) => onUpdate({ bio: e.target.value })}
                    className="min-h-[150px] text-base"
                  />
                </div>
              )}
            </div>

            {/* Mission Statement */}
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-4 md:p-8 bg-card/30">
              <h3 className="text-xl font-bold mb-4" style={{ color: data.accentColor }}>Mission Statement</h3>
              <Textarea
                value={data.mission || ''}
                onChange={(e) => onUpdate({ mission: e.target.value })}
                className="min-h-[120px] text-base"
                placeholder="What drives you?"
              />
            </div>

            {/* Draggable Chapters */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold" style={{ color: data.accentColor }}>Story Chapters</h2>
                <Button onClick={addStorySection} size="sm"><Plus className="w-4 h-4 mr-2" /> Add Chapter</Button>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={(data.storySections || []).map(s => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-6">
                    {(data.storySections || []).map((section) => (
                      <SortableStorySection
                        key={section.id}
                        section={section}
                        updateStorySection={updateStorySection}
                        deleteStorySection={deleteStorySection}
                        data={data}
                        onUpdate={onUpdate}
                        accentColor={data.accentColor}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>

          {/* Sidebar Section */}
          <div className="space-y-8">
            {/* Accent Color Picker */}
            <Card className="p-6 border-2 border-dashed border-muted-foreground/30">
              <h3 className="font-bold mb-4">Profile Accent Color</h3>
              <div className="flex flex-wrap gap-3">
                {['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'].map(color => (
                  <button
                    key={color}
                    className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${data.accentColor === color ? 'border-white ring-2 ring-primary' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => onUpdate({ accentColor: color })}
                  />
                ))}
              </div>
            </Card>

            {/* Contact Information */}
            <Card className="p-6 border-2 border-dashed border-muted-foreground/30">
              <h3 className="font-bold mb-4">Contact Info</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <Input value={data.location || ''} onChange={(e) => onUpdate({ location: e.target.value })} placeholder="Location" />
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <Input value={data.email || ''} onChange={(e) => onUpdate({ email: e.target.value })} placeholder="Email" />
                </div>
              </div>
            </Card>

            {/* DYNAMIC SOCIAL LINKS CARD */}
            <Card className="p-6 border-2 border-dashed border-muted-foreground/30">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold">Social Links</h3>
                <Select 
                  onValueChange={(val) => {
                    onUpdate({ 
                      socialLinks: { ...(data.socialLinks || {}), [val]: '' } 
                    });
                  }}
                >
                  <SelectTrigger className="w-[120px] h-8 text-xs bg-muted/50 border-none">
                    <SelectValue placeholder="+ Add Link" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIAL_PLATFORMS.filter(p => !activeSocialKeys.includes(p.id)).map(platform => (
                      <SelectItem key={platform.id} value={platform.id}>
                        {platform.label}
                      </SelectItem>
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
                          onChange={(e) => onUpdate({ 
                            socialLinks: { 
                              ...(data.socialLinks || {}), 
                              [platform]: e.target.value 
                            } 
                          })} 
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

            {/* Tip Jar Widget (If Enabled) */}
            {data.tipJar?.enabled && (
              <Card className="p-6 border-2 border-dashed border-muted-foreground/30">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-primary" /> Tip Jar
                </h3>
                <Input
                  value={data.tipJar.title || ''}
                  onChange={(e) => onUpdate({ tipJar: { ...data.tipJar, title: e.target.value } })}
                  className="mb-2"
                />
                <Textarea
                  value={data.tipJar.description || ''}
                  onChange={(e) => onUpdate({ tipJar: { ...data.tipJar, description: e.target.value } })}
                  rows={2}
                />
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Floating Status Indicator */}
      <div className="fixed bottom-6 right-6 md:right-10 z-[100] sm:block hidden">
        <div className="bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-pulse">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider italic">Live Edit Mode</span>
        </div>
      </div>
    </div>
  );
}