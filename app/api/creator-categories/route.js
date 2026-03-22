import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// Default creator categories if none exist in database
const DEFAULT_CATEGORIES = [
  // Art Styles
  { name: 'Anime & Manga', slug: 'anime', type: 'art_style', iconName: 'Sparkles', color: '#FF1493', displayOrder: 1 },
  { name: 'Graffiti', slug: 'graffiti', type: 'art_style', iconName: 'Spray', color: '#FF6B35', displayOrder: 2 },
  { name: 'Realism', slug: 'realism', type: 'art_style', iconName: 'Eye', color: '#4A5568', displayOrder: 3 },
  { name: 'Abstract', slug: 'abstract', type: 'art_style', iconName: 'Shapes', color: '#9333EA', displayOrder: 4 },
  { name: 'Pop Art', slug: 'pop-art', type: 'art_style', iconName: 'Zap', color: '#FFEB3B', displayOrder: 5 },
  { name: 'Minimalist', slug: 'minimalist', type: 'art_style', iconName: 'Minus', color: '#000000', displayOrder: 6 },
  { name: 'Comic Book', slug: 'comic', type: 'art_style', iconName: 'BookOpen', color: '#DC2626', displayOrder: 7 },
  { name: 'Fantasy', slug: 'fantasy', type: 'art_style', iconName: 'Wand2', color: '#7C3AED', displayOrder: 8 },
  
  // Mediums
  { name: 'Digital Art', slug: 'digital', type: 'medium', iconName: 'Monitor', color: '#3B82F6', displayOrder: 1 },
  { name: 'Traditional', slug: 'traditional', type: 'medium', iconName: 'Brush', color: '#8B4513', displayOrder: 2 },
  { name: 'Watercolor', slug: 'watercolor', type: 'medium', iconName: 'Droplet', color: '#00BCD4', displayOrder: 3 },
  { name: 'Photography', slug: 'photography', type: 'medium', iconName: 'Camera', color: '#607D8B', displayOrder: 4 },
  { name: '3D Design', slug: '3d', type: 'medium', iconName: 'Box', color: '#9C27B0', displayOrder: 5 },
  { name: 'Mixed Media', slug: 'mixed-media', type: 'medium', iconName: 'Layers', color: '#FF9800', displayOrder: 6 },
  
  // Commercial Services
  { name: 'Logo Design', slug: 'logo-design', type: 'commercial', iconName: 'Badge', color: '#10B981', displayOrder: 1 },
  { name: 'Branding Kits', slug: 'branding', type: 'commercial', iconName: 'Package', color: '#8B5CF6', displayOrder: 2 },
  { name: 'Illustration', slug: 'illustration', type: 'commercial', iconName: 'Pen', color: '#F59E0B', displayOrder: 3 },
  { name: 'Character Design', slug: 'character-design', type: 'commercial', iconName: 'User', color: '#EC4899', displayOrder: 4 },
  { name: 'Pattern Design', slug: 'pattern-design', type: 'commercial', iconName: 'Grid3x3', color: '#14B8A6', displayOrder: 5 }
];

/**
 * GET /api/creator-categories
 * Fetch all creator categories, optionally filtered by type
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'art_style', 'medium', 'commercial'
    
    const { db } = await connectToDatabase();
    
    // Check if categories exist in database
    let categories = await db.collection('creator_categories')
      .find(type ? { type, isActive: { $ne: false } } : { isActive: { $ne: false } })
      .sort({ type: 1, displayOrder: 1 })
      .toArray();
    
    // If no categories in DB, use defaults
    if (categories.length === 0) {
      console.log('📦 No creator categories in DB, using defaults');
      categories = type 
        ? DEFAULT_CATEGORIES.filter(c => c.type === type)
        : DEFAULT_CATEGORIES;
    }
    
    // Group by type for easier frontend use
    const grouped = {
      art_styles: categories.filter(c => c.type === 'art_style'),
      mediums: categories.filter(c => c.type === 'medium'),
      commercial: categories.filter(c => c.type === 'commercial')
    };

    return NextResponse.json({
      success: true,
      categories,
      grouped,
      total: categories.length
    });
    
  } catch (error) {
    console.error('Creator Categories API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/creator-categories
 * Seed default categories into the database
 */
export async function POST(request) {
  try {
    const { db } = await connectToDatabase();
    
    // Check if categories already exist
    const existingCount = await db.collection('creator_categories').countDocuments();
    
    if (existingCount > 0) {
      return NextResponse.json({
        success: true,
        message: 'Categories already exist',
        count: existingCount
      });
    }
    
    // Insert default categories
    const now = new Date();
    const categoriesWithTimestamps = DEFAULT_CATEGORIES.map(cat => ({
      ...cat,
      isActive: true,
      createdAt: now,
      updatedAt: now
    }));
    
    await db.collection('creator_categories').insertMany(categoriesWithTimestamps);
    
    return NextResponse.json({
      success: true,
      message: 'Categories seeded successfully',
      count: DEFAULT_CATEGORIES.length
    });
    
  } catch (error) {
    console.error('Seed Categories Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
