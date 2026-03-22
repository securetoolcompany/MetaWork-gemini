'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';

const ITEMS_PER_PAGE = 12; // 4 cols x 3 rows

export default function ShopByIP({ 
  items,
  categories = [],
  availableCategories = [],
  availableTags = [],
  activeCategories = [],
  activeTags = [],
  onCategoryToggle = (category) => {},
  onClearCategories = () => {},
  onTagToggle = (tag) => {},
  onClearTags = () => {}
}) {

  const [tagQuery, setTagQuery] = useState('');

  const [page, setPage] = useState(1);
  const gridRef = useRef(null);

  const visibleItems = useMemo(
    () => (items?.filter((asset) => asset.isPublic !== false) || []),
    [items]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(visibleItems.length / ITEMS_PER_PAGE)
  );

  // Clamp page if filters change and current page is now out of range
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return visibleItems.slice(start, end);
  }, [visibleItems, currentPage]);

  useEffect(() => {
    if (!gridRef.current) return;
    gridRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }, [page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [activeCategories, activeTags]);

  // Get category label from value
  const getCategoryLabel = (value) => {
    const category = categories.find(c => c.value === value);
    return category ? `${category.icon} ${category.label}` : value;
  };

  const hasActiveFilters = activeCategories.length > 0 || activeTags.length > 0;

  if (!visibleItems.length && !hasActiveFilters) {
    return (
      <div className="text-sm text-gray-400 text-center py-20">
        No IP assets currently available.
      </div>
    );
  }


      return (
    <div className="flex gap-6 relative" ref={gridRef}>
      {/* SIDEBAR - Sticky Filters */}
      <aside className="w-64 flex-shrink-0 sticky top-24 self-start max-h-[calc(100vh-12rem)] overflow-y-auto pb-20">
        <div className="space-y-6 pr-2">
          {/* Active Filters Summary */}
          <div className="bg-[#1e293b] rounded-lg p-4 border border-white/10">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Active Filters
            </div>
            {!hasActiveFilters ? (
              <p className="text-xs text-gray-500">No filters applied</p>
            ) : (
              <div className="space-y-2">
                {activeCategories.length > 0 && (
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1">
                      Categories ({activeCategories.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {activeCategories.map(cat => {
                        const category = categories.find(c => c.value === cat);
                        return (
                          <span key={cat} className="px-2 py-0.5 bg-white/10 rounded text-[10px] flex items-center gap-1">
                            {category?.icon} {category?.label || cat}
                            <button
                              onClick={() => onCategoryToggle(cat)}
                              className="text-gray-400 hover:text-white ml-1"
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {activeTags.length > 0 && (
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1">
                      Tags ({activeTags.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {activeTags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-emerald-500/20 rounded text-[10px] flex items-center gap-1">
                          #{tag}
                          <button
                            onClick={() => onTagToggle(tag)}
                            className="text-gray-400 hover:text-white ml-1"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => {
                    onClearCategories();
                    onClearTags();
                  }}
                  className="w-full mt-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs font-medium transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* Category Filters */}
          {categories.length > 0 && (
            <div className="bg-[#0f172a] rounded-lg p-4 border border-white/10">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Categories
              </div>
              <div className="space-y-1">
                {categories
                  .filter(cat => availableCategories.includes(cat.value))
                  .map((cat) => {
                    const isActive = activeCategories.includes(cat.value);
                    return (
                      <button
                        key={cat.value}
                        onClick={() => onCategoryToggle(cat.value)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                          isActive
                            ? 'bg-white text-black font-semibold'
                            : 'hover:bg-white/5 text-gray-300'
                        }`}
                      >
                        <span className="mr-2">{cat.icon}</span>
                        {cat.label}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

                    {/* Tag search with autocomplete dropdown */}
          {availableTags.length > 0 && (
            <div className="bg-[#0f172a] rounded-lg p-2 border border-white/10 relative">
              <input
                type="text"
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                placeholder="Search tags…"
                className="w-full px-3 py-2 rounded-md bg-[#020617] border border-white/10 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />

              {/* Dropdown suggestions */}
              {tagQuery.trim().length > 0 && (
                <div className="absolute left-2 right-2 mt-1 max-h-56 overflow-y-auto rounded-md bg-[#020617] border border-white/10 shadow-xl z-30">
                  {availableTags
                    .filter((tag) =>
                      tag
                        .toLowerCase()
                        .includes(tagQuery.toLowerCase().trim())
                    )
                    .slice(0, 8)
                    .map((tag) => {
                      const isActive = activeTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            onTagToggle(tag);
                            setTagQuery(''); // collapse after selection
                          }}
                          className={`w-full text-left px-3 py-2 text-xs transition-all ${
                            isActive
                              ? 'bg-emerald-500 text-white font-semibold'
                              : 'text-gray-200 hover:bg-white/5'
                          }`}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 min-w-0">
        {/* Header with count */}
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Browse IP Assets</h2>
            <p className="text-gray-400 mt-1">
              License digital artwork from our creator community
            </p>
          </div>
          <div className="bg-[#1e293b] px-3 py-1 rounded-md text-[10px] font-bold text-gray-400 border border-white/5">
            {visibleItems.length} assets
          </div>
        </div>

        {/* No results message */}
        {visibleItems.length === 0 && hasActiveFilters ? (
          <div className="h-[calc(100vh-20rem)] flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-4xl">🔍</div>
              <h3 className="text-xl font-semibold">No IP assets match your filters</h3>
              <p className="text-gray-400">
                Try removing some filters or selecting different categories/tags
              </p>
              <button
                onClick={() => {
                  onClearCategories();
                  onClearTags();
                }}
                className="mt-4 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm font-semibold transition-all"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        ) : (
          /* Grid with padding for fixed pagination */
          <div className="pb-24">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {pageItems.map((asset) => {
                const assetId = asset._id || asset.id;
                
                return (
                  <Link 
                    key={assetId}
                    href={`/showroom/ip/${assetId}`}
                    className="bg-[#111] rounded-2xl overflow-hidden border border-white/5 flex flex-col h-full hover:border-emerald-500/30 transition-all cursor-pointer block"
                  >
                    {/* Image */}
                    <div className="relative w-full pt-[100%] overflow-hidden">
                      <img
                        src={asset.imageUrl}
                        alt={asset.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.opacity = '0';
                        }}
                      />
                      {asset.licensingTerms && (
                        <div className="absolute top-3 right-3 bg-black/60 px-2 py-1 rounded text-xs uppercase tracking-widest text-emerald-400">
                          {asset.licensingTerms}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4 flex flex-col gap-2 flex-1">
                      <h3 className="text-sm font-semibold line-clamp-2">
                        {asset.name || asset.title}
                      </h3>
                      <p className="text-xs text-gray-400 line-clamp-2">
                        {asset.description || 'Digital artwork available for licensing'}
                      </p>

                      <div className="mt-auto flex items-center justify-between text-xs pt-2">
                        <span className="font-bold text-emerald-400">
                          ${asset.licensingFee || '2.50'} / use
                        </span>
                        {asset.category && (
                          <span className="px-2 py-1 rounded-full bg-white/5 text-[10px] uppercase tracking-wide">
                            {typeof asset.category === 'string' 
                              ? asset.category.split(',')[0] 
                              : Array.isArray(asset.category) 
                                ? asset.category[0]
                                : 'IP'}
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-3">
                        <div className="w-full text-[18px] font-bold py-2 rounded-md bg-emerald-500 text-white text-center">
                          View Details
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* PAGINATION - FIXED AT BOTTOM OF VIEWPORT */}
      {totalPages > 1 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#020617] border-t border-white/10 py-4 z-20">

                    <div className="container mx-auto px-6 ml-64 flex items-center justify-between gap-4 text-xs">

            <span className="text-gray-400">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}
              {'–'}
              {Math.min(currentPage * ITEMS_PER_PAGE, visibleItems.length)} of{' '}
              {visibleItems.length}
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
                onClick={() =>
                  setPage((p) => Math.min(totalPages, p + 1))
                }
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
