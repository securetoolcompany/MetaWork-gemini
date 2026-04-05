'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Filter, Search, ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import CreatorCard from './CreatorCard';

const ITEMS_PER_PAGE = 12;

const AISLE_FILTER_GROUPS = [
  { id: 'audience', title: 'Audience / Theme', icon: '👥', options: ['Kids & Family', 'Sports & Combat Sports', 'Music & Entertainment', 'Esports & Gaming', 'Nature & Wildlife', 'Sci‑Fi & Fantasy', 'Spiritual & Mythology', 'Corporate & Professional'] },
  { id: 'style', title: 'Art Style', icon: '🎨', options: ['Anime & Manga', 'Graffiti & Street Art', 'Comic / Graphic Novel', 'Minimalist', 'Abstract & Geometric', 'Retro & Vintage', 'Cyberpunk & Futuristic', 'Realistic', 'Cartoon & Kawaii', 'Surreal & Dreamlike', 'Pop Art', 'Typography & Lettering', 'Photography'] },
  { id: 'medium', title: 'Medium / Technique', icon: '🧪', options: ['Digital Illustration', 'Vector Art', 'Pixel Art', '3D / CGI', 'Watercolor', 'Ink & Line Art', 'Acrylic / Oil Painting', 'Mixed Media / Collage', 'Pencil / Sketch', 'Printmaking / Screenprint', 'Photography'] },
  { id: 'useCase', title: 'Use Case / Service', icon: '🧩', options: ['Logo & Brand Assets', 'Mascots & Characters', 'Twitch & Stream Overlays', 'Social Media Content Packs', 'Merch‑Ready Designs', 'Commission Slots', 'Corporate Illustration', 'Album & Cover Art', 'Book & Editorial Illustration', 'Icons & UI Assets', 'Backgrounds & Environments', 'Photography Packs'] },
];

export default function ShopByAisle({ items = [], filters = {}, onToggleFilter, onClearAll }) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({ audience: false, style: false, medium: false, useCase: false });

  const isMobile = useIsMobile();
  const gridRef = useRef(null);

  const filteredItems = useMemo(() => {
    return items.filter(aisle => {
      const matchesSearch = !searchQuery || 
        `${aisle.username} ${aisle.displayName} ${aisle.bio}`.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      // Filter against aisle Settings tags/categories
      return Object.keys(filters).every(groupId => {
        if (!filters[groupId] || filters[groupId].length === 0) return true;
        
        const aisleSettings = aisle.aisleSettings || {};
        const itemValues = [
          ...(aisleSettings.categories || []),
          ...(aisleSettings.tags || []),
          ...(aisle.categories || []),
          aisleSettings.audience,
          aisleSettings.style,
          aisleSettings.medium,
          aisleSettings.useCase
        ].filter(Boolean).map(v => String(v).toLowerCase());

        return filters[groupId].some(val => itemValues.includes(val.toLowerCase()));
      });
    });
  }, [items, searchQuery, filters]);

  const hasActiveFilters = Object.values(filters).some(group => group && group.length > 0);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const pageItems = filteredItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [filters, searchQuery]);

  const FilterContent = () => (
    <div className="space-y-6">
      <div className="bg-slate-900/50 rounded-lg p-4 border border-white/10">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Filter Status</div>
        {!hasActiveFilters ? (
          <p className="text-xs text-slate-500 italic">No filters applied</p>
        ) : (
          <div className="space-y-3">
            {Object.keys(filters).map(groupId => {
              if (!filters[groupId]?.length) return null;
              return filters[groupId].map(val => (
                <span key={`${groupId}-${val}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 rounded text-[10px] text-blue-200 border border-blue-500/20 mr-1 mb-1">
                  {val} 
                  <button onClick={() => onToggleFilter(groupId, val)} className="hover:text-white hover:bg-blue-500/30 rounded-full p-0.5 transition-colors ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ));
            })}
            <button onClick={onClearAll} className="w-full py-1.5 mt-2 bg-blue-500/10 text-blue-400 rounded text-[11px] font-bold uppercase transition-all hover:bg-blue-500/20">
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {AISLE_FILTER_GROUPS.map(group => (
        <div key={group.id} className="bg-[#0f172a] rounded-lg border border-white/10 overflow-hidden">
          <button onClick={() => setExpandedGroups(p => ({...p, [group.id]: !p[group.id]}))} className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-lg">{group.icon}</span>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-tight">{group.title}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expandedGroups[group.id] ? 'rotate-180' : ''}`} />
          </button>
          
          {expandedGroups[group.id] && (
            <div className="px-2 pb-2 space-y-1">
              {group.options.map(opt => (
                <button 
                  key={opt} 
                  onClick={() => onToggleFilter(group.id, opt)} 
                  className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-all ${
                    filters[group.id]?.includes(opt) ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:bg-white/5 hover:text-white'
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
  );

  return (
    <div className="flex flex-col md:flex-row gap-6 relative px-4 md:px-0" ref={gridRef}>
      {isMobile && (
        <button onClick={() => setIsFilterDrawerOpen(true)} className="fixed bottom-24 right-6 z-50 flex items-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-full shadow-2xl transition-transform active:scale-95">
          <Filter className="w-5 h-5" />
          <span className="text-sm font-bold uppercase">Filters {hasActiveFilters && `(${Object.values(filters).flat().length})`}</span>
        </button>
      )}

      <aside className="hidden md:block w-64 flex-shrink-0 sticky top-24 self-start max-h-[calc(100vh-12rem)] overflow-y-auto pb-20 scrollbar-hide">
        <FilterContent />
      </aside>

      <main className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-white">Browse Aisles</h2>
            <p className="text-slate-400 text-sm">Explore {filteredItems.length} curated creator collections.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search aisles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
            />
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center bg-slate-900/20 rounded-2xl border border-dashed border-white/10">
            <div className="text-4xl mb-4 opacity-50">🏪</div>
            <h3 className="text-lg font-medium text-white">No Aisles found</h3>
            <p className="text-slate-500 text-sm mt-2 max-w-sm">Try adjusting your search or resetting filters</p>
            {hasActiveFilters && (
              <button onClick={onClearAll} className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm font-semibold transition-colors">
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 pb-32">
            {pageItems.map((aisle) => (
              <CreatorCard key={aisle.id || aisle._id} creator={aisle} />
            ))}
          </div>
        )}
      </main>

      {/* Mobile Drawer */}
      {isMobile && isFilterDrawerOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsFilterDrawerOpen(false)} />
          <div className="relative w-80 bg-[#020617] h-full shadow-2xl flex flex-col border-l border-white/10 animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-blue-400" /><h2 className="text-sm font-bold uppercase text-white">Aisle Filters</h2></div>
              <button onClick={() => setIsFilterDrawerOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-32"><FilterContent /></div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#020617] border-t border-white/10">
              <button onClick={() => setIsFilterDrawerOpen(false)} className="w-full py-3 bg-blue-600 hover:bg-blue-500 transition-colors text-white rounded-lg font-bold uppercase text-xs">
                Show {filteredItems.length} Aisles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#020617] border-t border-white/10 py-4 z-20">
          <div className="container mx-auto px-6 md:ml-64 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <span className="text-gray-400 font-medium">
              Showing {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, filteredItems.length)} of {filteredItems.length}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-1.5 rounded-md border border-white/20 text-gray-200 disabled:opacity-30 hover:bg-white/5 active:scale-95 transition-all">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-1.5 rounded-md border border-white/20 text-gray-200 disabled:opacity-30 hover:bg-white/5 active:scale-95 transition-all">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}