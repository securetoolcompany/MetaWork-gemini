// lib/ipCategories.js
// Single source of truth for IP asset categories — used in mint dialog and IPEditDialog

export const IP_CATEGORY_GROUPS = [
  {
    id: 'assetType',
    emoji: '📦',
    label: 'Asset Type',
    options: [
      'Illustration',
      'Logo & Icon',
      'Pattern & Texture',
      'Typography',
      '3D Model',
      'Photography',
    ],
  },
  {
    id: 'visualStyle',
    emoji: '✨',
    label: 'Visual Style',
    options: [
      'Anime & Manga',
      'Cyberpunk',
      'Minimalist',
      'Vintage & Retro',
      'Street Art',
      'Realistic',
      'Cartoon',
    ],
  },
  {
    id: 'bestFor',
    emoji: '🎯',
    label: 'Best For',
    options: [
      'Merch Designs',
      'Social Media',
      'Game Assets',
      'Apparel Print',
      'Brand Identity',
    ],
  },
  {
    id: 'theme',
    emoji: '🌌',
    label: 'Theme',
    options: [
      'Esports & Gaming',
      'Nature & Wildlife',
      'Sci-Fi & Fantasy',
      'Spiritual',
      'Corporate',
    ],
  },
];

/**
 * Parse a comma-separated category string into a map keyed by group id.
 * e.g. "Illustration,Cyberpunk,Merch Designs" ->
 *      { assetType: ['Illustration'], visualStyle: ['Cyberpunk'], bestFor: ['Merch Designs'], theme: [] }
 */
export function parseCategoryString(str = '') {
  const selected = str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];
  return Object.fromEntries(
    IP_CATEGORY_GROUPS.map(g => [
      g.id,
      g.options.filter(o => selected.includes(o)),
    ])
  );
}

/**
 * Serialize a map back to comma-separated string.
 */
export function serializeCategoryMap(map = {}) {
  return IP_CATEGORY_GROUPS.flatMap(g => map[g.id] || []).join(',');
}
