'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
  Crop
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
    <div ref={setNodeRef} style={style}>
      <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 hover:border-primary/50 transition-colors">
        <div className="flex items-center gap-3 mb-4">
          <div {...attributes} {...listeners} className="cursor-move touch-none">
            <GripVertical className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
          </div>
          <Input
            value={section.title}
            onChange={(e) => updateStorySection(section.id, 'title', e.target.value)}
            className="text-xl font-bold flex-1"
            placeholder="Chapter title..."
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => deleteStorySection(section.id)}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>

        {/* Chapter Description */}
        <Textarea
          value={section.description || ''}
          onChange={(e) => updateStorySection(section.id, 'description', e.target.value)}
          className="mb-4"
          placeholder="Describe this chapter of your story..."
          rows={2}
        />

        <MediaGrid
          title=""
          description="Add photos, videos, or audio to this chapter"
          galleryKey={`storySection_${section.id}`}
          data={data}
          onUpdate={onUpdate}
          accentColor={accentColor}
          allowTypes={['image', 'video', 'audio']}
        />
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
  const handleCropComplete = (croppedImage) => {
    switch (cropperType) {
      case 'hero':
        onUpdate({ heroMedia: { type: 'image', url: croppedImage } });
        toast.success('Hero image updated!');
        break;
      case 'profile':
        onUpdate({ profilePicture: { url: croppedImage } });
        toast.success('Profile picture updated!');
        break;
      case 'bio':
        onUpdate({ bioImage: { type: 'image', url: croppedImage } });
        toast.success('Bio image updated!');
        break;
    }
    setCropperOpen(false);
    setCropperImage(null);
    setCropperType(null);
  };

  const handleImageUpload = (file, callback) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      callback(reader.result);
      toast.success('Image uploaded!');
    };
    reader.readAsDataURL(file);
  };

  const handleVideoUpload = (file) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      onUpdate({ 
        bioVideo: { type: 'video', url: reader.result },
        bioMode: 'video'
      });
      setBioMode('video');
      toast.success('Video uploaded!');
    };
    reader.readAsDataURL(file);
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

  return (
    <div className="min-h-screen">
      {/* Image Cropper Modal */}
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

      {/* Hero Section - Editable */}
      <div className="relative w-full h-[400px]">
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

        {/* Gradient overlay - placed BEFORE interactive elements */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent pointer-events-none" />

        {/* Hero image edit overlay - covers top portion only, leaving bottom for name/tagline */}
        <div className="absolute top-0 left-0 right-0 h-[250px] z-[5] group">
          <div className="absolute inset-0 bg-black/0 hover:bg-black/60 transition-colors cursor-pointer flex items-center justify-center">
            <div className="text-center opacity-0 group-hover:opacity-100 transition-opacity">
              {data.heroMedia?.url ? (
                <>
                  <div className="flex gap-3 justify-center mb-2">
                    <button
                      onClick={() => {
                        setCropperImage(data.heroMedia.url);
                        setCropperType('hero');
                        setCropperAspect(16/9);
                        setCropperShape('rect');
                        setCropperOpen(true);
                      }}
                      className="bg-white text-black px-6 py-3 rounded-lg font-semibold flex items-center gap-2"
                    >
                      <Crop className="w-5 h-5" />
                      Adjust Position
                    </button>
                    <label className="bg-white/90 text-black px-6 py-3 rounded-lg font-semibold flex items-center gap-2 cursor-pointer hover:bg-white transition-colors">
                      <Upload className="w-5 h-5" />
                      Replace Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            openCropper(file, 'hero', 16/9, 'rect');
                          }
                        }}
                      />
                    </label>
                  </div>
                  <p className="text-white text-sm">Click to adjust or replace hero image</p>
                </>
              ) : (
                <label className="cursor-pointer">
                  <div className="bg-white text-black px-6 py-3 rounded-lg font-semibold flex items-center gap-2 mx-auto w-fit mb-2">
                    <Upload className="w-5 h-5" />
                    Upload Hero Image
                  </div>
                  <p className="text-white text-sm">Click to upload and crop</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        openCropper(file, 'hero', 16/9, 'rect');
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>
        
        {/* Profile Picture - Circular overlay on hero */}
        <div className="absolute bottom-8 left-8 pointer-events-auto z-10">
          <div className="relative group">
            {data.profilePicture?.url ? (
              <>
                <img 
                  src={data.profilePicture.url} 
                  alt="Profile" 
                  className="w-32 h-32 rounded-full border-4 border-background object-cover shadow-xl" 
                />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/60 transition-colors rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100">
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => {
                        setCropperImage(data.profilePicture.url);
                        setCropperType('profile');
                        setCropperAspect(1);
                        setCropperShape('round');
                        setCropperOpen(true);
                      }}
                      className="text-white text-xs font-medium hover:underline"
                    >
                      <Crop className="w-5 h-5 mx-auto mb-1" />
                      Adjust
                    </button>
                    <label className="text-white/80 text-xs cursor-pointer hover:text-white">
                      Replace
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            openCropper(file, 'profile', 1, 'round');
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </>
            ) : (
              <label className="w-32 h-32 rounded-full border-4 border-background bg-muted flex items-center justify-center cursor-pointer hover:bg-muted-foreground/20 transition-colors shadow-xl">
                <div className="text-center">
                  <Upload className="w-8 h-8 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Add Photo</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      openCropper(file, 'profile', 1, 'round');
                    }
                  }}
                />
              </label>
            )}
          </div>
        </div>
        
        {/* Name, Tagline and Buttons - Higher z-index to stay clickable */}
        <div className="absolute bottom-0 left-0 right-0 p-8 z-[6]">
          <div className="max-w-7xl mx-auto pl-44">
            <div className="flex items-end gap-2 mb-2">
              <span className="text-4xl">{countryFlags[data.country]}</span>
              
              {editingField === 'displayName' ? (
                <Input
                  value={data.displayName}
                  onChange={(e) => onUpdate({ displayName: e.target.value })}
                  onBlur={() => setEditingField(null)}
                  className="text-4xl md:text-5xl font-bold text-white bg-white/10 border-white/30"
                  autoFocus
                />
              ) : (
                <h1 
                  className="text-4xl md:text-5xl font-bold text-white cursor-pointer hover:text-white/80 transition-colors border-2 border-dashed border-transparent hover:border-white/50 px-2 rounded"
                  onClick={() => setEditingField('displayName')}
                  title="Click to edit"
                >
                  {data.displayName}
                </h1>
              )}
            </div>

            {editingField === 'tagline' ? (
              <Input
                value={data.tagline}
                onChange={(e) => onUpdate({ tagline: e.target.value })}
                onBlur={() => setEditingField(null)}
                className="text-xl text-white bg-white/10 border-white/30 mb-4"
                autoFocus
              />
            ) : (
              <p 
                className="text-xl text-white/90 mb-4 cursor-pointer hover:text-white transition-colors border-2 border-dashed border-transparent hover:border-white/50 px-2 py-1 rounded inline-block"
                onClick={() => setEditingField('tagline')}
                title="Click to edit"
              >
                {data.tagline}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <Button style={{ backgroundColor: data.accentColor }}>
                <Store className="w-4 h-4 mr-2" />
                Visit My Aisle
              </Button>
              {data.tipJar?.enabled && (
                <Button variant="outline" className="bg-background/80 backdrop-blur">
                  <Heart className="w-4 h-4 mr-2" />
                  {data.tipJar.title}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Biography / My Story Section */}
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 hover:border-primary/50 transition-colors">
              <div className="flex items-center justify-between mb-4">
                {editingField === 'bioSectionTitle' ? (
                  <Input
                    value={data.bioSectionTitle || 'Biography / My Story'}
                    onChange={(e) => onUpdate({ bioSectionTitle: e.target.value })}
                    onBlur={() => setEditingField(null)}
                    className="text-2xl font-bold"
                    style={{ color: data.accentColor }}
                    autoFocus
                  />
                ) : (
                  <h2 
                    className="text-2xl font-bold cursor-pointer hover:opacity-80 transition-opacity border-2 border-dashed border-transparent hover:border-primary/50 px-2 py-1 rounded"
                    style={{ color: data.accentColor }}
                    onClick={() => setEditingField('bioSectionTitle')}
                    title="Click to edit section title"
                  >
                    {data.bioSectionTitle || 'Biography / My Story'}
                  </h2>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={bioMode === 'image' ? 'default' : 'outline'}
                    onClick={() => {
                      setBioMode('image');
                      onUpdate({ bioMode: 'image' });
                    }}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Image + Text
                  </Button>
                  <Button
                    size="sm"
                    variant={bioMode === 'video' ? 'default' : 'outline'}
                    onClick={() => {
                      setBioMode('video');
                      onUpdate({ bioMode: 'video' });
                    }}
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Video + Text
                  </Button>
                </div>
              </div>

              {bioMode === 'image' ? (
                <div className="space-y-4">
                  {/* Image Upload */}
                  <div>
                    <Label>Profile Image</Label>
                    {data.bioImage?.url ? (
                      <div className="relative group mt-2">
                        <img src={data.bioImage.url} alt="Bio" className="w-full max-w-md rounded-lg" />
                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setCropperImage(data.bioImage.url);
                              setCropperType('bio');
                              setCropperAspect(4/3);
                              setCropperShape('rect');
                              setCropperOpen(true);
                            }}
                          >
                            <Crop className="w-4 h-4 mr-1" />
                            Adjust
                          </Button>
                          <label className="cursor-pointer">
                            <Button size="sm" variant="secondary" asChild>
                              <span>
                                <Upload className="w-4 h-4 mr-1" />
                                Replace
                              </span>
                            </Button>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  openCropper(file, 'bio', 4/3, 'rect');
                                }
                              }}
                            />
                          </label>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => onUpdate({ bioImage: null })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <label className="mt-2 block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
                        <Crop className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm font-medium">Upload & Crop Profile Picture</p>
                        <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 10MB</p>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              openCropper(file, 'bio', 4/3, 'rect');
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Bio Text */}
                  <div>
                    <Label>Your Story</Label>
                    <Textarea
                      value={data.bio || ''}
                      onChange={(e) => onUpdate({ bio: e.target.value })}
                      className="min-h-[150px] mt-2"
                      placeholder="Tell your story... Who are you? What's your journey?"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {(data.bio || '').length} characters
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Video Link Only - No Upload */}
                  <div>
                    <Label>Video Link</Label>
                    {data.bioVideo?.url ? (
                      <div className="relative group mt-2">
                        {data.bioVideo.type === 'youtube' ? (
                          <iframe
                            src={data.bioVideo.url}
                            className="w-full aspect-video rounded-lg"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <video src={data.bioVideo.url} controls className="w-full rounded-lg" />
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                          onClick={() => onUpdate({ bioVideo: null })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-8 mt-2">
                        <Video className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm font-medium text-center mb-2">Add Video from YouTube</p>
                        <p className="text-xs text-muted-foreground text-center mb-4">
                          Upload to <a href="https://youtube.com" target="_blank" className="text-primary hover:underline">YouTube</a> for free, 
                          or <span className="font-medium">mint with MetaWork</span>, then paste the link below
                        </p>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Paste YouTube URL or video link"
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                          />
                          <Button onClick={handleYouTubeUrl}>Add</Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bio Text - ALSO in video mode */}
                  <div>
                    <Label>Your Story (Text)</Label>
                    <Textarea
                      value={data.bio || ''}
                      onChange={(e) => onUpdate({ bio: e.target.value })}
                      className="min-h-[150px] mt-2"
                      placeholder="Tell your story... Who are you? What's your journey?"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {(data.bio || '').length} characters
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Mission / Goal Statement */}
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 hover:border-primary/50 transition-colors">
              <div className="flex items-center justify-between mb-4">
                {editingField === 'missionSectionTitle' ? (
                  <Input
                    value={data.missionSectionTitle || 'Mission / Goal'}
                    onChange={(e) => onUpdate({ missionSectionTitle: e.target.value })}
                    onBlur={() => setEditingField(null)}
                    className="text-2xl font-bold"
                    style={{ color: data.accentColor }}
                    autoFocus
                  />
                ) : (
                  <h2 
                    className="text-2xl font-bold cursor-pointer hover:opacity-80 transition-opacity border-2 border-dashed border-transparent hover:border-primary/50 px-2 py-1 rounded"
                    style={{ color: data.accentColor }}
                    onClick={() => setEditingField('missionSectionTitle')}
                    title="Click to edit section title"
                  >
                    {data.missionSectionTitle || 'Mission / Goal'}
                  </h2>
                )}
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </div>
              <Label className="text-sm text-muted-foreground mb-2 block">
                What gets you up in the morning? Why are you on MetaWork?
              </Label>
              <Textarea
                value={data.mission || ''}
                onChange={(e) => onUpdate({ mission: e.target.value })}
                className="min-h-[120px]"
                placeholder="Share your mission, goals, and what drives you..."
              />
              <p className="text-xs text-muted-foreground mt-2">
                {(data.mission || '').length} characters
              </p>
            </div>

            {/* Story Sections / Chapters */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                {editingField === 'chaptersSectionTitle' ? (
                  <Input
                    value={data.chaptersSectionTitle || 'Story Chapters'}
                    onChange={(e) => onUpdate({ chaptersSectionTitle: e.target.value })}
                    onBlur={() => setEditingField(null)}
                    className="text-2xl font-bold"
                    style={{ color: data.accentColor }}
                    autoFocus
                  />
                ) : (
                  <h2 
                    className="text-2xl font-bold cursor-pointer hover:opacity-80 transition-opacity border-2 border-dashed border-transparent hover:border-primary/50 px-2 py-1 rounded"
                    style={{ color: data.accentColor }}
                    onClick={() => setEditingField('chaptersSectionTitle')}
                    title="Click to edit section title"
                  >
                    {data.chaptersSectionTitle || 'Story Chapters'}
                  </h2>
                )}
                <Button onClick={addStorySection} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Chapter
                </Button>
              </div>

              {(data.storySections || []).length === 0 ? (
                <Card className="p-8 text-center border-2 border-dashed">
                  <p className="text-muted-foreground mb-4">
                    Add chapters to tell your story through media
                  </p>
                  <Button onClick={addStorySection}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Chapter
                  </Button>
                </Card>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                >
                  <SortableContext 
                    items={(data.storySections || []).map(s => s.id)} 
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4">
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
                  <DragOverlay>
                    {activeSection ? (
                      <div className="border-2 border-primary rounded-lg p-6 bg-background opacity-80 cursor-grabbing">
                        <div className="flex items-center gap-3">
                          <GripVertical className="w-5 h-5 text-muted-foreground" />
                          <div className="text-xl font-bold">{activeSection.title}</div>
                        </div>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}
            </div>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Color Picker */}
            <Card className="border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors">
              <div className="p-6">
                <h3 className="font-semibold mb-4">Theme Color</h3>
                <div className="flex flex-wrap gap-2">
                  {['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'].map(color => (
                    <button
                      key={color}
                      className="w-10 h-10 rounded-full border-2 border-background shadow-md hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      onClick={() => onUpdate({ accentColor: color })}
                    >
                      {data.accentColor === color && (
                        <div className="w-full h-full rounded-full border-2 border-white flex items-center justify-center text-white text-xs">✓</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Contact Information */}
            <Card className="border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Contact</h3>
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      value={data.location}
                      onChange={(e) => onUpdate({ location: e.target.value })}
                      placeholder="City, Country"
                      className="text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      type="email"
                      value={data.email}
                      onChange={(e) => onUpdate({ email: e.target.value })}
                      placeholder="your@email.com"
                      className="text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      value={data.phone || ''}
                      onChange={(e) => onUpdate({ phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      className="text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      value={data.website || ''}
                      onChange={(e) => onUpdate({ website: e.target.value })}
                      placeholder="https://yoursite.com"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Tip Jar Settings */}
            {data.tipJar?.enabled && (
              <Card className="border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Heart className="w-4 h-4" style={{ color: data.accentColor }} />
                      Tip Jar
                    </h3>
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-3">
                    <Input
                      value={data.tipJar.title}
                      onChange={(e) => onUpdate({
                        tipJar: { ...data.tipJar, title: e.target.value }
                      })}
                      placeholder="Tip Jar Title"
                      className="text-sm"
                    />
                    <Textarea
                      value={data.tipJar.description}
                      onChange={(e) => onUpdate({
                        tipJar: { ...data.tipJar, description: e.target.value }
                      })}
                      placeholder="Short description..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Helper Text */}
      <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg z-50">
        <p className="text-sm font-medium">💡 Click fields to edit • Drag to reorder chapters</p>
      </div>
    </div>
  );
}
