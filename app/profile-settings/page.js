'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProfileSettingsRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to WYSIWYG editor
    router.push('/profile/preview');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Opening profile editor...</p>
      </div>
    </div>
  );
}
