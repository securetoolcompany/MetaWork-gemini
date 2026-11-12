import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

const {
  toPublicProductListing,
  toPublicIpListing,
} = await import(
  `data:text/javascript;base64,${Buffer.from(
    read('lib/public-listing-serializers.js'),
  ).toString('base64')}`
);

const internal = {
  tokenizationOperationKey: 'INTERNAL_SENTINEL',
  preparedNftTransaction: 'INTERNAL_SENTINEL',
  creditStatus: 'INTERNAL_SENTINEL',
  creditBalanceAfterCharge: 'INTERNAL_SENTINEL',
  syncLeaseId: 'INTERNAL_SENTINEL',
  designAssets: [{ originalUrl: 'INTERNAL_SENTINEL' }],
  originalPlacementAssets: [{ url: 'INTERNAL_SENTINEL' }],
  costAnalysis: { cost: 'INTERNAL_SENTINEL' },
  licensedRevenueTerms: [{ secret: 'INTERNAL_SENTINEL' }],
  revenuePool: { secret: 'INTERNAL_SENTINEL' },
  baseProduct: { variants: [{ cost: 'INTERNAL_SENTINEL' }] },
  variants: [{ pricingSnapshot: { cost: 'INTERNAL_SENTINEL' } }],
};

test('product and IP listings omit seeded internal fields', () => {
  for (const serialize of [toPublicProductListing, toPublicIpListing]) {
    const result = serialize({ ...internal, id: 'public-1', name: 'Public' });
    assert.equal(JSON.stringify(result).includes('INTERNAL_SENTINEL'), false);
    for (const field of Object.keys(internal)) {
      assert.equal(Object.hasOwn(result, field), false, field);
    }
    assert.equal(result.id, 'public-1');
    assert.equal(result.name, 'Public');
  }
});

test('token/auth assetType semantics are preserved unchanged', () => {
  for (const assetType of ['token', 'auth']) {
    const result = toPublicIpListing({
      assetType,
      imageUrl: 'https://example.test/preview.png',
    });
    assert.equal(result.assetType, assetType);
    assert.equal(Object.hasOwn(result, 'mediaType'), false);
  }
});

test('preview does not create assetType or media classification', () => {
  const result = toPublicIpListing({
    imageUrl: 'https://example.test/preview.png',
  });
  assert.equal(Object.hasOwn(result, 'assetType'), false);
  assert.equal(Object.hasOwn(result, 'mediaType'), false);
  assert.equal(result.imageUrl, 'https://example.test/preview.png');
});

test('unapproved future media fields remain omitted', () => {
  // Synthetic unknown-field fixtures, not a proposed model schema.
  const result = toPublicIpListing({
    assetType: 'token',
    mediaType: 'UNAPPROVED',
    modelUrl: 'UNAPPROVED',
    stlUrl: 'UNAPPROVED',
    modelFiles: [{ url: 'UNAPPROVED' }],
    downloadFiles: [{ url: 'UNAPPROVED' }],
    imageUrl: 'https://example.test/preview.png',
  });
  assert.equal(JSON.stringify(result).includes('UNAPPROVED'), false);
  assert.equal(result.assetType, 'token');
});

test('nested previews and list fields use explicit safe selection', () => {
  const result = toPublicProductListing({
    images: [{
      secure_url: 'https://example.test/image.png',
      url: 'https://example.test/fallback.png',
      privateMetadata: 'INTERNAL_SENTINEL',
    }],
    mockupImages: ['https://example.test/mockup.png'],
    categories: ['Shirts', { internal: 'INTERNAL_SENTINEL' }],
  });
  assert.deepEqual(result.images, [{
    secure_url: 'https://example.test/image.png',
    url: 'https://example.test/fallback.png',
  }]);
  assert.deepEqual(result.categories, ['Shirts']);
  assert.equal(JSON.stringify(result).includes('INTERNAL_SENTINEL'), false);
});

