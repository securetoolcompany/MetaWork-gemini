'use client';

import { useState, useMemo } from 'react';
import AisleIPAssetCard from '@/components/aisle-public/AisleIPAssetCard';

const ITEMS_PER_PAGE = 12;

const IP_FILTER_GROUPS = [
  {
    id: 'type',
    title: 'Asset Type',
    icon: '💎',
    options: ['Illustration', 'Logo & Icon', 'Pattern & Texture', 'Typography', '3D Model', 'Photography'],
  },
  {
    id: 'style',
    title: 'Visual Style',
    icon: '🎨',
    options: ['Anime & Manga', 'Cyberpunk', 'Minimalist', 'Vintage & Retro', 'Street Art', 'Realistic', 'Cartoon'],
  },
  {
    id: 'usage',
    title: 'Best For',
    icon: '🚀',
    options: ['Merch Designs', 'Social Media', 'Game Assets', 'Apparel Print', 'Brand Identity'],
  },
  {
    id: 'theme',
    title: 'Theme',
    icon: '🎭',
    options: ['Esports & Gaming', 'Nature & Wildlife', 'Sci-Fi & Fantasy', 'Spiritual', 'Corporate'],
  },
];

export default function ShopByIP({ 
  items = [], 
  filters = { type: [], style: [], usage: [], theme: [] },  onToggleFilter, 
  onClearAll 
}) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({
    type: false,
    style: false,
    usage: false,
    theme: false,
  });

  const toggleGroup = (id) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 1. Search Logic
  const searchedItems = useMemo(() => {
    return items.filter(item => {
      const text = `${item.title} ${item.description}`.toLowerCase();
      return text.includes(searchQuery.toLowerCase());
    });
  }, [items, searchQuery]);

  // 2. Filter Logic (Add this if your parent doesn't handle it)
  const filteredItems = useMemo(() => {
    return searchedItems.filter(item => {
      return Object.keys(filters).every(groupId => {
        if (filters[groupId].length === 0) return true;
        // Logic assumes item has matching category/tag fields
        return filters[groupId].some(val => item.categories?.includes(val) || item.tags?.includes(val));
      });
    });
  }, [searchedItems, filters]);

  const hasActiveFilters = Object.values(filters).some(group => group.length > 0);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const pageItems = filteredItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="flex gap-6 relative">
      {/* SIDEBAR FILTERS */}
      <aside className="w-64 flex-shrink-0 sticky top-24 self-start max-h-[calc(100vh-12rem)] overflow-y-auto pb-20 scrollbar-hide">
        <div className="space-y-6 pr-2">
          
          {/* Unified Active Filters Widget */}
          <div className="bg-slate-900/50 rounded-lg p-4 border border-white/10">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
              Filter Status
            </div>

            {!hasActiveFilters ? (
              <p className="text-xs text-slate-500 italic">No filters applied</p>
            ) : (
              <div className="space-y-3">
                {/* Grouped Filter Chips - Functionality like ShopByProduct */}
                {Object.keys(filters).map((groupId) => {
                  const activeValues = filters[groupId];
                  if (!activeValues?.length) return null;

                  return (
                    <div key={groupId} className="space-y-1">
                      <div className="text-[9px] font-medium text-slate-500 uppercase">
                        {groupId.replace(/([A-Z])/g, ' $1')} ({activeValues.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {activeValues.map((val) => (
                          <span 
                            key={`${groupId}-${val}`} 
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded text-[10px] text-slate-200 border border-white/5 group hover:bg-white/20 transition-colors"
                          >
                            {val}
                            <button
                              onClick={() => onToggleFilter(groupId, val)}
                              className="text-slate-500 hover:text-white transition-colors"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Action Buttons */}
                <div className="pt-2 border-t border-white/5 mt-2">
                  <button
                    onClick={onClearAll}
                    className="w-full px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded text-[11px] font-bold uppercase tracking-tight transition-all"
                  >
                    Reset All Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Groups */}
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
                <div className={`transform transition-transform ${expandedGroups[group.id] ? 'rotate-180' : ''}`}>▼</div>
              </button>
              
              {expandedGroups[group.id] && (
                <div className="px-2 pb-2 space-y-1">
                  {group.options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => onToggleFilter(group.id, opt)}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-all ${
                        filters[group.id].includes(opt) 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* MAIN GRID */}
      <main className="flex-1 min-w-0">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Browse IP Assets</h2>
            <p className="text-slate-400">Discover {filteredItems.length} professional creations.</p>
          </div>
          <div className="w-72">
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
          {pageItems.map((item) => (
            <AisleIPAssetCard key={item.id || item._id} item={item} accentColor="#3b82f6" />
          ))}
        </div>
      </main>
    </div>
  );
}