import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  // Security: Optional simple check to prevent public accidental seeding
  // You can remove this 'if' block if you want it openly accessible for testing
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') !== 'metawork-admin') {
     return NextResponse.json({ error: 'Unauthorized. Add ?secret=metawork-admin to URL' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    
    // 1. Define the Mock Data (with new ownerName field)
    const mockIPAssets = [
      {
        id: uuidv4(),
        name: 'Cosmic Dragon Logo',
        description: 'Fierce dragon logo with cosmic galaxy theme - perfect for gaming brands',
        imageUrl: 'https://placehold.co/600x600/1a1a2e/e94560?text=Dragon+IP',
        category: 'logo',
        ownerName: 'Cosmic Studios',
        tags: ['dragon', 'gaming', 'cosmic', 'esports', 'fierce'],
        licensingFee: 2.50,
        status: 'minted',
        isPublic: true,
        minted: true,
        usageCount: 45,
        totalRevenue: 112.50,
        createdAt: new Date('2024-11-15')
      },
      {
        id: uuidv4(),
        name: 'Neon Wave Pattern',
        description: 'Retro 80s inspired neon wave pattern for apparel and accessories',
        imageUrl: 'https://placehold.co/600x600/16213e/00fff5?text=Neon+Wave',
        category: 'pattern',
        ownerName: 'Retro Designs',
        tags: ['neon', 'retro', '80s', 'synthwave', 'pattern'],
        licensingFee: 1.75,
        status: 'minted',
        isPublic: true,
        minted: true,
        usageCount: 78,
        totalRevenue: 136.50,
        createdAt: new Date('2024-10-20')
      },
      {
        id: uuidv4(),
        name: 'Zen Mountain Landscape',
        description: 'Minimalist mountain silhouette with zen aesthetic',
        imageUrl: 'https://placehold.co/600x600/0f3460/e94560?text=Mountain+IP',
        category: 'artwork',
        ownerName: 'Nature Art Co',
        tags: ['mountain', 'nature', 'zen', 'minimalist', 'outdoor'],
        licensingFee: 3.00,
        status: 'minted',
        isPublic: true,
        minted: true,
        usageCount: 32,
        totalRevenue: 96.00,
        createdAt: new Date('2024-12-01')
      },
      {
        id: uuidv4(),
        name: 'Geometric Fox',
        description: 'Low-poly geometric fox illustration - trendy and modern',
        imageUrl: 'https://placehold.co/600x600/533483/ff6b6b?text=Geo+Fox',
        category: 'illustration',
        ownerName: 'PolyMaster',
        tags: ['fox', 'geometric', 'lowpoly', 'modern', 'animal'],
        licensingFee: 2.25,
        status: 'minted',
        isPublic: true,
        minted: true,
        usageCount: 56,
        totalRevenue: 126.00,
        createdAt: new Date('2024-09-10')
      },
      {
        id: uuidv4(),
        name: 'Cyber Skull',
        description: 'Cyberpunk styled skull with neon accents and circuit patterns',
        imageUrl: 'https://placehold.co/600x600/1a1a2e/00d4ff?text=Cyber+Skull',
        category: 'artwork',
        ownerName: 'Cosmic Studios',
        tags: ['skull', 'cyberpunk', 'neon', 'gothic', 'tech'],
        licensingFee: 4.50,
        status: 'minted',
        isPublic: true,
        minted: true,
        usageCount: 23,
        totalRevenue: 103.50,
        createdAt: new Date('2024-11-01')
      },
      {
        id: uuidv4(),
        name: 'Tropical Leaves',
        description: 'Vibrant tropical leaf pattern for summer collections',
        imageUrl: 'https://placehold.co/600x600/134e4a/10b981?text=Tropical',
        category: 'pattern',
        ownerName: 'Nature Art Co',
        tags: ['tropical', 'leaves', 'nature', 'summer', 'botanical'],
        licensingFee: 1.50,
        status: 'minted',
        isPublic: true,
        minted: true,
        usageCount: 89,
        totalRevenue: 133.50,
        createdAt: new Date('2024-08-15')
      },
      {
        id: uuidv4(),
        name: 'Street Art Splash',
        description: 'Urban graffiti style splash art with bold colors',
        imageUrl: 'https://placehold.co/600x600/7c3aed/fbbf24?text=Street+Art',
        category: 'artwork',
        ownerName: 'Urban Legend',
        tags: ['graffiti', 'urban', 'street', 'splash', 'bold'],
        licensingFee: 3.75,
        status: 'minted',
        isPublic: true,
        minted: true,
        usageCount: 41,
        totalRevenue: 153.75,
        createdAt: new Date('2024-10-05')
      },
      {
        id: uuidv4(),
        name: 'Vintage Badge Collection',
        description: 'Classic vintage badge designs with retro typography',
        imageUrl: 'https://placehold.co/600x600/78350f/fbbf24?text=Vintage',
        category: 'logo',
        ownerName: 'Retro Designs',
        tags: ['vintage', 'badge', 'retro', 'classic', 'typography'],
        licensingFee: 2.00,
        status: 'minted',
        isPublic: true,
        minted: true,
        usageCount: 67,
        totalRevenue: 134.00,
        createdAt: new Date('2024-07-20')
      },
      {
        id: uuidv4(),
        name: 'Space Explorer',
        description: 'Astronaut illustration with cosmic background elements',
        imageUrl: 'https://placehold.co/600x600/0c0a09/f97316?text=Space',
        category: 'illustration',
        ownerName: 'Cosmic Studios',
        tags: ['space', 'astronaut', 'cosmic', 'sci-fi', 'exploration'],
        licensingFee: 5.00,
        status: 'minted',
        isPublic: true,
        minted: true,
        usageCount: 19,
        totalRevenue: 95.00,
        createdAt: new Date('2024-12-10')
      },
      {
        id: uuidv4(),
        name: 'Mandala Dreams',
        description: 'Intricate mandala design with spiritual aesthetics',
        imageUrl: 'https://placehold.co/600x600/4c1d95/a78bfa?text=Mandala',
        category: 'pattern',
        ownerName: 'Spirit Designs',
        tags: ['mandala', 'spiritual', 'intricate', 'zen', 'meditation'],
        licensingFee: 2.75,
        status: 'minted',
        isPublic: true,
        minted: true,
        usageCount: 34,
        totalRevenue: 93.50,
        createdAt: new Date('2024-09-25')
      }
    ];

    // 2. Clear existing mock data
    await db.collection('ip_assets').deleteMany({ minted: true, isPublic: true });
    
    // 3. Insert new data
    const result = await db.collection('ip_assets').insertMany(
      mockIPAssets.map(ip => ({
        ...ip,
        ownerWallet: 'DEMO_WALLET_ADDRESS_FOR_MOCK_IP',
        userId: 'mock-user-001',
        ipAssetId: ip.id,
        assetId: Math.floor(Math.random() * 900000000) + 100000000, 
        revenuePoolAppId: Math.floor(Math.random() * 900000000) + 100000000,
        updatedAt: new Date()
      }))
    );

    return NextResponse.json({ 
      success: true, 
      message: `Seeded ${result.insertedCount} IP assets with creators`,
      creators: [...new Set(mockIPAssets.map(i => i.ownerName))]
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
