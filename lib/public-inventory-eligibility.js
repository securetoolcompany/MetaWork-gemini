/**
 * Public inventory eligibility.
 * Owner matching and authenticated owner access remain separate.
 */
export function publicProductEligibility() {
  return {
    isPublic: true,
    status: { $in: ['live', 'active'] },
    isDraft: { $ne: true },
    isVisible: { $ne: false },
  };
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
