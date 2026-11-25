import { ObjectId } from 'mongodb';
import { IP_UPLOAD_OPERATIONS_COLLECTION } from '../ip-upload-operations.js';
import { PRODUCT_KINDS } from '../product-kinds.js';

export const STL_PROVISIONED_KINDS = Object.freeze([
  PRODUCT_KINDS.STL_FILE,
  PRODUCT_KINDS.PRINT_3D,
]);

const TITLE_SUFFIX = Object.freeze({
  [PRODUCT_KINDS.STL_FILE]: ' (STL File)',
  [PRODUCT_KINDS.PRINT_3D]: ' (3D Print)',
});

export function stlProvisioningKey(operationKey, kind) {
  return 'stl-provision:v1:' + operationKey + ':' + kind;
}

export function buildProvisionedProduct({ asset, operation, kind, productId, date }) {
  const title = String(asset.name || 'Untitled') + TITLE_SUFFIX[kind];
  const product = {
    _id: productId,
    id: productId.toHexString(),
    productKind: kind,
    provisioningKey: stlProvisioningKey(operation.operationKey, kind),
    externalProductId: 'stl:' + operation.operationKey + ':' + kind,
    ipAssetId: asset.id,
    sourceOperationKey: operation.operationKey,
    userId: asset.ownerId,
    ownerId: asset.ownerId,
    creatorId: asset.ownerId,
    title,
    name: title,
    description: typeof asset.description === 'string' ? asset.description : '',
    status: 'unlisted',
    isPublic: false,
    isDraft: false,
    isVisible: false,
    showroomListed: false,
    price: null,
    variants: [],
    imageUrl: null,
    createdAt: date,
    updatedAt: date,
  };

  if (kind === PRODUCT_KINDS.STL_FILE) {
    product.delivery = { type: 'digital_download', fileProtection: 'none' };
  } else {
    product.fulfillment = { status: 'offline', reason: 'printer_fulfillment_unavailable' };
  }

  return product;
}

async function provisionKind({ client, db, asset, operation, kind, now }) {
  if (operation.provisioning?.[kind]) return 'exists';

  const operations = db.collection(IP_UPLOAD_OPERATIONS_COLLECTION);
  const path = 'provisioning.' + kind;
  const productId = new ObjectId();
  const date = now();
  const session = client.startSession();
  let outcome = 'exists';

  try {
    await session.withTransaction(async () => {
      outcome = 'exists';
      const claim = await operations.updateOne(
        {
          _id: operation._id,
          ownerId: operation.ownerId,
          operationKey: operation.operationKey,
          [path]: { $exists: false },
        },
        {
          $set: {
            [path]: {
              schemaVersion: 1,
              phase: 'created',
              key: stlProvisioningKey(operation.operationKey, kind),
              productId,
              createdAt: date,
            },
            updatedAt: date,
          },
        },
        { session },
      );
      if (claim.matchedCount !== 1) return;

      await db.collection('products').insertOne(
        buildProvisionedProduct({ asset, operation, kind, productId, date }),
        { session },
      );
      outcome = 'created';
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
    });
  } finally {
    await session.endSession();
  }

  return outcome;
}

export async function provisionStlProducts({ client, db, ipAssetId, now = () => new Date() }) {
  const asset = await db.collection('ip_assets').findOne({ id: ipAssetId });
  if (!asset) return { state: 'asset_missing' };
  if (asset.status !== 'active' || asset.creditStatus !== 'consumed') {
    return { state: 'not_ready' };
  }
  if (!asset.uploadPreparationId) return { state: 'not_bound' };

  const operation = await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).findOne({
    _id: asset.uploadPreparationId,
    ownerId: asset.ownerId,
    operationKey: asset.tokenizationOperationKey,
  });
  if (!operation) return { state: 'not_bound' };
  if (operation.sourceDeclaration?.format !== 'stl') return { state: 'not_stl' };

  const results = {};
  let firstError = null;
  for (const kind of STL_PROVISIONED_KINDS) {
    try {
      results[kind] = await provisionKind({ client, db, asset, operation, kind, now });
    } catch (error) {
      results[kind] = 'error';
      firstError ??= error;
    }
  }

  return { state: firstError ? 'partial' : 'ok', results, error: firstError };
}
