'use client';

import { useState, useMemo } from 'react';
import AisleIPAssetCard from '@/components/aisle-public/AisleIPAssetCard';

const ITEMS_PER_PAGE = 12;

export default function ShopByIP({ 
  items = [], 
  availableCategories = [], 
  availableTags = [], 
  activeCategories = [], 
  activeTags = [], 
  onCategoryToggle, 
  onClearCategories, 
  onTagToggle, 
  onClearTags 
}) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({
    categories: true,
    tags: false,
  });

  const toggleGroup = (id) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter based on search
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const title = item.title || item.name || '';
      const description = item.description || '';
      const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [items, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredItems.slice(start, end);
  }, [filteredItems, currentPage]);

  const hasActiveFilters = activeCategories.length > 0 || activeTags.length > 0;

  return (
    <div className="flex gap-6 relative">
      {/* LEFT SIDEBAR FILTERS */}
      <aside className="w-64 flex-shrink-0 sticky top-24 self-start max-h-[calc(100vh-12rem)] overflow-y-auto pb-20 scrollbar-hide">
        <div className="space-y-6 pr-2">
          {/* Active Filters Summary */}
          <div className="bg-[#1e293b] rounded-lg p-4 border border-white/10">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Active Filters
            </div>
            {!hasActiveFilters ? (
              <p className="text-xs text-slate-500">No filters applied</p>
            ) : (
              <div className="space-y-3">
                {activeCategories.length > 0 && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">Categories ({activeCategories.length})</div>
                    <div className="flex flex-wrap gap-1">
                      {activeCategories.map(cat => (
                        <span key={cat} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] flex items-center gap-1 border border-blue-500/20">
                          {cat}
                          <button onClick={() => onCategoryToggle(cat)} className="hover:text-white">✕</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {activeTags.length > 0 && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">Tags ({activeTags.length})</div>
                    <div className="flex flex-wrap gap-1">
                      {activeTags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px] flex items-center gap-1">
                          {tag}
                          <button onClick={() => onTagToggle(tag)} className="hover:text-white">✕</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => { onClearCategories(); onClearTags(); }}
                  className="w-full mt-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs font-medium transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* Categories Group */}
          <div className="bg-[#0f172a] rounded-lg border border-white/10 overflow-hidden">
            <button onClick={() => toggleGroup('categories')} className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Categories</span>
              </div>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedGroups.categories ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {expandedGroups.categories && (
              <div className="px-2 pb-2 space-y-1">
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => onCategoryToggle(cat)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${activeCategories.includes(cat) ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-white/5 text-slate-400'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tags Group */}
          <div className="bg-[#0f172a] rounded-lg border border-white/10 overflow-hidden">
            <button onClick={() => toggleGroup('tags')} className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Tags</span>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedGroups.tags ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {expandedGroups.tags && (
              <div className="px-2 pb-2 space-y-1">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => onTagToggle(tag)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${activeTags.includes(tag) ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-white/5 text-slate-400'}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 min-w-0">
        <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">IP Assets</h2>
            <p className="text-slate-400 mt-1">
              Explore {filteredItems.length} curated digital assets
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="Search title or description..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
            />
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="py-24 text-center bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-slate-400">No assets found</h3>
            <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or search.</p>
          </div>
        ) : (
          <div className="pb-24">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="fixed bottom-0 left-0 right-0 bg-[#020617]/95 backdrop-blur-md border-t border-white/10 py-4 z-20">
            <div className="container mx-auto px-6 ml-64 flex items-center justify-between gap-4 text-xs">
              <span className="text-slate-400">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} of {filteredItems.length}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-md border text-[11px] font-semibold transition-all ${currentPage === 1 ? 'border-white/5 text-slate-600 cursor-not-allowed' : 'border-white/20 text-slate-200 hover:bg-white/5'}`}
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setPage(i + 1)}
                      className={`h-8 min-w-[2rem] rounded-md text-[11px] font-semibold transition-all ${i + 1 === currentPage ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/10'}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-md border text-[11px] font-semibold transition-all ${currentPage === totalPages ? 'border-white/5 text-slate-600 cursor-not-allowed' : 'border-white/20 text-slate-200 hover:bg-white/5'}`}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}