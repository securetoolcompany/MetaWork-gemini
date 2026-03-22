import { connectToDatabase } from '@/lib/mongodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '24');
    
    // ✅ DESTRUCTURE to get db from the returned object
    const { db } = await connectToDatabase();
    
    // Build filter
    const filter = {
      showroomListed: true,
      status: 'active'
    };
    
    if (query) {
      filter.$or = [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ];
    }
    
    // Fetch products
    const products = await db.collection('products')
      .find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    
    // Get total count
    const total = await db.collection('products').countDocuments(filter);
    
    return Response.json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return Response.json(
      { error: 'Failed to fetch products', details: error.message },
      { status: 500 }
    );
  }
}
