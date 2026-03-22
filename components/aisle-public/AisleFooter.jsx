'use client';

import { Sparkles } from 'lucide-react';

export default function AisleFooter({ showPoweredBy }) {
  if (!showPoweredBy) return null;

  return (
    <footer className="border-t border-border mt-16">
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <a 
          href="https://metawork.io" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          <span>Powered by <strong>MetaWork</strong></span>
        </a>
        <p className="text-xs text-muted-foreground mt-2">
          Create your own creator storefront in minutes
        </p>
      </div>
    </footer>
  );
}