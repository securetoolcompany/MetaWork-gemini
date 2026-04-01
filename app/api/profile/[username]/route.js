import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic'; 

export async function GET(request, { params }) {
  const { username } = await params;
  
  try {
    const { db } = await connectToDatabase();
    
    const searchRegex = new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const creator = await db.collection('users').findOne(
      { username: searchRegex },
      { projection: { password: 0 } }
    );
    
    if (!creator) {
      return NextResponse.json({ success: false, error: 'Creator not found' }, { status: 404 });
    }
    
    const profileSettings = creator.profileSettings || {};
    
    const dynamicSections = {};
    Object.keys(creator).forEach(key => {
      if (key.startsWith('storySection_')) {
        dynamicSections[key] = creator[key];
      }
    });

    return NextResponse.json({
      success: true,
      profile: {
        id: creator.id,
        username: creator.username,
        displayName: creator.displayName || profileSettings.displayName || creator.name || creator.username,
        email: creator.email,
        
        profilePicture: creator.profilePicture || { url: creator.profileImage || creator.avatar || '' },
        heroMedia: creator.heroMedia || profileSettings.heroMedia || { type: 'image', url: creator.profileBanner || creator.banner || '' },
        
        tagline: creator.tagline || profileSettings.tagline || '',
        bio: creator.bio || profileSettings.bio || '',
        bioMode: creator.bioMode || profileSettings.bioMode || 'text',
        bioImage: creator.bioImage || profileSettings.bioImage || null,
        bioVideo: creator.bioVideo || profileSettings.bioVideo || null,
        mission: creator.mission || profileSettings.mission || '',
        storySections: creator.storySections || profileSettings.storySections || [],
        chaptersSectionTitle: creator.chaptersSectionTitle || profileSettings.chaptersSectionTitle || 'Story Chapters',
        bioSectionTitle: creator.bioSectionTitle || profileSettings.bioSectionTitle || 'Biography / My Story',
        missionSectionTitle: creator.missionSectionTitle || profileSettings.missionSectionTitle || 'Mission / Goal',
        country: creator.country || profileSettings.country || 'US',
        location: creator.location || profileSettings.location || '',
        phone: creator.phone || profileSettings.phone || '',
        website: creator.website || profileSettings.website || '',
        socials: creator.socials || profileSettings.socials || {},
        accentColor: creator.accentColor || profileSettings.accentColor || '#3b82f6',
        tipJar: creator.tipJar || profileSettings.tipJar || { enabled: false, title: 'Support My Work', description: 'Buy me a coffee!', presets: [5, 10, 20] },
        verified: creator.membershipTier === 'pro',
        membershipTier: creator.membershipTier,
        createdAt: creator.createdAt,
        aisleUrl: `/aisle/${username}`,
        hasAisle: true,
        ...dynamicSections 
      }
    });
  } catch (error) {
    console.error('❌ Profile API Error:', error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}