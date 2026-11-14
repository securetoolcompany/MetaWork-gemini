// Returns shared browse subcategory IDs without modifying the product.
// Existing printfulCategories are intentionally not used: legacy tags
// contain incorrect classifications.
// Unmatched products return [] for explicit review.

/** @type {Array<[string, RegExp]>} */
const RULES = [

  // Additional product families identified by the catalog audit.
  ['outerwear', /\b(jackets?|windbreakers?|anoraks?)\b/],
  ['sweaters-knitwear', /\b(sweaters?|cardigans?|knitted.*vests?)\b/],
  ['underwear', /\b(boxer briefs?|underwear|bras?)\b/],
  ['sleepwear', /\b(pajamas?|pyjamas?|sleepwear)\b/],
  ['socks', /\bsocks?\b/],
  ['travel-accessories', /\bluggage tags?\b/],
  ['pins-buttons', /\b(pin buttons?|button pins?|enamel pins?)\b/],
  ['gift-wrap-packaging', /\b(gift wrap|wrapping papers?|gift bags?)\b/],
  ['glassware', /\b(?:can shaped|rocks|pint|wine|drinking) glass(?:es)?\b/],
  ['metal-prints', /\bmetal prints?\b/],
  ['tapestries', /\btapestr(?:y|ies)\b/],
  ['sports-equipment', /\b(yoga mats?|pickleball paddles?)\b/],
  ['games-puzzles-toys', /\b(puzzles?|playing cards?|teddy bears?)\b/],
  ['car-accessories', /\b(license plate frames?|vanity plates?|car magnets?)\b/],

  ['t-shirts-tops', /\b(t[- ]?shirts?|tees?|tank(?:s| tops?)?|polo(?: shirts?)?|button shirts?|long sleeve shirts?|raglan shirts?|muscle shirts?|crop tops?|jerseys?)\b/],
  ['hoodies-sweatshirts', /\b(hoodies?|hooded sweatshirts?|sweatshirts?|fleece pullovers?|quarter zip pullovers?|half zip pullovers?)\b/],
  ['pants-shorts', /\b(pants?|shorts?|joggers?|sweatpants?|leggings?)\b/],
  ['dresses-skirts', /\b(dress(?:es)?|skirts?)\b/],
  ['activewear', /\b(leggings?|sports bras?|rash guards?|athletic|sports jerseys?|basketball jerseys?|football jerseys?|hockey.*jerseys?|track pants?|track jackets?|performance.*(?:shirts?|tees?)|yoga shorts?)\b/],
  ['swimwear', /\b(swimsuits?|swimwear|bikinis?|swim trunks?|board shorts?)\b/],
  ['kids-baby', /\b(kids?|youth|toddler|infant|baby (?:short sleeve|jersey|staple|bodysuit)|bodysuits?)\b/],

  ['hats-headwear', /\b(hats?|caps?|beanies?|snapbacks?|visors?|headbands?|scrunchies?|neck gaiters?|bandanas?)\b/],
  ['tote-bags', /\btote(?: bags?)?\b/],
  ['backpacks', /\bbackpacks?\b/],
  ['other-bags', /\b(bags?|fanny packs?|suitcases?)\b/],
  ['phone-tech-cases', /\b(airpods?|iphone|samsung|phone cases?|laptop sleeves?)\b/],
  ['footwear', /\b(shoes?|slides?|slippers?|flip flops?)\b/],
  ['patches', /\bpatch(?:es)?\b/],

  ['kitchen-dining', /\b(aprons?|coasters?|cutting boards?|napkins?|placemats?|table runners?|tablecloths?|mugs?|tumblers?|water bottles?|pint glass(?:es)?|rocks glass(?:es)?|wine glass(?:es)?|can shaped glass(?:es)?|can coolers?)\b/],
  ['bedroom', /\b(pillows?|pillowcases?|pillow cases?|blankets?|comforters?|duvet covers?)\b/],
  ['bathroom', /\b(towels?|bath mats?|shower curtains?|hand.*body (?:wash|lotion))\b/],
  ['living-room-decor', /\b(pillows?|pillowcases?|pillow cases?|blankets?|candles?|ornaments?|rugs?|wall clocks?|tapestr(?:y|ies)|tree skirts?|christmas stockings?)\b/],

  ['mugs', /\bmugs?\b/],
  ['water-bottles', /\b(water bottles?|insulated bottles?)\b/],
  ['tumblers-travel-cups', /\b(tumblers?|travel mugs?)\b/],

  ['posters', /\bposters?\b/],
  ['framed-prints', /\bframed\b/],
  ['canvas-prints', /^(?:(?:framed|thin)\s+)?canvas\b/],
  ['flags', /\b(flags?|pennants?)\b/],

  ['notebooks-stationery', /\b(notebooks?|journals?|notepads?|note pads?|post it|calendars?|business cards?|greeting cards?|postcards?|coloring books?|board books?)\b/],
  ['desk-accessories', /\b(mouse pads?|desk mats?|desktop calendars?|desk calendars?)\b/],
  ['school-bags', /\b(backpacks?|laptop sleeves?)\b/],

  ['stickers', /\b(stickers?|decals?)\b/],
  ['magnets', /\bmagnets?\b/],
];

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[-‐‑–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyBlankProduct(product = {}) {
  // Use the public catalog name before supplier model text.
  const name = normalize(
    product.catalogProductName || product.name || product.type_name
  );

  if (!name) return [];

  // Prevent a pet sweater or teddy bear with a shirt from becoming apparel.
  if (/\bpet\b/.test(name)) {
    return /\b(sweaters?|shirts?|hoodies?)\b/.test(name)
      ? ['pet-apparel']
      : ['pet-accessories'];
  }

  if (/\bteddy bears?\b/.test(name)) {
    return ['games-puzzles-toys'];
  }

  const categories = new Set(
    RULES.filter(([, pattern]) => pattern.test(name))
      .map(([id]) => id)
  );

  // Jersey can describe bodysuit fabric, not a standalone shirt.
  if (/\bbodysuits?\b/.test(name)) {
    categories.delete('t-shirts-tops');
  }

  // Specific types take precedence over ambiguous words.
  if (categories.has('dresses-skirts')) {
    categories.delete('t-shirts-tops');
  }

  if (categories.has('tote-bags') || categories.has('backpacks')) {
    categories.delete('other-bags');
  }

  // Canvas footwear and bags are not canvas prints.
  if (
    categories.has('footwear') ||
    categories.has('tote-bags') ||
    categories.has('other-bags') ||
    categories.has('backpacks')
  ) {
    categories.delete('canvas-prints');
  }

  if (categories.has('canvas-prints')) {
    categories.delete('framed-prints');
  }

  if (categories.has('framed-prints')) {
    categories.delete('posters');
  }

  if (categories.has('tumblers-travel-cups')) {
    categories.delete('mugs');
  }

  return [...categories];
}
