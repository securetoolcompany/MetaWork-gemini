'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

export default function TutorialTooltip({ step, totalSteps, title, description, position = 'bottom', onNext, onPrev, onSkip, onComplete }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 100);
  }, [step]);

  const handleNext = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (step === totalSteps) {
        handleComplete();
      } else {
        onNext();
      }
    }, 200);
  };

  const handleComplete = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    toast.success('Tutorial Complete! 🎉', {
      description: 'You\'re all set! Would you like to try the other tutorial?'
    });
    
    onComplete();
  };

  const positionClasses = {
    top: 'bottom-full mb-4',
    bottom: 'top-full mt-4',
    left: 'right-full mr-4',
    right: 'left-full ml-4'
  };

  return (
    <div 
      className={`absolute z-50 w-80 transition-all duration-300 ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      } ${positionClasses[position]}`}
    >
      <Card className="border-2 border-primary bg-card shadow-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-primary">Step {step} of {totalSteps}</span>
              </div>
              <h4 className="font-semibold text-foreground text-lg">{title}</h4>
            </div>
            <Button variant="ghost" size="icon" onClick={onSkip} className="h-6 w-6 -mt-1">
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">{description}</p>
          
          <div className="flex gap-2 pt-2">
            {step > 1 && (
              <Button variant="outline" size="sm" onClick={onPrev} className="flex-1">
                <ArrowLeft className="mr-2 h-3 w-3" />
                Back
              </Button>
            )}
            <Button size="sm" onClick={handleNext} className="flex-1 bg-primary">
              {step === totalSteps ? 'Complete' : 'Next'}
              {step < totalSteps && <ArrowRight className="ml-2 h-3 w-3" />}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Arrow pointer */}
      <div className={`absolute w-3 h-3 bg-primary rotate-45 ${
        position === 'bottom' ? '-top-1.5 left-8' :
        position === 'top' ? '-bottom-1.5 left-8' :
        position === 'left' ? '-right-1.5 top-8' :
        '-left-1.5 top-8'
      }`} />
    </div>
  );
}
