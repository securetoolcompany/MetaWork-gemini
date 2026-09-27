'use client';

import React from 'react';
import AisleProductCard from './AisleProductCard';
import AisleIPAssetCard from './AisleIPAssetCard';
import AisleAdPlacement from './AisleAdPlacement';

const safeId = (item) => String(item?.id || item?._id || '');

function isIpAsset(item, ipAssetsById) {
  const id = safeId(item);

  if (item?.type === 'ip' || item?.type === 'ip_asset') {
    return true;
  }

  if (item?.itemType === 'ip' || item?.itemType === 'ip_asset') {
    return true;
  }

  if (item?.assetType === 'ip' || item?.assetType === 'ip_asset') {
    return true;
  }

  if (item?.contentType === 'ip' || item?.contentType === 'ip_asset') {
    return true;
  }

  if (item?.isIP === true || item?.isIp === true) {
    return true;
  }

  return Boolean(id && ipAssetsById.has(id));
}

export default function AisleCollectionGrid({
  collection,
  products = [],
  ipAssets = [],
  settings = {},
  accentColor = '#8b5cf6',
}) {
  const productMap = new Map(
    products
      .filter(Boolean)
      .map((product) => [safeId(product), product]),
  );

  const ipAssetsById = new Map(
    ipAssets
      .filter(Boolean)
      .map((ipAsset) => [safeId(ipAsset), ipAsset]),
  );

  const rawItems = Array.isArray(collection?.items)
    ? collection.items
    : Array.isArray(collection?.productIds)
      ? collection.productIds
      : Array.isArray(collection?.itemIds)
        ? collection.itemIds
        : [];

  const resolvedItems = rawItems
    .map((rawItem) => {
      const rawId =
        typeof rawItem === 'string' || typeof rawItem === 'number'
          ? String(rawItem)
          : safeId(rawItem);

      const ipAsset = ipAssetsById.get(rawId);
      const product = productMap.get(rawId);

      if (ipAsset) {
        return {
          id: rawId,
          type: 'ip',
          item: ipAsset,
        };
      }

      if (product) {
        return {
          id: rawId,
          type: 'product',
          item: product,
        };
      }

      if (rawItem && typeof rawItem === 'object') {
        return {
          id: rawId,
          type: isIpAsset(rawItem, ipAssetsById) ? 'ip' : 'product',
          item: rawItem,
        };
      }

      return null;
    })
    .filter(Boolean);

  if (resolvedItems.length === 0) {
    return null;
  }

  return (
    <section className="space-y-5">
      {(collection?.title || collection?.name) && (
        <div>
          <h2 className="text-2xl font-bold text-white">
            {collection.title || collection.name}
          </h2>

          {collection.description && (
            <p className="mt-1 text-sm text-zinc-400">
              {collection.description}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {resolvedItems.map(({ id, type, item }, index) => (
          <React.Fragment key={`${type}-${id}-${index}`}>
            {type === 'ip' ? (
              <AisleIPAssetCard
                item={item}
                accentColor={accentColor}
              />
            ) : (
              <AisleProductCard
                product={item}
                accentColor={accentColor}
              />
            )}

            {settings?.showCollectionAds &&
              index > 0 &&
              (index + 1) % 8 === 0 && (
                <AisleAdPlacement
                  type="inline"
                  accentColor={accentColor}
                />
              )}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}