'use client';

import { useState, useMemo } from 'react';
import AisleIPAssetCard from '@/components/aisle-public/AisleIPAssetCard';

const ITEMS_PER_PAGE = 12;

export default function ShopByIP({ 
  items = [], 
  categories = [], 
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

  // Filter based on search
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const title = item.title || item.name || '';
      const description = item.description || '';
      return (
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [items, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredItems.slice(start, end);
  }, [filteredItems, currentPage]);

  return (
    <div className="space-y-8">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">IP Assets</h2>
          <p className="text-slate-400 mt-1">
            License high-quality digital assets for your custom products
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#1e293b] border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      </div>

      {/* Grid Area */}
      {filteredItems.length === 0 ? (
        <div className="py-24 text-center bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-slate-400">No assets found</h3>
          <p className="text-slate-500 text-sm mt-1">Try adjusting your search terms.</p>
        </div>
      ) : (
        <div className="pb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {pageItems.map((item) => (
              <AisleIPAssetCard 
                key={item.id || item._id} 
                item={item} 
                accentColor="#3b82f6" // Use the IP-standard blue
              />
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#020617]/95 backdrop-blur-md border-t border-white/10 py-4 z-20">
          <div className="container mx-auto px-6 flex items-center justify-between gap-4 text-xs">
            <span className="text-slate-400">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}
              {'–'}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} of{' '}
              {filteredItems.length}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 rounded-md border text-[11px] font-semibold transition-all ${
                  currentPage === 1
                    ? 'border-white/5 text-slate-600 cursor-not-allowed'
                    : 'border-white/20 text-slate-200 hover:bg-white/5'
                }`}
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPage(i + 1)}
                    className={`h-8 min-w-[2rem] rounded-md text-[11px] font-semibold transition-all ${
                      i + 1 === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1.5 rounded-md border text-[11px] font-semibold transition-all ${
                  currentPage === totalPages
                    ? 'border-white/5 text-slate-600 cursor-not-allowed'
                    : 'border-white/20 text-slate-200 hover:bg-white/5'
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