import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCT_KINDS, isOfflineProductKind } from '../lib/product-kinds.js';
import { publicProductEligibility, isPubliclyEligible } from '../lib/public-inventory-eligibility.js';

const live = { isPublic: true, status: 'active', isDraft: false, isVisible: true };

test('3d_print is the only offline kind', () => {
  assert.equal(PRODUCT_KINDS.PRINT_3D, '3d_print');
  assert.equal(isOfflineProductKind('3d_print'), true);
  assert.equal(isOfflineProductKind('stl_file'), false);
  assert.equal(isOfflineProductKind(undefined), false);
});

test('public query excludes offline kinds', () => {
  assert.deepEqual(publicProductEligibility().productKind, { $nin: ['3d_print'] });
});

test('a public, active 3d_print is still not eligible', () => {
  assert.equal(isPubliclyEligible({ ...live, productKind: '3d_print' }), false);
});

test('existing products and unlisted stl_file behave as before', () => {
  assert.equal(isPubliclyEligible({ ...live }), true);
  assert.equal(isPubliclyEligible({ ...live, productKind: 'stl_file' }), true);
  assert.equal(isPubliclyEligible({ ...live, productKind: 'stl_file', isPublic: false }), false);
  assert.equal(isPubliclyEligible({ ...live, isVisible: false }), false);
});
