'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import ProfileViewMode from '@/components/profile/ProfileViewMode';

export default function PublicProfilePage() {
  const params = useParams();
  const username = params.username;
  
  const [profileData, setProfileData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
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
          setProfileData(data.profile);
        } else {
          throw new Error(data.error || 'Failed to load profile');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    if (username && username !== 'preview') {
      fetchProfileData();
    } else {
      setIsLoading(false);
    }
  }, [username]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Profile not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Pure read-only presentation */}
      <main>
        <ProfileViewMode data={profileData} />
      </main>
    </div>
  );
}