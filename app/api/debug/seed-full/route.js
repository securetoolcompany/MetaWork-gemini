import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') !== 'metawork-admin') {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    
    // 1. Define Mock Creators
    const creators = [
      {
        name: 'Cosmic Studios',
        email: 'cosmic@metawork.app',
        username: 'cosmic-studios',
        bio: 'Creating intergalactic designs for the modern voyager. Specializing in sci-fi and gaming aesthetics.',
        avatar: 'https://placehold.co/400x400/1a1a2e/e94560?text=CS',
        banner: 'https://placehold.co/1200x300/1a1a2e/e94560?text=Cosmic+Studios+Banner',
        aisleSettings: {
            theme: 'dark-professional',
            accentColor: '#e94560',
            tipJarEnabled: true,
            tipPlacement: 'header',
            showSalesCounter: true,
            defaultSort: 'best-selling',
            productsPerRow: 4,
            adSettings: { header: true, sidebar: true, inGrid: true, inGridFrequency: 8 }
        }
      },
      {
        name: 'Retro Designs',
        email: 'retro@metawork.app',
        username: 'retro-designs',
        bio: 'Bringing back the 80s and 90s one pixel at a time. Neon, synthwave, and nostalgia.',
        avatar: 'https://placehold.co/400x400/16213e/00fff5?text=RD',
        banner: 'https://placehold.co/1200x300/16213e/00fff5?text=Retro+Designs',
        aisleSettings: {
            theme: 'bold-vibrant',
            accentColor: '#00fff5',
            tipJarEnabled: true,
            tipPlacement: 'floating',
            showSalesCounter: false,
            defaultSort: 'newest',
            productsPerRow: 3,
            adSettings: { header: true, sidebar: false, inGrid: false }
        }
      },
      {
        name: 'Nature Art Co',
        email: 'nature@metawork.app',
        username: 'nature-art',
        bio: 'Organic patterns and minimalist nature illustrations. Sustainable design philosophy.',
        avatar: 'https://placehold.co/400x400/0f3460/e94560?text=NA',
        banner: 'https://placehold.co/1200x300/134e4a/10b981?text=Nature+Art',
        aisleSettings: {
            theme: 'light-modern',
            accentColor: '#10b981',
            tipJarEnabled: false,
            showSalesCounter: true,
            defaultSort: 'price-low',
            productsPerRow: 4,
            adSettings: { header: false, sidebar: true, inGrid: true }
        }
      }
    ];

    console.log('Seeding Users...');
    await db.collection('users').deleteMany({ email: { $in: creators.map(c => c.email) } });

    const passwordHash = await bcrypt.hash('password123', 10);
    const userMap = {}; // name -> userId

    for (const c of creators) {
        const userId = `user_${uuidv4()}`;
        userMap[c.name] = { id: userId, username: c.username };
        
        await db.collection('users').insertOne({
            id: userId,
            ...c,
            password: passwordHash,
            createdAt: new Date(),
            role: 'creator'
        });
    }

    // 2. Define and Link IP Assets
    // We reuse the list but update ownerId/username dynamically
    const mockIPAssets = [
      {
        name: 'Cosmic Dragon Logo',
        ownerName: 'Cosmic Studios',
        category: 'logo',
        imageUrl: 'https://placehold.co/600x600/1a1a2e/e94560?text=Dragon+IP',
        tags: ['dragon', 'gaming'],
        licensingFee: 2.50
      },
      {
        name: 'Neon Wave Pattern',
        ownerName: 'Retro Designs',
        category: 'pattern',
        imageUrl: 'https://placehold.co/600x600/16213e/00fff5?text=Neon+Wave',
        tags: ['neon', 'retro'],
        licensingFee: 1.75
      },
      {
        name: 'Zen Mountain',
        ownerName: 'Nature Art Co',
        category: 'artwork',
        imageUrl: 'https://placehold.co/600x600/0f3460/e94560?text=Mountain+IP',
        tags: ['nature', 'zen'],
        licensingFee: 3.00
      }
      // Add more as needed...
    ];

    console.log('Seeding IP...');
    await db.collection('ip_assets').deleteMany({ 
        ownerName: { $in: creators.map(c => c.name) } 
    });

    const ipDocs = mockIPAssets.map(ip => {
        const owner = userMap[ip.ownerName];
        if (!owner) return null;

        return {
            ...ip,
            id: uuidv4(),
            ownerId: owner.id,
            ownerUsername: owner.username, // CRITICAL FOR LINKING
            status: 'minted',
            isPublic: true,
            minted: true,
            usageCount: Math.floor(Math.random() * 100),
            createdAt: new Date()
        };
    }).filter(Boolean);

    if (ipDocs.length > 0) {
        await db.collection('ip_assets').insertMany(ipDocs);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Seeded ${creators.length} creators and ${ipDocs.length} IPs.`,
      creators: creators.map(c => ({ name: c.name, link: `/aisle/${c.username}` }))
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
