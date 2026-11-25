export const PRODUCT_KINDS = Object.freeze({
  STL_FILE: 'stl_file',
  PRINT_3D: '3d_print',
});

export const OFFLINE_PRODUCT_KINDS = Object.freeze([PRODUCT_KINDS.PRINT_3D]);

export const isOfflineProductKind = kind => OFFLINE_PRODUCT_KINDS.includes(kind);

export const OFFLINE_PROTECTED_FIELDS = Object.freeze([
  'isPublic', 'status', 'isVisible', 'isDraft', 'showroomListed',
]);
