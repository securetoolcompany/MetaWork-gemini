'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import ProfileEditMode from '@/components/profile/ProfileEditMode';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, ExternalLink, Save } from 'lucide-react';

export default function ProfileSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [draftData, setDraftData] = useState({
      displayName: '',
      tagline: '',
      bio: '',
      socials: {}
    });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    const fetchProfileData = async () => {
      try {
        if (!user?.username) return;
        
        // Add cache-busting headers and a timestamp to force a fresh fetch
        const res = await fetch(`/api/profile/${user.username}?t=${Date.now()}`, { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
        const data = await res.json();

        if (data.success && data.profile) {
          // Directly set the data from the DB
          setDraftData(data.profile);
          console.log('✅ Loaded profile from DB:', data.profile);
        } else {
          // Fallback to default data for new users
          setDraftData({
            userId: user?.id,
            accentColor: '#3b82f6',
            displayName: user?.name || user?.username || '',
            tagline: 'Your tagline here',
            bio: '',
            bioMode: 'text',
            bioImage: null,
            bioVideo: null,
            mission: '',
            storySections: [],
            country: 'US',
            location: '',
            email: '',
            phone: '',
            website: '',
            socials: { twitter: '', instagram: '', youtube: '', tiktok: '', linkedin: '' },
            heroMedia: { type: 'image', url: '' },
            tipJar: { enabled: true, title: 'Support My Work', description: 'Buy me a coffee!' }
          });
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [user, authLoading]);

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/profile-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draftData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Profile published successfully!');
      } else {
        throw new Error(data.error || 'Failed to save profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl">
      {/* Dashboard Header: Stacks on mobile, Rows on desktop */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold">Profile Settings</h1>
          <p className="text-muted-foreground text-sm">Customize your public creator profile</p>
        </div>

        {/* Buttons: Full width and side-by-side on mobile */}
        <div className="flex gap-3 w-full md:w-auto">
          <Button 
            variant="outline" 
            onClick={() => window.open(`/profile/${user?.username}`, '_blank')}
            className="flex-1 md:flex-none h-11 md:h-10"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Public Profile
          </Button>
          <Button 
            onClick={handleSaveChanges} 
            disabled={isSaving}
            className="flex-1 md:flex-none h-11 md:h-10"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Embedded WYSIWYG Editor */}
      <div className="bg-background border rounded-xl shadow-sm overflow-hidden relative min-h-[600px]">
        {draftData && (
          <ProfileEditMode 
            data={draftData} 
            onUpdate={(updates) => setDraftData(prev => ({ ...prev, ...updates }))} 
          />
        )}
      </div>
    </div>
  );
}