import { ObjectId } from 'mongodb';
import {
  publicProductEligibility,
  publicIpEligibility,
} from '@/lib/public-inventory-eligibility';
import { getAisleDisplayState } from '@/lib/aisle-displayability';

export async function getCreatorAisleState(db, creator) {
  if (!creator?._id) return null;

  const strIds = [...new Set(
    [creator._id, creator.id, creator.userId, creator.username]
      .filter(Boolean)
      .map(String)
  )];
  const objIds = strIds.filter((v) => ObjectId.isValid(v)).map((v) => new ObjectId(v));
  const ids = [...strIds, ...objIds];

  const owner = (idFields, nameFields) => ({
    $or: [
      ...idFields.map((f) => ({ [f]: { $in: ids } })),
      ...(creator.username ? nameFields.map((f) => ({ [f]: creator.username })) : []),
    ],
  });

  const [products, ipAssets] = await Promise.all([
    db.collection('products')
      .find({
        $and: [
          owner(['creatorId', 'userId', 'ownerId'], ['creatorUsername', 'ownerUsername']),
          publicProductEligibility(),
        ],
      })
      .project({ _id: 1, id: 1 })
      .toArray(),
    db.collection('ip_assets')
      .find({
        $and: [
          owner(['ownerId', 'userId', 'creatorId'], ['ownerUsername', 'creatorUsername', 'username']),
          publicIpEligibility(),
        ],
      })
      .project({ _id: 1, id: 1 })
      .toArray(),
  ]);

  const collections = (creator.collections || []).filter((c) => c?.active !== false);
  return getAisleDisplayState(creator, products, ipAssets, collections);
}