test('public and Mongo IDs plus creator attribution survive', () => {
  const result = toPublicIpListing({
    _id: { toHexString: () => 'mongo-id' },
    ownerId: 'owner-1',
    ownerUsername: 'alice',
    ownerName: 'Alice',
    ownerAvatar: 'https://example.test/avatar.png',
  });
  assert.equal(result.id, 'mongo-id');
  assert.equal(result._id, 'mongo-id');
  assert.equal(result.ownerId, 'owner-1');
  assert.equal(result.ownerUsername, 'alice');
  assert.equal(result.ownerName, 'Alice');
  assert.equal(result.ownerAvatar, 'https://example.test/avatar.png');
  assert.equal(toPublicProductListing({
    id: 'app-id', _id: 'mongo-id',
  }).id, 'app-id');
});

test('product card title, description, image and price fallbacks survive', () => {
  const result = toPublicProductListing({
    id: 'product-1',
    productName: 'Legacy shirt',
    excerpt: 'Legacy description',
    mockupUrl: 'https://example.test/shirt.png',
    basePrice: 22,
    priceCents: 2100,
  });
  assert.equal(result.productName, 'Legacy shirt');
  assert.equal(result.excerpt, 'Legacy description');
  assert.equal(result.mockupUrl, 'https://example.test/shirt.png');
  assert.equal(result.basePrice, 22);
  assert.equal(result.priceCents, 2100);
});

test('IP card name, preview and licensing-price fallbacks survive', () => {
  const result = toPublicIpListing({
    id: 'ip-1',
    assetName: 'Legacy art',
    previewImage: 'https://example.test/art.png',
    licensingFeeCents: 125,
    licenseFeeUsd: 1.5,
    licensable: false,
  });
  assert.equal(result.assetName, 'Legacy art');
  assert.equal(result.previewImage, 'https://example.test/art.png');
  assert.equal(result.licensingFeeCents, 125);
  assert.equal(result.licenseFeeUsd, 1.5);
  assert.equal(result.licensable, false);
});

test('extended JSON prices normalize without copying nested extras', () => {
  const result = toPublicProductListing({
    price: { $numberDecimal: '24.50', secret: 'INTERNAL_SENTINEL' },
  });
  assert.equal(result.price, '24.50');
  assert.equal(JSON.stringify(result).includes('INTERNAL_SENTINEL'), false);
});

test('serializers do not mutate inputs or share nested preview objects', () => {
  const document = {
    id: 'product-1',
    images: [{ url: 'https://example.test/image.png', internal: true }],
    categories: ['Shirts'],
  };
  const before = JSON.stringify(document);
  const result = toPublicProductListing(document);
  result.images[0].url = 'changed';
  result.categories.push('Other');
  assert.equal(JSON.stringify(document), before);
});

test('public listing routes use serializers and retain eligibility', () => {
  const aisle = read('app/api/aisle/[username]/route.js');
  assert.match(aisle, /products\.map\(toPublicProductListing\)/);
  assert.match(aisle, /ipAssets\.map\(toPublicIpListing\)/);
  assert.match(aisle, /productOwnerQuery,\s*publicProductEligibility\(\)/);
  assert.match(aisle, /ipOwnerQuery,\s*publicIpEligibility\(\)/);
  assert.doesNotMatch(aisle, /function toPublicDocument/);

  const showroom = read('app/api/showroom/route.js');
  assert.match(showroom, /toPublicProductListing\(normalizeProductImageFields\(p\)\)/);
  assert.match(showroom, /toPublicIpListing\(i\)/);
  assert.match(showroom, /\.find\(showroomProductEligibility\(\)\)/);
  assert.match(showroom, /\.find\(publicIpEligibility\(\)\)/);

  const products = read('app/api/showroom/products/route.js');
  assert.equal(
    (products.match(/products: products\.map\(toPublicProductListing\)/g) || []).length,
    2,
  );
  assert.equal(
    (products.match(/\.\.\.showroomProductEligibility\(\)/g) || []).length,
    2,
  );
});

test('owner inventory and detail routes do not use listing serializers', () => {
  for (const path of [
    'app/api/products/route.js',
    'app/api/metawork/products/route.js',
    'app/api/products/[id]/route.js',
    'app/api/metawork/products/[id]/route.js',
    'app/api/ip/[id]/route.js',
    'app/api/ip/my-library/route.js',
  ]) {
    assert.doesNotMatch(read(path), /public-listing-serializers/, path);
  }
});
