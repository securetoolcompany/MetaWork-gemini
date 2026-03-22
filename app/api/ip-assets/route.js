import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ownerUsername = searchParams.get('owner');
  const collection = searchParams.get('collection');
  
  try {
    const db = await getDatabase();
    
    const query = {};
    
    if (ownerUsername) {
      query.ownerUsername = ownerUsername;
    }
    
    if (collection && collection !== 'all') {
      query.collection = collection;
    }
    
    // Only show active/unminted assets (not already tokenized)
    query.status = { $in: ['unminted', 'active', 'pending_pool_create', 'minted'] };
    
    const ipAssets = await db.collection('ip_assets')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    
    return Response.json({ 
      success: true, 
      ipAssets: ipAssets.map(asset => ({
        ...asset,
        id: asset._id.toString(),
        _id: asset._id.toString(),
        revenueTokenAssetId: asset.revenueTokenAssetId || null
      }))
    });
  } catch (error) {
    console.error('Error fetching IP assets:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
