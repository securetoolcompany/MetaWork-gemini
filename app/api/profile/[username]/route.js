import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { username } = await params;
  
  try {
    console.log('🔍 Profile API: Looking for username:', username);
    
    const { db } = await connectToDatabase();
    
    // Fetch Creator Profile by username
    const creator = await db.collection('users').findOne(
      { username: username },
      { projection: { password: 0 } }
    );
    
    console.log('👤 Found creator:', creator ? creator.username : 'NOT FOUND');
    
    if (!creator) {
      console.log('❌ Creator not found for username:', username);
      return NextResponse.json({ 
        success: false,
        error: 'Creator not found' 
      }, { status: 404 });
    }
    
    // Extract profile-specific data
    const profileSettings = creator.profileSettings || {};
    
    return NextResponse.json({
      success: true,
      profile: {
        // Basic Info
        id: creator.id,
        username: creator.username,
        displayName: profileSettings.displayName || creator.name || creator.username,
        email: creator.email,
        
        // Profile Images (separate from aisle)
        profileImage: creator.profileImage || creator.avatar,
        bannerImage: creator.profileBanner || creator.banner,
        heroMedia: profileSettings.heroMedia || { 
          type: 'image', 
          url: creator.profileBanner || creator.banner || '' 
        },
        
        // Bio & Story
        tagline: profileSettings.tagline || '',
        bio: profileSettings.bio || creator.bio || '',
        bioMode: profileSettings.bioMode || 'text',
        bioImage: profileSettings.bioImage || null,
        bioVideo: profileSettings.bioVideo || null,
        mission: profileSettings.mission || '',
        storySections: profileSettings.storySections || [],
        
        // Contact & Location
        country: profileSettings.country || creator.country || 'US',
        location: profileSettings.location || creator.location || '',
        phone: profileSettings.phone || '',
        website: profileSettings.website || creator.website || '',
        
        // Social Links
        socials: {
          twitter: creator.socials?.twitter || profileSettings.socials?.twitter || '',
          instagram: creator.socials?.instagram || profileSettings.socials?.instagram || '',
          youtube: creator.socials?.youtube || profileSettings.socials?.youtube || '',
          tiktok: creator.socials?.tiktok || profileSettings.socials?.tiktok || '',
          linkedin: creator.socials?.linkedin || profileSettings.socials?.linkedin || '',
          facebook: creator.socials?.facebook || profileSettings.socials?.facebook || '',
          discord: creator.socials?.discord || profileSettings.socials?.discord || '',
        },
        
        // Theme & Styling
        accentColor: profileSettings.accentColor || '#3b82f6',
        
        // Tip Jar Settings
        tipJar: {
          enabled: profileSettings.tipJar?.enabled || false,
          title: profileSettings.tipJar?.title || 'Support My Work',
          description: profileSettings.tipJar?.description || 'Buy me a coffee!',
          presets: profileSettings.tipJar?.presets || [5, 10, 20]
        },
        
        // Metadata
        verified: creator.membershipTier === 'pro',
        membershipTier: creator.membershipTier,
        createdAt: creator.createdAt,
        
        // Link to Aisle
        aisleUrl: `/aisle/${username}`,
        hasAisle: true
      }
    });
  } catch (error) {
    console.error('❌ Profile API Error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Server Error', 
      details: error.message 
    }, { status: 500 });
  }
}
