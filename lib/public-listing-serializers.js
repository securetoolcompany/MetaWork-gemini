/**
 * Public listing DTOs only: not owner inventory or detail responses.
 *
 * assetType retains its existing token/auth semantics.
 * Preview fields do not classify the underlying media.
 * New public media fields require explicit selectors and regression tests.
 */
const PUBLIC_COMMON_FIELDS = Object.freeze([
  'name', 'title', 'description', 'shortDescription', 'summary',
  'category', 'categories', 'tags', 'userTags', 'systemCategory',
  'status', 'isPublic', 'isVisible', 'showroomListed',
  'viewCount', 'salesCount', 'sales', 'usageCount',
  'ownerName', 'ownerUsername', 'ownerAvatar',
  'creatorName', 'creatorUsername', 'creatorAvatar',
]);

const PUBLIC_PRODUCT_FIELDS = Object.freeze([
  'productName', 'excerpt', 'catalogProductName',
  'priceCents', 'price', 'salePrice', 'retailPrice', 'basePrice',
]);

const PUBLIC_IP_FIELDS = Object.freeze([
  'assetName', 'assetType', 'licensable',
  'licensingFeeCents', 'priceCents', 'licensingFee', 'licenseFeeUsd',
  'licensePrice', 'pricePerUse', 'price',
]);

const PUBLIC_CREATOR_ID_FIELDS = Object.freeze([
  'ownerId', 'userId', 'creatorId',
]);

// Existing public previews only. These names do not define a media schema.
const PUBLIC_PREVIEW_FIELDS = Object.freeze([
  'mockupUrl', 'thumbnailUrl', 'imageUrl', 'image', 'thumbnail',
  'previewUrl', 'previewImage', 'coverImage',
]);

const PUBLIC_PREVIEW_ARRAY_FIELDS = Object.freeze([
  'images', 'mockupImages', 'mockupUrls',
]);

const PUBLIC_PRICE_FIELDS = new Set([
  'priceCents', 'price', 'salePrice', 'retailPrice', 'basePrice',
  'licensingFeeCents', 'licensingFee', 'licenseFeeUsd',
  'licensePrice', 'pricePerUse',
]);

function scalar(value) {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

function displayValue(value, field) {
  if (PUBLIC_PRICE_FIELDS.has(field) && value && typeof value === 'object') {
    if (value._bsontype === 'Decimal128') return value.toString();
    if (typeof value.$numberDecimal === 'string') return value.$numberDecimal;
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map(scalar).filter(item => item !== undefined);
  }

  return scalar(value);
}

function identifier(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value.toHexString === 'function') return value.toHexString();
  return undefined;
}

function preview(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  // Explicit nested selection; never return the original image object.
  const result = {};
  for (const key of ['secure_url', 'url']) {
    if (typeof value[key] === 'string') result[key] = value[key];
  }
  return Object.keys(result).length ? result : undefined;
}

function listing(document, fields) {
  const result = {};
  const mongoId = identifier(document._id);
  const publicId = identifier(document.id) || mongoId;

  if (mongoId !== undefined) result._id = mongoId;
  if (publicId !== undefined) result.id = publicId;

  for (const field of [...PUBLIC_COMMON_FIELDS, ...fields]) {
    // assetType is a stored scalar, never inferred or normalized.
    const value = field === 'assetType'
      ? scalar(document[field])
      : displayValue(document[field], field);
    if (value !== undefined) result[field] = value;
  }

  for (const field of PUBLIC_CREATOR_ID_FIELDS) {
    const value = identifier(document[field]);
    if (value !== undefined) result[field] = value;
  }

  for (const field of PUBLIC_PREVIEW_FIELDS) {
    const value = preview(document[field]);
    if (value !== undefined) result[field] = value;
  }

  for (const field of PUBLIC_PREVIEW_ARRAY_FIELDS) {
    if (Array.isArray(document[field])) {
      result[field] = document[field]
        .map(preview)
        .filter(value => value !== undefined);
    }
  }

  return result;
}

export function toPublicProductListing(document) {
  return listing(document, PUBLIC_PRODUCT_FIELDS);
}

export function toPublicIpListing(document) {
  return listing(document, PUBLIC_IP_FIELDS);
}
