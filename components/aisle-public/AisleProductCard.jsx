'use client';

import Link from 'next/link';

function getId(product) {
  return String(product?.id || product?._id || '');
}

function getImageUrl(product) {
  return (
    product?.mockupUrl ||
    product?.thumbnailUrl ||
    product?.imageUrl ||
    product?.image ||
    product?.images?.[0] ||
    product?.mockupImages?.[0] ||
    '/placeholder-image.png'
  );
}

function getTitle(product) {
  return (
    product?.name ||
    product?.title ||
    product?.productName ||
    'Untitled Product'
  );
}

function getDescription(product) {
  return (
    product?.description ||
    product?.shortDescription ||
    product?.summary ||
    product?.excerpt ||
    ''
  );
}

function getPrice(product) {
  const cents = product?.priceCents;

  if (cents !== undefined && cents !== null && cents !== '') {
    return (Number(cents) || 0) / 100;
  }

  return (
    Number(
      product?.price ??
        product?.salePrice ??
        product?.retailPrice ??
        product?.basePrice ??
        0,
    ) || 0
  );
}

export default function AisleProductCard({
  product,
  item,
  accentColor = '#10b981',
}) {
  const content = product || item;

  if (!content) {
    return null;
  }

  const id = getId(content);

  if (!id) {
    return null;
  }

  const imageUrl = getImageUrl(content);
  const title = getTitle(content);
  const description = getDescription(content);
  const price = getPrice(content);

  return (
    <Link
      href={`/products/${encodeURIComponent(id)}`}
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-lg transition hover:-translate-y-1 hover:border-white/20"
      aria-label={`View product: ${title}`}
    >
      <div className="relative aspect-square overflow-hidden bg-zinc-900">
        <img
          src={imageUrl}
          alt={title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-sm font-bold text-white">
            {title}
          </h3>

          {description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-400">
              {description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span
            className="text-sm font-bold"
            style={{ color: accentColor }}
          >
            ${price.toFixed(2)}
          </span>

          <div
            className="rounded-md px-3 py-2 text-center text-[15px] font-bold text-white shadow-md transition-opacity group-hover:opacity-90"
            style={{ backgroundColor: accentColor }}
          >
            View Product
          </div>
        </div>
      </div>
    </Link>
  );
}