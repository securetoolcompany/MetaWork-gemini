'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, X, Crop, MapPin, Mail, Phone, Globe } from 'lucide-react';
import { toast } from 'sonner';
import ImageCropper from '@/components/profile/ImageCropper';
import Image from 'next/image';

export default function ThemeBrandingTab({ settings, updateSettings }) {
  // --- Cropper State Isolated to this Tab ---
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImage, setCropperImage] = useState(null);
  const [cropperType, setCropperType] = useState(null); // 'heroImage' or 'logo'
  const [cropperAspect, setCropperAspect] = useState(16/9);
  const [cropperShape, setCropperShape] = useState('rect');
  const [isUploading, setIsUploading] = useState(false);

  // HELPER: Convert base64 to File object
  const base64ToFile = async (base64, filename) => {
    const res = await fetch(base64);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type });
  };

  const openCropper = (file, type, aspect, shape) => {
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
    setIsUploading(true);
    const loadingToast = toast.loading('Uploading image...');
    
    try {
      const file = await base64ToFile(croppedImageBase64, `${cropperType}-${Date.now()}.webp`);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folderContext', 'aisle-assets');
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        updateSettings(cropperType, data.url);
        toast.success(`${cropperType === 'logo' ? 'Logo' : 'Banner'} uploaded successfully!`, { id: loadingToast });
      } else {
        throw new Error('Upload failed');
      }
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

  return (
    <div className="space-y-6">
      
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
        title={cropperType === 'heroImage' ? 'Crop Hero Banner' : 'Crop Logo'}
      />

      <Card>
        <CardHeader>
          <CardTitle>Aisle Identity</CardTitle>
          <CardDescription>Your aisle's name, URL, and description</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Aisle Name</Label>
            <Input
              value={settings?.title || ''}
              onChange={(e) => updateSettings('title', e.target.value)}
              placeholder="e.g., Blake's MMA Gear"
            />
          </div>
          <div>
            <Label>Custom URL Slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">metawork.com/aisle/</span>
              <Input
                value={settings?.slug || ''}
                onChange={(e) => updateSettings('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="your-aisle-name"
              />
            </div>
          </div>
          <div>
            <Label>Description / Bio</Label>
            <Textarea
              value={settings?.description || ''}
              onChange={(e) => updateSettings('description', e.target.value)}
              placeholder="Describe your aisle and what you offer..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>How customers can reach you</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Country</Label>
              <Select 
                value={settings?.country || 'US'} 
                onValueChange={(val) => updateSettings('country', val)}
              >
                <SelectTrigger><SelectValue placeholder="Select Country" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">🇺🇸 United States</SelectItem>
                  <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                  <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                  <SelectItem value="AU">🇦🇺 Australia</SelectItem>
                  <SelectItem value="KR">🇰🇷 South Korea</SelectItem>
                  <SelectItem value="JP">🇯🇵 Japan</SelectItem>
                  <SelectItem value="DE">🇩🇪 Germany</SelectItem>
                  <SelectItem value="FR">🇫🇷 France</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  className="pl-9"
                  value={settings?.location || ''} 
                  onChange={(e) => updateSettings('location', e.target.value)} 
                  placeholder="e.g., Tucson, AZ" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Public Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  className="pl-9"
                  type="email"
                  value={settings?.email || ''} 
                  onChange={(e) => updateSettings('email', e.target.value)} 
                  placeholder="contact@example.com" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Public Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  className="pl-9"
                  value={settings?.phone || ''} 
                  onChange={(e) => updateSettings('phone', e.target.value)} 
                  placeholder="+1 (555) 123-4567" 
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Website</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  className="pl-9"
                  type="url"
                  value={settings?.website || ''} 
                  onChange={(e) => updateSettings('website', e.target.value)} 
                  placeholder="https://yourwebsite.com" 
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding Assets</CardTitle>
          <CardDescription>Upload your logo and banner images</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Banner Upload */}
          <div>
            <Label>Hero Banner</Label>
            <p className="text-xs text-muted-foreground mb-2">Recommended: 1200x300px</p>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              {settings?.heroImage ? (
                <div className="relative group">
                  <Image src={settings.heroImage} alt="Hero" width={800} height={200} className="rounded-lg mx-auto object-cover max-h-[200px]" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => {
                      setCropperImage(settings.heroImage);
                      setCropperType('heroImage');
                      setCropperAspect(1200/300); 
                      setCropperShape('rect');
                      setCropperOpen(true);
                    }}>
                      <Crop className="w-4 h-4 mr-2" /> Adjust
                    </Button>
                    <label className="cursor-pointer">
                      <Button variant="secondary" size="sm" asChild>
                        <span><Upload className="w-4 h-4 mr-2" /> Replace</span>
                      </Button>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                        if (e.target.files[0]) openCropper(e.target.files[0], 'heroImage', 1200/300, 'rect');
                      }}/>
                    </label>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer block py-8 hover:bg-muted/50 transition-colors rounded-md">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Click to upload banner</p>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                    if (e.target.files[0]) openCropper(e.target.files[0], 'heroImage', 1200/300, 'rect');
                  }}/>
                </label>
              )}
            </div>
          </div>

          {/* Logo Upload */}
          <div>
            <Label>Logo / Profile Picture</Label>
            <p className="text-xs text-muted-foreground mb-2">Recommended: Circular crop</p>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              {settings?.logo ? (
                <div className="relative inline-block group">
                  <Image src={settings.logo} alt="Logo" width={150} height={150} className="rounded-full mx-auto object-cover aspect-square" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex flex-col items-center justify-center gap-2">
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 h-8" onClick={() => {
                      setCropperImage(settings.logo);
                      setCropperType('logo');
                      setCropperAspect(1);
                      setCropperShape('round');
                      setCropperOpen(true);
                    }}>
                      <Crop className="w-4 h-4 mr-2" /> Adjust
                    </Button>
                    <label className="cursor-pointer text-sm text-white hover:underline flex items-center">
                      <Upload className="w-3 h-3 mr-1" /> Replace
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                        if (e.target.files[0]) openCropper(e.target.files[0], 'logo', 1, 'round');
                      }}/>
                    </label>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer block py-6 hover:bg-muted/50 transition-colors rounded-md">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Click to upload logo</p>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                    if (e.target.files[0]) openCropper(e.target.files[0], 'logo', 1, 'round');
                  }}/>
                </label>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social Links</CardTitle>
          <CardDescription>Connect your social media profiles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {['twitter', 'instagram', 'tiktok', 'website'].map(platform => (
            <div className="space-y-2" key={platform}>
              <Label className="capitalize">{platform}</Label>
              <Input
                type="url"
                value={settings?.socialLinks?.[platform] || ''}
                onChange={(e) => updateSettings(`socialLinks.${platform}`, e.target.value)}
                placeholder={`https://${platform}.com/`}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}