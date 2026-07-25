'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Filter, ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import AisleIPAssetCard from '@/components/aisle-public/AisleIPAssetCard';

const shuffleWithSeed = (array, seed) => {
  let m = array.length, t, i;
  while (m) {
    i = Math.floor(Math.abs(Math.sin(seed++)) * m--);
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }
  return array;
};

const ITEMS_PER_PAGE = 12;

const IP_FILTER_GROUPS = [
  {
    id: 'type',
    title: 'Asset Type',
    icon: '📦',
    options: ['Illustration', 'Logo & Icon', 'Pattern & Texture', 'Typography', '3D Model', 'Photography'],
  },
  {
    id: 'style',
    title: 'Visual Style',
    icon: '✨',
    options: ['Anime & Manga', 'Cyberpunk', 'Minimalist', 'Vintage & Retro', 'Street Art', 'Realistic', 'Cartoon'],
  },
  {
    id: 'usage',
    title: 'Best For',
    icon: '🎯',
    options: ['Merch Designs', 'Social Media', 'Game Assets', 'Apparel Print', 'Brand Identity'],
  },
  {
    id: 'theme',
    title: 'Theme',
    icon: '🌌',
    options: ['Esports & Gaming', 'Nature & Wildlife', 'Sci-Fi & Fantasy', 'Spiritual', 'Corporate'],
  },
];

