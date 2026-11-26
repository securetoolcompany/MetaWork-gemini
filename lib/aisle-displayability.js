const hasValue = (v) =>
  typeof v === 'string' ? v.trim().length > 0 : Boolean(v?.secure_url || v?.url);

export function getAisleDisplayState(creator, products = [], ipAssets = [], collections = []) {
  const s = creator.aisleSettings || {};
  const productIds = new Set(products.map((p) => String(p._id || p.id)));
  const ipIds = new Set(ipAssets.map((a) => String(a._id || a.id)));
  const placedProductIds = new Set();
  const placedIpIds = new Set();

  (s.aisleSections || []).forEach((sec) =>
    (sec.items || []).forEach((it) => {
      const id = String(it?.id || '');
      if (!id) return;
      if (it.itemType === 'ip') {
        if (ipIds.has(id)) placedIpIds.add(id);
      } else if (productIds.has(id)) {
        placedProductIds.add(id);
      }
    }),
  );

  const fid = String(s.featuredItemId || '');
  let featuredCollection = false;
  if (s.featuredItemEnabled && fid) {
    if (['products', 'community'].includes(s.featuredItemType) && productIds.has(fid)) {
      placedProductIds.add(fid);
    } else if (s.featuredItemType === 'ip' && ipIds.has(fid)) {
      placedIpIds.add(fid);
    } else if (
      s.featuredItemType === 'collections' &&
      collections.some((c) => String(c.id || c._id) === fid)
    ) {
      featuredCollection = true;
    }
  }

  const hasLogo = hasValue(s.logo) || hasValue(creator.avatar);
  const hasBanner = hasValue(s.heroImage) || hasValue(creator.banner);
  const hasDisplayableItems =
    placedProductIds.size > 0 || placedIpIds.size > 0 || featuredCollection;

  return {
    hasDisplayableItems,
    hasLogo,
    hasBanner,
    placedProductIds,
    placedIpIds,
    ok: hasDisplayableItems && hasLogo && hasBanner,
  };
}
