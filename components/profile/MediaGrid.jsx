'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Upload, Video, Music, Image as ImageIcon, Link as LinkIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MediaGrid({ 
  title, 
  description, 
  galleryKey, 
  data, 
  onUpdate, 
  accentColor,
  allowTypes = ['image', 'video', 'audio'],
  maxItems = null 
}) {
  const currentGallery = data[galleryKey] || [];
  const [addMediaDialog, setAddMediaDialog] = useState(false);
  const [selectedMediaType, setSelectedMediaType] = useState('image');
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadingItemId, setUploadingItemId] = useState(null);

  // 🔥 NEW CLOUDINARY UPLOAD LOGIC
  const handleFileUpload = async (file, itemId) => {
    if (!file) return;

    setUploadingItemId(itemId);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderContext', 'profile-media'); // Store in same flat folder

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to upload media');
      }

      // Update the specific item in the gallery with the new Cloudinary URL
      const updatedGallery = currentGallery.map(item =>
        item.id === itemId ? { ...item, url: json.url, urlType: 'file' } : item
      );
      
      onUpdate({ [galleryKey]: updatedGallery });
      toast.success('Media uploaded successfully!');
    } catch (error) {
      console.error('Upload Error:', error);
      toast.error(error.message || 'Error uploading file. Please try again.');
    } finally {
      setUploadingItemId(null);
    }
  };

  const addMediaSlot = (type) => {
    if (maxItems && currentGallery.length >= maxItems) {
      toast.error(`Maximum ${maxItems} items allowed`);
      return;
    }
    const newItem = { 
      id: Date.now(), 
      type: type || selectedMediaType, 
      url: '', 
      urlType: 'file',
      caption: '' 
    };
    onUpdate({ [galleryKey]: [...currentGallery, newItem] });
    setAddMediaDialog(false);
    toast.success('Media slot added');
  };

  const addVideoUrl = () => {
    if (!videoUrl) return;
    
    // Check if it's a YouTube URL
    const videoId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1];
    let finalUrl = videoUrl;
    let urlType = 'direct';
    
    if (videoId) {
      finalUrl = `https://www.youtube.com/embed/${videoId}`;
      urlType = 'youtube';
    }
    
    const newItem = {
      id: Date.now(),
      type: 'video',
      url: finalUrl,
      urlType: urlType,
      caption: ''
    };
    
    onUpdate({ [galleryKey]: [...currentGallery, newItem] });
    setVideoUrl('');
    setAddMediaDialog(false);
    toast.success('Video added!');
  };

  const removeMediaItem = (itemId) => {
    const updatedGallery = currentGallery.filter(item => item.id !== itemId);
    onUpdate({ [galleryKey]: updatedGallery });
    toast.success('Media removed');
  };

  const updateMediaCaption = (itemId, caption) => {
    const updatedGallery = currentGallery.map(item =>
      item.id === itemId ? { ...item, caption } : item
    );
    onUpdate({ [galleryKey]: updatedGallery });
  };

  const changeMediaType = (itemId, newType) => {
    const updatedGallery = currentGallery.map(item =>
      item.id === itemId ? { ...item, type: newType, url: '', urlType: 'file' } : item
    );
    onUpdate({ [galleryKey]: updatedGallery });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          {title && <h3 className="text-lg font-semibold" style={{ color: accentColor }}>{title}</h3>}
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {(!maxItems || currentGallery.length < maxItems) && (
          <Button size="sm" variant="outline" onClick={() => setAddMediaDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Media
          </Button>
        )}
      </div>

      {currentGallery.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {currentGallery.map((item) => (
            <div key={item.id} className="group relative">
              {/* Media Type Selector */}
              <div className="absolute top-2 left-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {allowTypes.includes('image') && (
                  <Button
                    size="icon"
                    variant={item.type === 'image' ? 'default' : 'secondary'}
                    className="h-7 w-7"
                    onClick={() => changeMediaType(item.id, 'image')}
                  >
                    <ImageIcon className="w-4 h-4" />
                  </Button>
                )}
                {allowTypes.includes('video') && (
                  <Button
                    size="icon"
                    variant={item.type === 'video' ? 'default' : 'secondary'}
                    className="h-7 w-7"
                    onClick={() => changeMediaType(item.id, 'video')}
                  >
                    <Video className="w-4 h-4" />
                  </Button>
                )}
                {allowTypes.includes('audio') && (
                  <Button
                    size="icon"
                    variant={item.type === 'audio' ? 'default' : 'secondary'}
                    className="h-7 w-7"
                    onClick={() => changeMediaType(item.id, 'audio')}
                  >
                    <Music className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="aspect-square border-2 border-dashed rounded-lg overflow-hidden bg-muted relative">
                {/* 🔥 Loading Overlay */}
                {uploadingItemId === item.id && (
                  <div className="absolute inset-0 z-20 bg-background/80 flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <span className="text-xs font-medium">Uploading...</span>
                  </div>
                )}
                
                {item.url ? (
                  <>
                    {item.type === 'image' && (
                      <img src={item.url} alt={item.caption} className="w-full h-full object-cover" />
                    )}
                    {item.type === 'video' && (
                      <>
                        {item.urlType === 'youtube' ? (
                          <iframe
                            src={item.url}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <video src={item.url} controls className="w-full h-full object-cover" />
                        )}
                      </>
                    )}
                    {item.type === 'audio' && (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4">
                        <Music className="w-12 h-12 text-muted-foreground mb-3" />
                        <audio src={item.url} controls className="w-full" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4">
                    {item.type === 'image' && (
                      <>
                        <label className="cursor-pointer flex flex-col items-center hover:bg-muted-foreground/10 transition-colors p-4 rounded-lg w-full h-full justify-center">
                          <ImageIcon className="w-10 h-10 text-muted-foreground mb-2" />
                          <p className="text-xs text-muted-foreground text-center">Click to upload image</p>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) handleFileUpload(file, item.id);
                            }}
                            disabled={uploadingItemId === item.id}
                          />
                        </label>
                      </>
                    )}
                    {item.type === 'video' && (
                      <div className="space-y-2 w-full p-3">
                        <div className="flex flex-col items-center mb-3">
                          <Video className="w-10 h-10 text-muted-foreground mb-2" />
                          <p className="text-xs font-medium text-center mb-1">Link External Video</p>
                          <p className="text-[10px] text-muted-foreground text-center">
                            Upload to <span className="font-medium text-primary">YouTube</span> or 
                            mint with <span className="font-medium">MetaWork</span>
                          </p>
                        </div>
                        <Input
                          placeholder="Paste YouTube URL or video link"
                          className="text-xs h-8"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const url = e.target.value;
                              if (url) {
                                const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1];
                                if (videoId) {
                                  const updatedGallery = currentGallery.map(i =>
                                    i.id === item.id ? { ...i, url: `https://www.youtube.com/embed/${videoId}`, urlType: 'youtube' } : i
                                  );
                                  onUpdate({ [galleryKey]: updatedGallery });
                                  toast.success('Video added!');
                                  e.target.value = '';
                                } else {
                                  // Assume direct video URL
                                  const updatedGallery = currentGallery.map(i =>
                                    i.id === item.id ? { ...i, url, urlType: 'direct' } : i
                                  );
                                  onUpdate({ [galleryKey]: updatedGallery });
                                  toast.success('Video link added!');
                                  e.target.value = '';
                                }
                              }
                            }
                          }}
                        />
                        <p className="text-[10px] text-muted-foreground text-center mt-1">Press Enter to add</p>
                      </div>
                    )}
                    {item.type === 'audio' && (
                      <label className="cursor-pointer flex flex-col items-center hover:bg-muted-foreground/10 transition-colors p-4 rounded-lg w-full h-full justify-center">
                        <Music className="w-10 h-10 text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground text-center">Click to upload audio</p>
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) handleFileUpload(file, item.id);
                          }}
                          disabled={uploadingItemId === item.id}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Caption Input */}
              <Input
                value={item.caption || ''}
                onChange={(e) => updateMediaCaption(item.id, e.target.value)}
                placeholder="Add caption..."
                className="mt-2 text-sm"
              />

              {/* Delete Button */}
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 z-10"
                onClick={() => removeMediaItem(item.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">No media added yet</p>
          <Button size="sm" variant="outline" onClick={() => setAddMediaDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add First Item
          </Button>
        </div>
      )}

      {/* Add Media Dialog */}
      <Dialog open={addMediaDialog} onOpenChange={setAddMediaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Media</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="mb-3 block">Select media type:</Label>
              <div className="grid grid-cols-3 gap-3">
                {allowTypes.includes('image') && (
                  <button
                    className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 hover:border-primary transition-colors ${
                      selectedMediaType === 'image' ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                    onClick={() => setSelectedMediaType('image')}
                  >
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-sm font-medium">Image</span>
                  </button>
                )}
                {allowTypes.includes('video') && (
                  <button
                    className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 hover:border-primary transition-colors ${
                      selectedMediaType === 'video' ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                    onClick={() => setSelectedMediaType('video')}
                  >
                    <Video className="w-8 h-8" />
                    <span className="text-sm font-medium">Video</span>
                  </button>
                )}
                {allowTypes.includes('audio') && (
                  <button
                    className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 hover:border-primary transition-colors ${
                      selectedMediaType === 'audio' ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                    onClick={() => setSelectedMediaType('audio')}
                  >
                    <Music className="w-8 h-8" />
                    <span className="text-sm font-medium">Audio</span>
                  </button>
                )}
              </div>
            </div>

            {selectedMediaType === 'video' && (
              <div className="space-y-3 pt-4 border-t">
                <Label>Or add from YouTube:</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste YouTube URL"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                  <Button onClick={addVideoUrl}>
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAddMediaDialog(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={() => addMediaSlot(selectedMediaType)} className="flex-1">
              Add {selectedMediaType}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}