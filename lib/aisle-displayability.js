const hasValue = (v) =>
  typeof v === 'string' ? v.trim().length > 0 : Boolean(v?.secure_url || v?.url);

export function getAisleDisplayState(creator, products = [], ipAssets = [], collections = []) {
  const s = creator.aisleSettings || {};
  const productIds = new Set(products.map((p) => String(p._id || p.id)));
  const ipIds = new Set(ipAssets.map((a) => String(a._id || a.id)));

  const inSection = (s.aisleSections || []).some((sec) =>
    (sec.items || []).some((it) => {
      const id = String(it?.id || '');
      if (!id) return false;
      return it.itemType === 'ip' ? ipIds.has(id) : productIds.has(id);
    }),
  );

  const fid = String(s.featuredItemId || '');
  const featured =
    Boolean(s.featuredItemEnabled && fid) &&
    ((['products', 'community'].includes(s.featuredItemType) && productIds.has(fid)) ||
      (s.featuredItemType === 'ip' && ipIds.has(fid)) ||
      (s.featuredItemType === 'collections' &&
        collections.some((c) => String(c.id || c._id) === fid)));

  const hasLogo = hasValue(s.logo) || hasValue(creator.avatar);
  const hasBanner = hasValue(s.heroImage) || hasValue(creator.banner);
  const hasDisplayableItems = inSection || featured;

  return { hasDisplayableItems, hasLogo, hasBanner, ok: hasDisplayableItems && hasLogo && hasBanner };
}
