'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Search, X, Package, FolderOpen, User } from 'lucide-react';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ products: [], aisles: [], profiles: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const debounceTimer = setTimeout(async () => {
      if (query.trim().length === 0) {
        setResults({ products: [], aisles: [], profiles: [] });
        setIsSearching(false);
        setIsOpen(false);
        return;
      }

      setIsSearching(true);
      setIsOpen(true);

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        setResults(data);
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('Search request aborted');
        } else {
          console.error('Search error:', error);
          setResults({ products: [], aisles: [], profiles: [] });
        }
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [query]);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults({ products: [], aisles: [], profiles: [] });
    setIsOpen(false);
    inputRef.current?.focus();
  }, []);

  const handleResultClick = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setResults({ products: [], aisles: [], profiles: [] });
  }, []);

  const hasResults =
    results.products.length > 0 ||
    results.aisles.length > 0 ||
    results.profiles.length > 0;

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products, aisles, creators..."
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-black bg-white"
          aria-label="Global search"
          aria-expanded={isOpen}
          aria-controls="search-results"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          id="search-results"
          className="absolute top-full mt-2 w-full bg-slate-900 border border-slate-800 rounded-lg shadow-lg max-h-[500px] overflow-y-auto z-50 text-slate-50"
        >
          {isSearching && (
            <div className="p-4 text-center text-slate-300">Searching...</div>
          )}

          {!isSearching && !hasResults && query.trim().length > 0 && (
            <div className="p-4 text-center text-slate-300">
              No results found for &quot;{query}&quot;
            </div>
          )}

          {!isSearching && hasResults && (
            <div className="py-2">

              {results.products.length > 0 && (
                <SearchSection
                  title="Products"
                  icon={Package}
                  items={results.products}
                  renderItem={(product) => (
                    <Link
                      key={product._id}
                      href={`/products/${product.id || product._id}`}
                      onClick={handleResultClick}
                      className="group flex items-center gap-3 px-4 py-2 hover:bg-slate-800 transition-colors"
                    >
                      <Package className="h-4 w-4 text-slate-300 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-slate-100 group-hover:text-white">
                          {product.name}
                        </p>
                      </div>
                    </Link>
                  )}
                />
              )}

              {results.aisles.length > 0 && (
                <SearchSection
                  title="Aisles"
                  icon={FolderOpen}
                  items={results.aisles}
                  renderItem={(aisle) => {
                    const publicSlug = aisle.publicSlug;
                    return (
                      <Link
                        key={aisle._id}
                        href={publicSlug ? `/aisle/${publicSlug}` : '#'}
                        onClick={handleResultClick}
                        className="group flex items-center gap-3 px-4 py-2 hover:bg-slate-800 transition-colors"
                      >
                        <FolderOpen className="h-4 w-4 text-slate-300 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-slate-100 group-hover:text-white">
                            {aisle.title}
                          </p>
                          <p className="text-sm text-slate-400 group-hover:text-slate-300 truncate">
                            {publicSlug ? `/aisle/${publicSlug}` : 'Link unavailable'}
                          </p>
                        </div>
                      </Link>
                    );
                  }}
                />
              )}

              {results.profiles.length > 0 && (
                <SearchSection
                  title="Profiles"
                  icon={User}
                  items={results.profiles}
                  renderItem={(profile) => (
                    <Link
                      key={profile._id}
                      href={`/profile/${profile.slug || profile.username}`}
                      onClick={handleResultClick}
                      className="group flex items-center gap-3 px-4 py-2 hover:bg-slate-800 transition-colors"
                    >
                      <User className="h-4 w-4 text-slate-300 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-slate-100 group-hover:text-white">
                          {profile.displayName || profile.username}
                        </p>
                        <p className="text-sm text-slate-400 group-hover:text-slate-300 truncate">
                          /profile/{profile.slug || profile.username}
                        </p>
                      </div>
                    </Link>
                  )}
                />
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchSection({ title, icon: Icon, items, renderItem }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700">
        <Icon className="h-4 w-4 text-slate-300" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-200">
          {title}
        </h3>
        <span className="text-xs text-slate-400">({items.length})</span>
      </div>
      <div>{items.map(renderItem)}</div>
    </div>
  );
}