const normalizeListField = (value) => {
  if (Array.isArray(value)) {
    return value.map(v => String(v).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
  }

  return [];
};

export default function ShopByIP({
  items = [],
  filters = { type: [], style: [], usage: [], theme: [] },
  onToggleFilter,
  onClearAll
}) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({
    type: false,
    style: false,
    usage: false,
    theme: false,
  });

  const isMobile = useIsMobile();
  const gridRef = useRef(null);

  const toggleGroup = (id) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const sessionSeed = useMemo(() => Math.floor(Math.random() * 10000), []);

  const filteredItems = useMemo(() => {
    const validItems = items.filter(item => {
      const rawImage = item.imageUrl || item.thumbnailUrl || item.image || '';
      const lowerImage = String(rawImage).toLowerCase();

      if (lowerImage.includes('null') || lowerImage.includes('undefined')) return false;

      const searchBlob = [
        item.title || '',
        item.name || '',
        item.description || '',
        item.category || '',
        item.tags || ''
      ].join(' ').toLowerCase();

      const matchesSearch =
        !searchQuery || searchBlob.includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const normalizedCategories = [
        ...normalizeListField(item.category),
        ...normalizeListField(item.categories),
      ];

      const normalizedTags = normalizeListField(item.tags);

      const itemValues = [...new Set([...normalizedCategories, ...normalizedTags])];

      const matchesFilters = Object.keys(filters).every(groupId => {
        if (!filters[groupId] || filters[groupId].length === 0) return true;
        return filters[groupId].some(val => itemValues.includes(val));
      });

      return matchesFilters;
    });

    return shuffleWithSeed([...validItems], sessionSeed);
  }, [items, searchQuery, filters, sessionSeed]);

  const hasActiveFilters = Object.values(filters).some(group => group && group.length > 0);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const pageItems = filteredItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [filters, searchQuery]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const FilterContent = () => (
    <div className="space-y-6">
      <div className="bg-slate-900/50 rounded-lg p-4 border border-white/10">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          Filter Status
        </div>
        {!hasActiveFilters ? (
          <p className="text-xs text-slate-500 italic">No filters applied</p>
        ) : (
          <div className="space-y-3">
            {Object.keys(filters).map((groupId) => {
              const activeValues = filters[groupId];
              if (!activeValues?.length) return null;

              return (
                <div key={groupId} className="space-y-1">
                  <div className="text-[9px] font-medium text-slate-500 uppercase">
                    {groupId} ({activeValues.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {activeValues.map((val) => (
                      <span
                        key={`${groupId}-${val}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 rounded text-[10px] text-blue-200 border border-blue-500/20"
                      >
                        {val}
                        <button
                          onClick={() => onToggleFilter(groupId, val)}
                          className="hover:text-white hover:bg-blue-500/30 rounded-full p-0.5 transition-colors ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            <button
              onClick={onClearAll}
              className="w-full py-1.5 mt-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded text-[11px] font-bold uppercase transition-all"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {IP_FILTER_GROUPS.map((group) => (
        <div key={group.id} className="bg-[#0f172a] rounded-lg border border-white/10 overflow-hidden">
          <button
            onClick={() => toggleGroup(group.id)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{group.icon}</span>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-tight">{group.title}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expandedGroups[group.id] ? 'rotate-180' : ''}`} />
          </button>

          {expandedGroups[group.id] && (
            <div className="px-2 pb-2 space-y-1">
              {group.options.map(opt => {
                const isActive = filters[group.id]?.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => onToggleFilter(group.id, opt)}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
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
  );

  return (
    <div className="flex flex-col md:flex-row gap-6 relative px-4 md:px-0" ref={gridRef}>
      {isMobile && (
        <button
          onClick={() => setIsFilterDrawerOpen(true)}
          className="fixed bottom-24 right-6 z-50 flex items-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-full shadow-2xl active:scale-95 transition-transform"
        >
          <Filter className="w-5 h-5" />
          <span className="text-sm font-bold uppercase">
            Filters {hasActiveFilters && `(${Object.values(filters).flat().length})`}
          </span>
        </button>
      )}

      <aside className="hidden md:block w-64 flex-shrink-0 sticky top-24 self-start max-h-[calc(100vh-12rem)] overflow-y-auto pb-20 scrollbar-hide">
        <FilterContent />
      </aside>

      <main className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-white">Browse IP Assets</h2>
            <p className="text-slate-400 text-sm">Discover {filteredItems.length} professional creations.</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white"
            />
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center bg-slate-900/20 rounded-2xl border border-dashed border-white/10">
            <div className="text-4xl mb-4 text-slate-600">📦</div>
            <h3 className="text-lg font-medium text-white">No IP assets found</h3>
            <p className="text-slate-500 text-sm">Try adjusting your search or resetting filters</p>
            {hasActiveFilters && (
              <button
                onClick={onClearAll}
                className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm font-semibold transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="pb-32">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {pageItems.map((item) => (
                <AisleIPAssetCard
                  key={item.id || item._id}
                  item={item}
                  accentColor="#3b82f6"
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {isMobile && isFilterDrawerOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsFilterDrawerOpen(false)}
          />
          <div className="relative w-80 bg-[#020617] h-full shadow-2xl flex flex-col border-l border-white/10 animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-white">IP Filters</h2>
              </div>
              <button
                onClick={() => setIsFilterDrawerOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-32">
              <FilterContent />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#020617] border-t border-white/10">
              <button
                onClick={() => setIsFilterDrawerOpen(false)}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold uppercase text-xs hover:bg-blue-500 transition-colors"
              >
                Show {filteredItems.length} Assets
              </button>
            </div>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#020617] border-t border-white/10 py-4 z-20">
          <div className="container mx-auto px-6 md:ml-64 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <span className="text-gray-400 font-medium">
              Showing {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, filteredItems.length)} of {filteredItems.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-md border border-white/20 text-gray-200 disabled:opacity-30 transition-all hover:bg-white/5 active:scale-95"
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => {
                  const pageNum = i + 1;

                  if (totalPages > 5 && Math.abs(pageNum - page) > 1 && pageNum !== 1 && pageNum !== totalPages) {
                    if (Math.abs(pageNum - page) === 2) {
                      return <span key={pageNum} className="text-slate-600 px-1">...</span>;
                    }
                    return null;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-8 h-8 rounded-md border transition-all ${
                        page === pageNum
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'border-white/10 text-gray-400 hover:bg-white/5'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-md border border-white/20 text-gray-200 disabled:opacity-30 transition-all hover:bg-white/5 active:scale-95"
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