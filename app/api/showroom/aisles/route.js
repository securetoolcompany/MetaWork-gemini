import { connectToDatabase } from '@/lib/mongodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    
    const { db } = await connectToDatabase();
    
    const users = await db.collection('users')
    .find({ 
      'profile.displayName': { $exists: true },
      aisleSettings: { $exists: true } 
    }, { projection: { password: 0 } })
    .toArray();
    
    const aislesWithData = await Promise.all(
      users.map(async (user) => {
        const productCount = await db.collection('products').countDocuments({
          userId: user.id,
          status: { $in: ['active', 'live'] }
        });
        
        return {
          id: user.id,
          slug: user.username,
          title: user.aisleSettings?.title || user.profile?.displayName || user.name || user.username,
          description: user.aisleSettings?.description || user.bio || '',
          headerImage: user.aisleSettings?.bannerImage || user.banner,
          totalProducts: productCount,
          // CRITICAL: This allows the ShopByAisle page to actually see the filters
          aisleSettings: user.aisleSettings || {}, 
          user: {
            id: user.id,
            name: user.profile?.displayName || user.name,
            username: user.username,
            avatar: user.avatar,
            verified: user.membershipTier === 'pro',
            tagline: user.aisleSettings?.tagline || (user.bio ? user.bio.substring(0, 60) : ''),
            stats: {
              followers: 0
            }
          },
          metrics: {
            views: productCount * 50 
          },
          createdAt: user.createdAt
        };
      })
    );
    
    let filteredAisles = aislesWithData;
    if (query) {
      filteredAisles = aislesWithData.filter(aisle =>
        aisle.user.name.toLowerCase().includes(query.toLowerCase()) ||
        aisle.user.username.toLowerCase().includes(query.toLowerCase()) ||
        (aisle.description && aisle.description.toLowerCase().includes(query.toLowerCase()))
      );
    }
    
    const aislesWithProducts = filteredAisles.filter(a => a.totalProducts > 0);
    
    return Response.json({ aisles: aislesWithProducts });
  } catch (error) {
    console.error('Error fetching aisles:', error);
    return Response.json(
      { error: 'Failed to fetch aisles', details: error.message },
      { status: 500 }
    );
  }
}
