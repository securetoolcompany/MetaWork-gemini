'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Palette, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function OnboardingDialog({ open, onOpenChange }) {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const paths = [
    {
      id: 'upload-ip',
      title: 'Upload Your IP',
      description: 'Choose this if you\'re an artist that wants to license images for others to use, or a brand that already has images and IP to create products.',
      icon: Upload,
      color: 'blue',
      features: [
        'Upload your artwork and designs',
        'Set licensing fees and earn royalties',
        'Make IP public or keep it private',
        'Track usage and earnings'
      ]
    },
    {
      id: 'create-product',
      title: 'Create a Product',
      description: 'Choose this if you want to create products, but don\'t have your own images or IP. Use community IP or upload your own private designs.',
      icon: Palette,
      color: 'purple',
      features: [
        'Browse IP library for designs',
        'Use drag-and-drop design canvas',
        'Create on multiple products',
        'Set pricing and start selling'
      ]
    }
  ];

  const handlePathSelect = (path) => {
    // Store in localStorage that user has seen onboarding
    if (typeof window !== 'undefined') {
      const completed = JSON.parse(localStorage.getItem('onboarding_completed') || '{}');
      completed[path] = false; // Will be set to true after tutorial
      localStorage.setItem('onboarding_completed', JSON.stringify(completed));
      localStorage.setItem('active_tutorial', path);
    }
    
    toast.success('Starting tutorial!', {
      description: `Let's walk you through ${path === 'upload-ip' ? 'uploading IP' : 'creating products'}`
    });
    
    onOpenChange(false);
    
    // Navigate to appropriate page with tutorial flag
    if (path === 'upload-ip') {
      router.push('/upload-ip?tutorial=true');
    } else {
      router.push('/product-designer?tutorial=true');
    }
  };

  const handleDontShowAgain = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding_skipped', 'permanent');
    }
    toast.success('Got it!', {
      description: 'You can always access tutorials from Settings'
    });
    onOpenChange(false);
  };

  const currentPath = paths[currentSlide];
  const Icon = currentPath.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-2xl md:text-3xl font-bold text-center">
            Welcome to MetaWork! 🎉
          </DialogTitle>
          <DialogDescription className="text-center text-sm md:text-base pt-2">
            Swipe or click to choose your path
          </DialogDescription>
        </DialogHeader>

        {/* Carousel Container */}
        <div className="relative px-6 pb-6">
          {/* Desktop: Show both cards side by side */}
          <div className="hidden md:grid md:grid-cols-2 gap-4">
            {paths.map((path, index) => {
              const PathIcon = path.icon;
              return (
                <Card 
                  key={path.id}
                  className={cn(
                    "cursor-pointer border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
                    `hover:border-${path.color}-500`
                  )}
                  onClick={() => handlePathSelect(path.id)}
                >
                  <CardContent className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className={cn(
                        "rounded-full p-4",
                        path.color === 'blue' ? 'bg-blue-500' : 'bg-purple-500'
                      )}>
                        <PathIcon className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-2">{path.title}</h3>
                      <p className="text-muted-foreground text-sm mb-4">{path.description}</p>
                    </div>

                    <div className="space-y-2 text-sm">
                      {path.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <Button className={cn(
                      "w-full mt-4",
                      path.color === 'blue' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-purple-500 hover:bg-purple-600'
                    )}>
                      Start Tutorial
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Mobile: Carousel with swipe */}
          <div className="md:hidden">
            {/* Slide indicators */}
            <div className="flex justify-center gap-2 mb-4">
              {paths.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    currentSlide === index ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>

            {/* Carousel card */}
            <div 
              className="relative overflow-hidden"
              onTouchStart={(e) => {
                const touchStart = e.touches[0].clientX;
                const handleTouchMove = (e) => {
                  const touchEnd = e.touches[0].clientX;
                  const diff = touchStart - touchEnd;
                  
                  if (Math.abs(diff) > 50) {
                    if (diff > 0 && currentSlide < paths.length - 1) {
                      setCurrentSlide(currentSlide + 1);
                    } else if (diff < 0 && currentSlide > 0) {
                      setCurrentSlide(currentSlide - 1);
                    }
                    document.removeEventListener('touchmove', handleTouchMove);
                  }
                };
                document.addEventListener('touchmove', handleTouchMove);
                document.addEventListener('touchend', () => {
                  document.removeEventListener('touchmove', handleTouchMove);
                }, { once: true });
              }}
            >
              <Card 
                className={cn(
                  "border-2 transition-all duration-300",
                  `border-${currentPath.color}-500 bg-${currentPath.color}-500/5`
                )}
                onClick={() => handlePathSelect(currentPath.id)}
              >
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-center">
                    <div className={cn(
                      "rounded-full p-4",
                      currentPath.color === 'blue' ? 'bg-blue-500' : 'bg-purple-500'
                    )}>
                      <Icon className="h-10 w-10 text-white" />
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-foreground mb-3">{currentPath.title}</h3>
                    <p className="text-muted-foreground text-sm mb-4">{currentPath.description}</p>
                  </div>

                  <div className="space-y-2 text-sm">
                    {currentPath.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button className={cn(
                    "w-full mt-4",
                    currentPath.color === 'blue' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-purple-500 hover:bg-purple-600'
                  )}>
                    Tap to Start Tutorial
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Navigation arrows */}
            <div className="flex justify-between mt-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                disabled={currentSlide === 0}
                className="rounded-full"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentSlide(Math.min(paths.length - 1, currentSlide + 1))}
                disabled={currentSlide === paths.length - 1}
                className="rounded-full"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 bg-muted/30">
          <div className="flex flex-col gap-2">
            <Button 
              variant="ghost" 
              onClick={handleDontShowAgain}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Don't show this again
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
