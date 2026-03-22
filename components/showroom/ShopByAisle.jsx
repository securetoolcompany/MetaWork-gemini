'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

const ITEMS_PER_PAGE = 12;

const AISLE_FILTER_GROUPS = [
  {
    id: 'audience',
    title: 'Audience / Theme',
    icon: '👥',
    options: [
      'Kids & Family',
      'Sports & Combat Sports',
      'Music & Entertainment',
      'Esports & Gaming',
      'Nature & Wildlife',
      'Sci‑Fi & Fantasy',
      'Spiritual & Mythology',
      'Corporate & Professional',
    ],
  },
  {
    id: 'style',
    title: 'Art Style',
    icon: '🎨',
    options: [
      'Anime & Manga',
      'Graffiti & Street Art',
      'Comic / Graphic Novel',
      'Minimalist',
      'Abstract & Geometric',
      'Retro & Vintage',
      'Cyberpunk & Futuristic',
      'Realistic',
      'Cartoon & Kawaii',
      'Surreal & Dreamlike',
      'Pop Art',
      'Typography & Lettering',
      'Photography',
    ],
  },
  {
    id: 'medium',
    title: 'Medium / Technique',
    icon: '🧪',
    options: [
      'Digital Illustration',
      'Vector Art',
      'Pixel Art',
      '3D / CGI',
      'Watercolor',
      'Ink & Line Art',
      'Acrylic / Oil Painting',
      'Mixed Media / Collage',
      'Pencil / Sketch',
      'Printmaking / Screenprint',
      'Photography',
    ],
  },
  {
    id: 'useCase',
    title: 'Use Case / Service',
    icon: '🧩',
    options: [
      'Logo & Brand Assets',
      'Mascots & Characters',
      'Twitch & Stream Overlays',
      'Social Media Content Packs',
      'Merch‑Ready Designs',
      'Commission Slots',
      'Corporate Illustration',
      'Album & Cover Art',
      'Book & Editorial Illustration',
      'Icons & UI Assets',
      'Backgrounds & Environments',
      'Photography Packs',
    ],
  },
];

export default function ShopByAisle({
  items,
  filters,
  onToggleFilter,
  onClearAll,
}) {
  const [page, setPage] = useState(1);
  const [expandedGroups, setExpandedGroups] = useState({
    audience: false,
    style: false,
    medium: false,
    useCase: false,
  });

  const hasActiveFilters =
    filters.audience.length ||
    filters.style.length ||
    filters.medium.length ||
    filters.useCase.length;

  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return items.slice(start, end);
  }, [items, currentPage]);

  const toggleGroup = (id) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex gap-6 relative">
      {/* SIDEBAR */}
      <aside className="w-64 flex-shrink-0 sticky top-24 self-start max-h-[calc(100vh-12rem)] overflow-y-auto pb-20">
        <div className="space-y-6 pr-2">
          {/* Active filters summary */}
          <div className="bg-[#1e293b] rounded-lg p-4 border border-white/10">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Active Filters
            </div>
            {!hasActiveFilters ? (
              <p className="text-xs text-gray-500">No filters applied</p>
            ) : (
              <>
                {['audience', 'style', 'medium', 'useCase'].map((groupId) => {
                  const values = filters[groupId];
                  if (!values?.length) return null;
                  const labelMap = {
                    audience: 'Audience',
                    style: 'Style',
                    medium: 'Medium',
                    useCase: 'Use Case',
                  };
                  return (
                    <div key={groupId} className="mb-2">
                      <div className="text-[10px] text-gray-500 mb-1">
                        {labelMap[groupId]} ({values.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {values.map((val) => (
                          <span
                            key={`${groupId}-${val}`}
                            className="px-2 py-0.5 bg-white/10 rounded text-[10px] flex items-center gap-1"
                          >
                            {val}
                            <button
                              onClick={() => onToggleFilter(groupId, val)}
                              className="text-gray-400 hover:text-white ml-1"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={onClearAll}
                  className="w-full mt-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs font-medium transition-colors"
                >
                  Clear All
                </button>
              </>
            )}
          </div>

          {/* Filter groups */}
          {AISLE_FILTER_GROUPS.map((group) => (
            <div
              key={group.id}
              className="bg-[#0f172a] rounded-lg border border-white/10 overflow-hidden"
            >
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{group.icon}</span>
                  <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                    {group.title}
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedGroups[group.id] ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {expandedGroups[group.id] && (
                <div className="px-2 pb-2 space-y-1">
                  {group.options.map((opt) => {
                    const isActive = filters[group.id].includes(opt);
                    return (
                      <button
                        key={opt}
                        onClick={() => onToggleFilter(group.id, opt)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                          isActive
                            ? 'bg-white text-black font-semibold'
                            : 'hover:bg-white/5 text-gray-300'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 min-w-0">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Browse Aisles</h2>
            <p className="text-gray-400 mt-1">
              Explore curated collections by audience, style, medium, and use case
            </p>
          </div>
          <div className="bg-[#1e293b] px-3 py-1 rounded-md text-[10px] font-bold text-gray-400 border border-white/5">
            {items.length} aisles
          </div>
        </div>

        {items.length === 0 && hasActiveFilters ? (
          <div className="h-[calc(100vh-20rem)] flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-4xl">🔍</div>
              <h3 className="text-xl font-semibold">No aisles match your filters</h3>
              <p className="text-gray-400">
                Try removing some filters or selecting different options
              </p>
              <button
                onClick={onClearAll}
                className="mt-4 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm font-semibold transition-all"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        ) : (
          <div className="pb-24">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {pageItems.map((aisle) => (
                <Link
                  key={aisle.id || aisle._id}
                  href={`/showroom/aisle/${aisle.slug || aisle.id}`}
                  className="bg-[#111] rounded-2xl overflow-hidden border border-white/5 flex flex-col h-full hover:border-emerald-500/30 transition-all cursor-pointer block"
                >
                  <div className="relative w-full pt-[56.25%] overflow-hidden">
                    <img
                      src={aisle.imageUrl}
                      alt={aisle.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.opacity = '0';
                      }}
                    />
                  </div>
                  <div className="p-4 flex flex-col gap-2 flex-1">
                    <h3 className="text-sm font-semibold line-clamp-2">
                      {aisle.name}
                    </h3>
                    <p className="text-xs text-gray-400 line-clamp-2">
                      {aisle.description || 'Curated artwork collection'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      {totalPages > 1 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#020617] border-t border-white/10 py-4 z-20">
          <div className="container mx-auto px-6 ml-64 flex items-center justify-between gap-4 text-xs">
            <span className="text-gray-400">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}
              {'–'}
              {Math.min(currentPage * ITEMS_PER_PAGE, items.length)} of {items.length}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded-md border text-[11px] font-semibold transition-all ${
                  currentPage === 1
                    ? 'border-white/10 text-gray-500 cursor-not-allowed'
                    : 'border-white/20 text-gray-200 hover:border-white hover:bg-white/5'
                }`}
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => {
                  const pageNumber = i + 1;
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                      className={`h-7 min-w-[1.75rem] px-2 rounded-md text-[11px] font-semibold transition-all ${
                        pageNumber === currentPage
                          ? 'bg-white text-black'
                          : 'text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded-md border text-[11px] font-semibold transition-all ${
                  currentPage === totalPages
                    ? 'border-white/10 text-gray-500 cursor-not-allowed'
                    : 'border-white/20 text-gray-200 hover:border-white hover:bg-white/5'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
