import { OFFLINE_PRODUCT_KINDS, isOfflineProductKind } from './product-kinds.js';

/**
 * Public inventory eligibility.
 * Owner matching and authenticated owner access remain separate.
 * Offline product kinds (for example 3d_print) are never public.
 */
export function publicProductEligibility() {
  return {
    isPublic: true,
    status: { $in: ['live', 'active'] },
    isDraft: { $ne: true },
    isVisible: { $ne: false },
    productKind: { $nin: [...OFFLINE_PRODUCT_KINDS] },
  };
}

export function isPubliclyEligible(product) {
  return (
    product?.isPublic === true &&
    ['live', 'active'].includes(product.status) &&
    product.isDraft !== true &&
    product.isVisible !== false &&
    !isOfflineProductKind(product.productKind)
  );
}

export function showroomProductEligibility() {
  return {
    ...publicProductEligibility(),
    showroomListed: { $ne: false },
  };
}

export function publicIpEligibility() {
  return {
    isPublic: true,
    status: 'active',
  };
}
