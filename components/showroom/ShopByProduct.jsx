'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Filter, Search, ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import AisleProductCard from '@/components/aisle-public/AisleProductCard';

const ITEMS_PER_PAGE = 12;

const PILLAR_SECTIONS = [
  {
    id: 'accessories',
    title: 'Accessories & Apparel',
    icon: '🎽',
    categories: [
      'Accessories', 'Activewear', 'Backpacks', 'Clothing', 'Combat Sports',
      'Dresses, Skirts & Blouses', 'Embroidered Patches', 'Fightwear',
      'Fitness & Sports', 'Formalwear', 'Gym Bags', 'Gymwear', 'Headwear',
      'Hoodies', 'Jersey', 'Pants and Shorts', 'Patches', 'Phone Cases',
      'Purses & Tote Bags', 'Rash Guards', 'Schoolwear', 'Shirts', 'Shoes',
      'Sleepwear', 'Streetwear', 'Swimwear',
    ]
  },
  {
    id: 'home',
    title: 'Home & Office',
    icon: '🏠',
    categories: [
      'Bathroom', 'Bedroom', 'Blankets', 'Computers', 'Drinkware',
      'Home Decor', 'Kitchen', 'Magnets & Stickers', 'Office', 'Pets',
      'Pillows & Cases', 'Posters & Wall Art', 'Sitting Room', 'Tech',
    ]
  },
  {
    id: 'school',
    title: 'School & University',
    icon: '🎓',
    categories: ['Backpacks', 'School', 'Schoolwear']
  }
];

export default function ShopByProduct({ 
  items,
  activeCategories = [],
  onCategoryToggle = (category) => {},
  onClearCategories = () => {}
}) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    accessories: false,
    home: false,
    school: false,
  });
  
  const isMobile = useIsMobile();
  const gridRef = useRef(null);

  const filteredItems = useMemo(() => {
    return items.filter(product => {
      const matchesSearch = !searchQuery || 
        `${product.name} ${product.description}`.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = activeCategories.length === 0 || 
        (product.categories && product.categories.some(cat => activeCategories.includes(cat)));
      
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, activeCategories]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const pageItems = filteredItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [activeCategories, searchQuery]);

  const FilterContent = () => (
    <div className="space-y-6">
      <div className="bg-slate-900/50 rounded-lg p-4 border border-white/10">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Filter Status</div>
        {activeCategories.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No categories selected</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {activeCategories.map((val) => (
                <span key={val} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 rounded text-[10px] text-blue-200 border border-blue-500/20">
                  {val}
                  <button onClick={() => onCategoryToggle(val)} className="hover:text-white">✕</button>
                </span>
              ))}
            </div>
            <button onClick={onClearCategories} className="w-full py-1.5 mt-2 bg-blue-500/10 text-blue-400 rounded text-[11px] font-bold uppercase transition-all">
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {PILLAR_SECTIONS.map(section => (
        <div key={section.id} className="bg-[#0f172a] rounded-lg border border-white/10 overflow-hidden">
          <button
            onClick={() => setExpandedSections(p => ({...p, [section.id]: !p[section.id]}))}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{section.icon}</span>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-tight">{section.title}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expandedSections[section.id] ? 'rotate-180' : ''}`} />
          </button>
          {expandedSections[section.id] && (
            <div className="px-2 pb-2 space-y-1">
              {section.categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => onCategoryToggle(cat)}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-all ${
                    activeCategories.includes(cat) ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  {cat}
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
        <button onClick={() => setIsFilterDrawerOpen(true)} className="fixed bottom-24 right-6 z-50 flex items-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-full shadow-2xl active:scale-95 transition-transform">
          <Filter className="w-5 h-5" />
          <span className="text-sm font-bold uppercase">Filters ({activeCategories.length})</span>
        </button>
      )}

      <aside className="hidden md:block w-64 flex-shrink-0 sticky top-24 self-start max-h-[calc(100vh-12rem)] overflow-y-auto pb-20 scrollbar-hide">
        <FilterContent />
      </aside>

      <main className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-white">Browse Products</h2>
            <p className="text-slate-400 text-sm">Discover {filteredItems.length} custom merchandise items.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 pb-32">
          {pageItems.map((product) => (
            <AisleProductCard key={product.id || product._id} product={product} />
          ))}
        </div>
      </main>

      {/* Mobile Drawer */}
      {isMobile && isFilterDrawerOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsFilterDrawerOpen(false)} />
          <div className="relative w-80 bg-[#020617] h-full shadow-2xl flex flex-col border-l border-white/10 animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-white">Product Filters</h2>
              </div>
              <button onClick={() => setIsFilterDrawerOpen(false)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-32">
              <FilterContent />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#020617] border-t border-white/10">
              <button onClick={() => setIsFilterDrawerOpen(false)} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold uppercase text-xs">Show {filteredItems.length} Products</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}