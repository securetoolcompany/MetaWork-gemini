'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ImageIcon, Eye, Sparkles } from 'lucide-react';

function getImageUrl(ip) {
  return (
    ip?.imageUrl ||
    ip?.image ||
    ip?.thumbnailUrl ||
    ip?.thumbnail ||
    ip?.previewUrl ||
    ip?.previewImage ||
    ip?.mockupUrl ||
    ip?.coverImage ||
    ''
  );
}

function getTitle(ip) {
  return ip?.name || ip?.title || ip?.assetName || 'Untitled IP Asset';
}

function getDescription(ip) {
  return (
    ip?.description ||
    ip?.shortDescription ||
    ip?.summary ||
    'View this intellectual-property asset.'
  );
}

function getPrice(ip) {
  const rawPrice =
    ip?.licensingFee ??
    ip?.licensingFeeCents ??
    ip?.price ??
    ip?.priceCents ??
    ip?.licensePrice ??
    0;

  const numericPrice = Number(rawPrice) || 0;

  // Fields ending in "Cents" are stored in cents.
  if (
    ip?.licensingFeeCents !== undefined ||
    ip?.priceCents !== undefined
  ) {
    return numericPrice / 100;
  }

  return numericPrice;
}

export default function AisleIPAssetCard({ item, ipAsset, accentColor = '#8b5cf6' }) {
  const router = useRouter();
  const ip = ipAsset || item;

  if (!ip) {
    return null;
  }

  const id = String(ip.id || ip._id || '');
  const title = getTitle(ip);
  const description = getDescription(ip);
  const imageUrl = getImageUrl(ip);
  const price = getPrice(ip);

  const openIpDetails = () => {
    if (!id) {
      console.error('[AisleIPAssetCard] Cannot open IP detail: missing IP ID', ip);
      return;
    }

    // This route uses the established IP detail UI / IPConsumerDialog flow.
    router.push(`/ip/${encodeURIComponent(id)}`);
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-lg transition hover:-translate-y-1 hover:border-white/20">
      <button
        type="button"
        onClick={openIpDetails}
        className="group relative block aspect-square w-full overflow-hidden bg-zinc-900 text-left"
        aria-label={`View details for ${title}`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-500">
            <ImageIcon className="h-10 w-10" />
            <span className="text-sm">No preview available</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />

        <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
          <Eye className="h-3.5 w-3.5" />
          View IP
        </div>
      </button>

      <div className="space-y-3 p-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-violet-400">
            <Sparkles className="h-3.5 w-3.5" />
            IP Asset
          </div>

          <h3 className="line-clamp-2 text-sm font-bold text-white">
            {title}
          </h3>

          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-400">
            {description}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold" style={{ color: accentColor }}>
            {price > 0 ? `$${price.toFixed(2)}` : '$0.00'}
          </span>

          <Button
            type="button"
            size="sm"
            onClick={openIpDetails}
            className="shrink-0 text-white"
            style={{ backgroundColor: accentColor }}
          >
            View IP
          </Button>
        </div>
      </div>
    </article>
  );
}