'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

export default function TutorialOverlay({ 
  step, 
  totalSteps, 
  title, 
  description, 
  targetSelector, 
  position = 'bottom',
  highlightPadding = 10,
  onNext, 
  onPrev, 
  onSkip, 
  onComplete,
  hideNextButton = false
}) {
  const [targetRect, setTargetRect] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Find and highlight the target element
    const findTarget = () => {
      if (targetSelector) {
        const element = document.querySelector(targetSelector);
        if (element) {
          const rect = element.getBoundingClientRect();
          setTargetRect({
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height
          });
          
          // Scroll element into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // Element not found, clear the overlay
          setTargetRect(null);
        }
      } else {
        // No target selector for this step
        setTargetRect(null);
      }
    };

    // Initial find
    findTarget();
    
    // Retry finding the element after a delay (for dialogs that need to render)
    const retryTimer = setTimeout(findTarget, 300);
    const retryTimer2 = setTimeout(findTarget, 600);
    
    setTimeout(() => setIsVisible(true), 100);

    // Re-calculate on resize and when DOM changes
    window.addEventListener('resize', findTarget);
    
    // Set up a periodic check for element position (in case dialog moves/renders)
    const intervalId = setInterval(findTarget, 500);
    
    return () => {
      window.removeEventListener('resize', findTarget);
      clearTimeout(retryTimer);
      clearTimeout(retryTimer2);
      clearInterval(intervalId);
    };
  }, [targetSelector, step]);

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

  const handlePrev = () => {
    setIsVisible(false);
    setTimeout(() => onPrev(), 200);
  };

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(() => onSkip(), 200);
  };

  const handleComplete = () => {
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 }
    });
    
    setTimeout(() => {
      toast.success('Tutorial Complete! 🎉', {
        description: 'You\'re now ready to create amazing products!',
        duration: 5000
      });
      onComplete();
    }, 500);
  };

  const getTooltipPosition = () => {
    if (!targetRect) return {};

    const tooltipWidth = 350;
    const tooltipHeight = 200; // approximate
    const margin = 20;

    let top, left;

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipHeight - margin;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'bottom':
        top = targetRect.top + targetRect.height + margin;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.left - tooltipWidth - margin;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.left + targetRect.width + margin;
        break;
      case 'center':
        top = window.innerHeight / 2 - tooltipHeight / 2 + window.scrollY;
        left = window.innerWidth / 2 - tooltipWidth / 2;
        break;
      default:
        top = targetRect.top + targetRect.height + margin;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
    }

    // Keep tooltip on screen
    if (left < 20) left = 20;
    if (left + tooltipWidth > window.innerWidth - 20) left = window.innerWidth - tooltipWidth - 20;
    if (top < 20 + window.scrollY) top = targetRect.top + targetRect.height + margin;

    return { top, left };
  };

  const tooltipPos = getTooltipPosition();

  return (
    <>
      {/* Backdrop - covers everything except highlighted area */}
      {targetRect ? (
        // Backdrop with cutout for highlighted element
        <div 
          className="fixed inset-0 transition-opacity duration-300 pointer-events-none"
          style={{ 
            opacity: isVisible ? 1 : 0,
            zIndex: 9990
          }}
        >
          {/* Top overlay */}
          <div 
            className="absolute inset-x-0 top-0 bg-black/70"
            style={{ height: targetRect.top - highlightPadding, pointerEvents: 'none' }}
          />
          {/* Bottom overlay */}
          <div 
            className="absolute inset-x-0 bottom-0 bg-black/70"
            style={{ top: targetRect.top + targetRect.height + highlightPadding, pointerEvents: 'none' }}
          />
          {/* Left overlay */}
          <div 
            className="absolute inset-y-0 left-0 bg-black/70"
            style={{ 
              width: targetRect.left - highlightPadding,
              top: targetRect.top - highlightPadding,
              height: targetRect.height + (highlightPadding * 2),
              pointerEvents: 'none'
            }}
          />
          {/* Right overlay */}
          <div 
            className="absolute inset-y-0 right-0 bg-black/70"
            style={{ 
              left: targetRect.left + targetRect.width + highlightPadding,
              top: targetRect.top - highlightPadding,
              height: targetRect.height + (highlightPadding * 2),
              pointerEvents: 'none'
            }}
          />
        </div>
      ) : (
        // Simple light backdrop for center dialogs (no specific element highlighted)
        <div 
          className="fixed inset-0 bg-black/40 transition-opacity duration-300"
          style={{ 
            opacity: isVisible && position === 'center' ? 1 : 0,
            zIndex: 9990,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Highlight cutout - target element remains fully interactive */}
      {targetRect && (
        <>
          {/* Invisible clickable area over highlighted element */}
          <div
            className="fixed"
            style={{
              top: targetRect.top - highlightPadding,
              left: targetRect.left - highlightPadding,
              width: targetRect.width + (highlightPadding * 2),
              height: targetRect.height + (highlightPadding * 2),
              zIndex: 9991,
              pointerEvents: 'auto',
              cursor: 'pointer'
            }}
            onClick={(e) => {
              // Forward click to the actual element
              const element = document.querySelector(targetSelector);
              if (element) {
                element.click();
              }
            }}
          />
          
          {/* Highlight border with glow */}
          <div
            className="fixed border-4 border-blue-500 rounded-lg pointer-events-none transition-all duration-300"
            style={{
              top: targetRect.top - highlightPadding,
              left: targetRect.left - highlightPadding,
              width: targetRect.width + (highlightPadding * 2),
              height: targetRect.height + (highlightPadding * 2),
              boxShadow: '0 0 30px rgba(59, 130, 246, 0.8)',
              opacity: isVisible ? 1 : 0,
              zIndex: 9998
            }}
          />
          
          {/* Pulsing ring animation */}
          <div
            className="fixed border-2 border-blue-400 rounded-lg pointer-events-none animate-ping"
            style={{
              top: targetRect.top - highlightPadding - 5,
              left: targetRect.left - highlightPadding - 5,
              width: targetRect.width + (highlightPadding * 2) + 10,
              height: targetRect.height + (highlightPadding * 2) + 10,
              opacity: isVisible ? 0.6 : 0,
              zIndex: 9997
            }}
          />
        </>
      )}

      {/* Tooltip Card */}
      <div
        className="fixed transition-all duration-300 max-h-[80vh] overflow-y-auto"
        style={{
          ...tooltipPos,
          width: '350px',
          maxWidth: 'calc(100vw - 40px)',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.9)',
          zIndex: 9999,
          pointerEvents: 'auto'
        }}
      >
        <Card className="border-2 border-blue-500 bg-card shadow-2xl">
          <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-semibold text-blue-500 uppercase tracking-wide">
                    Step {step} of {totalSteps}
                  </span>
                </div>
                <h4 className="font-bold text-foreground text-xl leading-tight">{title}</h4>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleSkip} 
                className="h-8 w-8 -mt-1 -mr-1 hover:bg-destructive/10 flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            
            {/* Progress bar */}
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
            
            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {step > 1 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePrev} 
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-3 w-3" />
                  Back
                </Button>
              )}
              {!hideNextButton && (
                <Button 
                  size="sm" 
                  onClick={handleNext} 
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                >
                  {step === totalSteps ? (
                    <>
                      Complete
                      <Sparkles className="ml-2 h-3 w-3" />
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Arrow pointer */}
        {targetRect && position !== 'center' && (
          <div 
            className="absolute w-0 h-0 border-8"
            style={{
              ...(position === 'bottom' && {
                top: '-16px',
                left: '50%',
                transform: 'translateX(-50%)',
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderBottom: '8px solid rgb(59, 130, 246)'
              }),
              ...(position === 'top' && {
                bottom: '-16px',
                left: '50%',
                transform: 'translateX(-50%)',
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '8px solid rgb(59, 130, 246)'
              }),
              ...(position === 'left' && {
                right: '-16px',
                top: '50%',
                transform: 'translateY(-50%)',
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderLeft: '8px solid rgb(59, 130, 246)'
              }),
              ...(position === 'right' && {
                left: '-16px',
                top: '50%',
                transform: 'translateY(-50%)',
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderRight: '8px solid rgb(59, 130, 246)'
              })
            }}
          />
        )}
      </div>
    </>
  );
}
