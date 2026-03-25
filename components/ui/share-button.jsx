'use client';

import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';

export function ShareButton({ 
  url, 
  title = 'Check this out on MetaWork!', 
  text = 'I thought you might like this.', 
  variant = 'outline', 
  className = '', 
  iconClassName = 'w-4 h-4 mr-2',
  iconStyle = {},
  buttonText = 'Share',
  ...props 
}) {
  const handleShare = async (e) => {
    // Prevent default just in case it's placed inside a Link or form
    e.preventDefault(); 
    e.stopPropagation();

    // Use the provided URL or default to the current window location
    const shareUrl = url || window.location.href;
    const shareData = { title, text, url: shareUrl };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyToClipboard(shareUrl);
        }
      }
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (shareUrl) => {
    navigator.clipboard.writeText(shareUrl)
      .then(() => toast.success('Link copied to clipboard!'))
      .catch(() => toast.error('Failed to copy link.'));
  };

  return (
    <Button 
      variant={variant} 
      className={className} 
      onClick={handleShare}
      {...props}
    >
      <Share2 className={iconClassName} style={iconStyle} />
      {buttonText && <span>{buttonText}</span>}
    </Button>
  );
}