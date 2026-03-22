'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';

const ITEMS_PER_PAGE = 12;

// Pillar configuration for sidebar sections
const PILLAR_SECTIONS = [
  {
    id: 'accessories',
    title: 'Accessories & Apparel',
    icon: '🎽',
    categories: [
      'Accessories',
      'Activewear',
      'Backpacks',
      'Clothing',
      'Combat Sports',
      'Dresses, Skirts & Blouses',
      'Embroidered Patches',
      'Fightwear',
      'Fitness & Sports',
      'Formalwear',
      'Gym Bags',
      'Gymwear',
      'Headwear',
      'Hoodies',
      'Jersey',
      'Pants and Shorts',
      'Patches',
      'Phone Cases',
      'Purses & Tote Bags',
      'Rash Guards',
      'Schoolwear',
      'Shirts',
      'Shoes',
      'Sleepwear',
      'Streetwear',
      'Swimwear',
    ]
  },
  {
    id: 'home',
    title: 'Home & Office',
    icon: '🏠',
    categories: [
      'Bathroom',
      'Bedroom',
      'Blankets',
      'Computers',
      'Drinkware',
      'Home Decor',
      'Kitchen',
      'Magnets & Stickers',
      'Office',
      'Pets',
      'Pillows & Cases',
      'Posters & Wall Art',
      'Sitting Room',
      'Tech',
    ]
  },
  {
    id: 'school',
    title: 'School & University',
    icon: '🎓',
    categories: [
      'Backpacks',
      'School',
      'Schoolwear',
    ]
  }
];

export default function ShopByProduct({ 
  items,
  activeCategories = [],
  onCategoryToggle = (category) => {},
  onClearCategories = () => {}
}) {
  const [page, setPage] = useState(1);
  const [expandedSections, setExpandedSections] = useState({
    accessories: false,
    home: false,
    school: false,
  });
  const gridRef = useRef(null);

  // Filter products based on active categories
  const filteredItems = useMemo(() => {
    if (activeCategories.length === 0) return items;
    
    return items.filter(product => {
      if (!product.categories || !Array.isArray(product.categories)) return false;
      
      return product.categories.some(cat => 
        activeCategories.includes(cat)
      );
    });
  }, [items, activeCategories]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredItems.slice(start, end);
  }, [filteredItems, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [activeCategories]);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const hasActiveFilters = activeCategories.length > 0;

  return (
    <div className="flex gap-6 relative" ref={gridRef}>
      {/* SIDEBAR - Hierarchical Categories */}
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
                <div className="text-[10px] text-gray-500 mb-1">
                  Categories ({activeCategories.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {activeCategories.map(cat => (
                    <span key={cat} className="px-2 py-0.5 bg-white/10 rounded text-[10px] flex items-center gap-1">
                      {cat}
                      <button
                        onClick={() => onCategoryToggle(cat)}
                        className="text-gray-400 hover:text-white ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                <button
                  onClick={onClearCategories}
                  className="w-full mt-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs font-medium transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* Hierarchical Category Sections */}
          {PILLAR_SECTIONS.map(section => (
            <div key={section.id} className="bg-[#0f172a] rounded-lg border border-white/10 overflow-hidden">
              {/* Section Header - Collapsible */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{section.icon}</span>
                  <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                    {section.title}
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedSections[section.id] ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Category List - Collapsible */}
              {expandedSections[section.id] && (
                <div className="px-2 pb-2 space-y-1">
                  {section.categories.map(cat => {
                    const isActive = activeCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        onClick={() => onCategoryToggle(cat)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                          isActive
                            ? 'bg-white text-black font-semibold'
                            : 'hover:bg-white/5 text-gray-300'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 min-w-0">
        {/* Header with count */}
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Browse Products</h2>
            <p className="text-gray-400 mt-1">
              Discover custom merchandise from our creator community
            </p>
          </div>
          <div className="bg-[#1e293b] px-3 py-1 rounded-md text-[10px] font-bold text-gray-400 border border-white/5">
            {filteredItems.length} products
          </div>
        </div>

        {/* No results message */}
        {filteredItems.length === 0 && hasActiveFilters ? (
          <div className="h-[calc(100vh-20rem)] flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-4xl">🔍</div>
              <h3 className="text-xl font-semibold">No products match your filters</h3>
              <p className="text-gray-400">
                Try removing some filters or selecting different categories
              </p>
              <button
                onClick={onClearCategories}
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
              {pageItems.map((product) => (
                <Link
                  key={product.id || product._id}
                  href={`/showroom/product/${product.id || product._id}`}
                  className="bg-[#111] rounded-2xl overflow-hidden border border-white/5 flex flex-col h-full hover:border-emerald-500/30 transition-all cursor-pointer block"
                >
                  {/* Image */}
                  <div className="relative w-full pt-[100%] overflow-hidden">
                    <img
  src={product.images?.[0] || product.mockupImages?.[0] || product.imageUrl || product.image}

                      alt={product.name || product.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.opacity = '0';
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div className="p-4 flex flex-col gap-2 flex-1">
                    <h3 className="text-sm font-semibold line-clamp-2">
                      {product.name || product.title}
                    </h3>
                    <p className="text-xs text-gray-400 line-clamp-2">
                      {product.description || 'Custom merchandise'}
                    </p>

                    <div className="mt-auto pt-2">
                      <span className="font-bold text-emerald-400 text-sm">
                        ${product.price || '24.99'}
                      </span>
                    </div>
                    
                    <div className="mt-3">
                      <div className="w-full text-[18px] font-bold py-2 rounded-md bg-emerald-500 text-white text-center">
                        View Product
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
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
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} of{' '}
              {filteredItems.length}
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
