'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Edit,
  Save,
  X,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import ProfileViewMode from '@/components/profile/ProfileViewMode';
import ProfileEditMode from '@/components/profile/ProfileEditMode';
import { useAuth } from '@/lib/AuthContext';

export default function ProfilePageWYSIWYG() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const username = params.username || 'preview';
  
  const [profileData, setProfileData] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [draftData, setDraftData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
const isOwner = user && profileData && user.id === profileData.userId;

  // Fetch profile data from API
useEffect(() => {
  const fetchProfileData = async () => {
    try {
      const response = await fetch(`/api/profile/${username}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Use the profile data directly - API already returns correct format
        setProfileData(data.profile);
        setDraftData(data.profile);
        setIsLoading(false);
      } else {
        throw new Error(data.error || 'Failed to load profile');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
      
      // Fallback to default data
      const defaultData = {
        accentColor: '#3b82f6',
        displayName: username,
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
        socials: {
          twitter: '',
          instagram: '',
          youtube: '',
          tiktok: '',
          linkedin: ''
        },
        heroMedia: { type: 'image', url: '' },
        tipJar: {
          enabled: true,
          title: 'Support My Work',
          description: 'Buy me a coffee!'
        }
      };
      setProfileData(defaultData);
      setDraftData(defaultData);
      setIsEditMode(true);
      setIsLoading(false);
    }
  };

  if (username && username !== 'preview') {
    fetchProfileData();
  }
}, [username]);

  const handleEnterEditMode = () => {
    setIsEditMode(true);
    setDraftData({ ...profileData });
  };

  const handleSaveChanges = async () => {
    try {
      // TODO: Implement API call to save profile changes
      // For now, just update local state
      setProfileData(draftData);
      setIsEditMode(false);
      setHasUnsavedChanges(false);
      toast.success('Profile published successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Discard them?')) {
        setDraftData({ ...profileData });
        setIsEditMode(false);
        setHasUnsavedChanges(false);
      }
    } else {
      setIsEditMode(false);
    }
  };

  const handleBackToDashboard = () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Discard them and return to dashboard?')) {
        router.push('/');
      }
    } else {
      router.push('/');
    }
  };

  const updateDraft = (updates) => {
    setDraftData({ ...draftData, ...updates });
    setHasUnsavedChanges(true);
  };

  if (isLoading || !profileData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header - ONLY visible to the owner */}
      {isOwner && (
        <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToDashboard}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
              
              {isEditMode ? (
                <Badge variant="secondary" className="gap-1">
                  <Edit className="w-3 h-3" />
                  Editing Mode
                </Badge>
              ) : (
                <Badge variant="outline">Published View</Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isEditMode ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleCancel}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveChanges}>
                    <Save className="w-4 h-4 mr-2" />
                    Publish Changes
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={handleEnterEditMode}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Content */}
      <main>
        {isEditMode ? (
          <ProfileEditMode 
            data={draftData} 
            onUpdate={updateDraft}
          />
        ) : (
          <ProfileViewMode data={profileData} />
        )}
      </main>
    </div>
  );
}
