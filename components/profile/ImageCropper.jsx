'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ZoomIn, ZoomOut, RotateCcw, Check, X } from 'lucide-react';

// Helper function to create cropped image
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

const getCroppedImg = async (imageSrc, pixelCrop, rotation = 0) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  canvas.width = safeArea;
  canvas.height = safeArea;

  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-safeArea / 2, -safeArea / 2);

  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  );

  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.putImageData(
    data,
    0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x,
    0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          resolve(reader.result);
        };
      }
    }, 'image/jpeg', 0.9);
  });
};

export default function ImageCropper({
  open,
  onClose,
  imageSrc,
  onCropComplete,
  aspectRatio = 1,
  cropShape = 'rect', // 'rect' or 'round'
  title = 'Crop Image'
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropChange = useCallback((crop) => {
    setCrop(crop);
  }, []);

  const onZoomChange = useCallback((zoom) => {
    setZoom(zoom);
  }, []);

  const onCropAreaComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      if (croppedAreaPixels && imageSrc) {
        const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
        onCropComplete(croppedImage);
        onClose();
      }
    } catch (e) {
      console.error('Error cropping image:', e);
    }
  }, [croppedAreaPixels, imageSrc, rotation, onCropComplete, onClose]);

  const handleReset = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="relative w-full h-[350px] bg-black/90 rounded-lg overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspectRatio}
              cropShape={cropShape}
              showGrid={true}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropAreaComplete}
            />
          )}
        </div>

        {/* Controls */}
        <div className="space-y-4 pt-2">
          {/* Zoom Control */}
          <div className="flex items-center gap-4">
            <ZoomOut className="w-4 h-4 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={([value]) => setZoom(value)}
              className="flex-1"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground w-12">{zoom.toFixed(1)}x</span>
          </div>

          {/* Rotation Control */}
          <div className="flex items-center gap-4">
            <RotateCcw className="w-4 h-4 text-muted-foreground" />
            <Slider
              value={[rotation]}
              min={-180}
              max={180}
              step={1}
              onValueChange={([value]) => setRotation(value)}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground w-12">{rotation}°</span>
          </div>

          <Button variant="outline" size="sm" onClick={handleReset} className="w-full">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Position
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Check className="w-4 h-4 mr-2" />
            Apply Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
