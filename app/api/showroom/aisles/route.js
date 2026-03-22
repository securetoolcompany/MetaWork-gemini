import { connectToDatabase } from '@/lib/mongodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    
    const { db } = await connectToDatabase();
    
    // Get all users
    const users = await db.collection('users')
      .find({}, { projection: { password: 0 } })
      .toArray();
    
    // Count products for each user
    const aislesWithData = await Promise.all(
      users.map(async (user) => {
        const productCount = await db.collection('products').countDocuments({
          userId: user.id,
          status: { $in: ['active', 'live'] }
        });
        
        return {
          id: user.id,
          slug: user.username, // ADD THIS - use username as slug
          title: user.name,
          description: user.bio,
          headerImage: user.banner,
          totalProducts: productCount,
          user: {
            id: user.id,
            name: user.name,
            username: user.username,
            avatar: user.avatar,
            verified: user.membershipTier === 'pro',
            tagline: user.bio ? user.bio.substring(0, 60) : '',
            stats: {
              followers: 0
            }
          },
          metrics: {
            views: productCount * 50 // Mock view count
          },
          createdAt: user.createdAt
        };
      })
    );
    
    // Filter by query if provided
    let filteredAisles = aislesWithData;
    if (query) {
      filteredAisles = aislesWithData.filter(aisle =>
        aisle.user.name.toLowerCase().includes(query.toLowerCase()) ||
        aisle.user.username.toLowerCase().includes(query.toLowerCase()) ||
        (aisle.description && aisle.description.toLowerCase().includes(query.toLowerCase()))
      );
    }
    
    // Only return aisles with products
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
