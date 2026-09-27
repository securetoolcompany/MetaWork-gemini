import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '24', 10);
    const community = searchParams.get('community') === 'true';
    const creatorId = searchParams.get('creatorId') || '';

    const { db } = await connectToDatabase();

    if (community) {
      const creator = await db.collection('users').findOne({
        $or: [
          { id: creatorId },
          { username: creatorId },
          ...(ObjectId.isValid(creatorId)
            ? [{ _id: new ObjectId(creatorId) }]
            : []),
        ],
      });

      if (!creator) {
        return Response.json({
          success: true,
          products: [],
          pagination: { page, limit, total: 0, pages: 0 },
        });
      }

      const creatorIds = [
        creator._id.toString(),
        creator.id,
        creator.username,
      ].filter(Boolean);

      const ipAssets = await db.collection('ip_assets')
        .find({
          $or: [
            { ownerId: { $in: creatorIds } },
            { ownerUsername: creator.username },
          ],
        })
        .project({ _id: 1, id: 1 })
        .toArray();

      const ipIds = ipAssets
        .flatMap((ip) => [ip._id?.toString(), ip.id])
        .filter(Boolean);

      if (!ipIds.length) {
        return Response.json({
          success: true,
          products: [],
          pagination: { page, limit, total: 0, pages: 0 },
        });
      }

      const filter = {
        isDraft: { $ne: true },
        status: { $ne: 'draft' },

        $and: [
          {
            $or: [
              { showroomListed: true },
              { status: { $in: ['live', 'active'] } },
              { isPublic: true },
            ],
          },
          {
            $or: [
              { selectedIPs: { $in: ipIds } },
              { ipAssetIds: { $in: ipIds } },
              { ipAssetId: { $in: ipIds } },
            ],
          },
          {
            $nor: [
              { creatorId: { $in: creatorIds } },
              { userId: { $in: creatorIds } },
            ],
          },
        ],
      };

      const [products, total] = await Promise.all([
        db.collection('products')
          .find(filter)
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray(),

        db.collection('products').countDocuments(filter),
      ]);

      return Response.json({
        success: true,
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    }

    const filter = {
      isDraft: { $ne: true },
      status: { $ne: 'draft' },
      $or: [
        { showroomListed: true },
        { status: { $in: ['live', 'active'] } },
        { isPublic: true },
      ],
    };

    if (query) {
      filter.$and = [
        {
          $or: [
            { title: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { tags: { $in: [new RegExp(query, 'i')] } },
          ],
        },
      ];
    }

    const [products, total] = await Promise.all([
      db.collection('products')
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),

      db.collection('products').countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);

    return Response.json(
      { error: 'Failed to fetch products', details: error.message },
      { status: 500 },
    );
  }
}