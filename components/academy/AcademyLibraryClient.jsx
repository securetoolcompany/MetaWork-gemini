'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ChevronDown,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import AcademyVideoCard from '@/components/academy/AcademyVideoCard.jsx';
import {
  ACADEMY_AUDIENCES,
  ACADEMY_FORMATS,
  ACADEMY_SECTIONS,
  ACADEMY_TOPICS,
  ACADEMY_VIDEOS,
} from '@/lib/academy-data';

import { ACADEMY_ACCESS_LEVELS } from '@/lib/academy-content-types';

const INITIAL_FILTERS = {
  audience: 'all',
  topic: 'all',
  section: 'all',
  format: 'all',
  access: 'all',
  level: 'all',
};

const LEVELS = [
  { id: 'start-here', label: 'Start Here' },
  { id: 'building-skills', label: 'Building Skills' },
  { id: 'advanced', label: 'Advanced' },
];

function SelectFilter({ label, value, options, onChange }) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none border border-white/10 bg-[#09090B] px-4 py-3 pr-10 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-slate-200 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
      >
        <option value="all">All {label}</option>

        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300" />
    </label>
  );
}

function getInitialFiltersFromSearchParams(searchParams) {
  const audience = searchParams.get('audience');
  const topic = searchParams.get('topic');
  const section = searchParams.get('section');
  const format = searchParams.get('format');
  const access = searchParams.get('access');
  const level = searchParams.get('level');

  return {
    audience: ACADEMY_AUDIENCES.some((item) => item.id === audience)
      ? audience
      : 'all',

    topic: ACADEMY_TOPICS.some((item) => item.id === topic)
      ? topic
      : 'all',

    section: ACADEMY_SECTIONS.some(
      (item) => item.id === section || item.slug === section
    )
      ? ACADEMY_SECTIONS.find(
          (item) => item.id === section || item.slug === section
        )?.id || 'all'
      : 'all',

    format: ACADEMY_FORMATS.some((item) => item.id === format)
      ? format
      : 'all',

    access: ACADEMY_ACCESS_LEVELS.some((item) => item.id === access)
      ? access
      : 'all',

    level: LEVELS.some((item) => item.id === level) ? level : 'all',
  };
}

export default function AcademyLibraryClient() {
  const searchParams = useSearchParams();

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(() =>
    getInitialFiltersFromSearchParams(searchParams)
  );
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setFilters(getInitialFiltersFromSearchParams(searchParams));
  }, [searchParams]);

  const filteredVideos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return ACADEMY_VIDEOS.filter(
        (video) => video.publishStatus === 'published'
    	).filter((video) => {
        const searchText = [
        video.title,
        video.description,
        video.format,
        video.level,
        video.primaryPathwaySlug,
        ...(video.audience ?? []),
        ...(video.topics ?? []),
        ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

        const matchesQuery =
        !normalizedQuery || searchText.includes(normalizedQuery);

        const matchesAudience =
        filters.audience === 'all' ||
        (video.audience ?? []).includes(filters.audience);

        const matchesTopic =
        filters.topic === 'all' ||
        (video.topics ?? []).includes(filters.topic);

        const matchesSection =
        filters.section === 'all' ||
        video.primaryPathwaySlug === filters.section;

        const matchesFormat =
        filters.format === 'all' || video.format === filters.format;

        const matchesAccess =
        filters.access === 'all' || video.access === filters.access;

        const matchesLevel =
        filters.level === 'all' || video.level === filters.level;

        return (
        matchesQuery &&
        matchesAudience &&
        matchesTopic &&
        matchesSection &&
        matchesFormat &&
        matchesAccess &&
        matchesLevel
        );
    });
    }, [filters, query]);

  const activeFilterCount = Object.values(filters).filter(
    (value) => value !== 'all'
  ).length;

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function clearFilters() {
    setQuery('');
    setFilters(INITIAL_FILTERS);
  }

  return (
    <section className="relative bg-[#131722] py-10 sm:py-14">
      <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
        <div className="relative overflow-hidden border border-cyan-400/20 bg-[#09090B] p-4 shadow-2xl shadow-black/25 sm:p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#22D3EE] via-[#2563EB] to-[#34D399]" />

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <label className="relative block flex-1">
              <span className="sr-only">Search Academy videos</span>

              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-300" />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Browse free learning resources organized by topic, pathway, audience, and skill level."
                className="w-full border border-white/10 bg-[#131722] py-3.5 pl-12 pr-10 text-sm text-white outline-none placeholder:text-slate-500 transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
              />

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>

            <button
              type="button"
              onClick={() => setShowFilters((visible) => !visible)}
              className="inline-flex items-center justify-center gap-2 border border-cyan-400/25 bg-cyan-400/[0.08] px-4 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/15 lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters

              {activeFilterCount > 0 && (
                <span className="bg-[#2563EB] px-2 py-0.5 text-[10px] text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="hidden grid-cols-3 gap-3 lg:grid">
              <SelectFilter
                label="Audiences"
                value={filters.audience}
                options={ACADEMY_AUDIENCES}
                onChange={(value) => updateFilter('audience', value)}
              />

              <SelectFilter
                label="Topics"
                value={filters.topic}
                options={ACADEMY_TOPICS}
                onChange={(value) => updateFilter('topic', value)}
              />

              <SelectFilter
                label="Access"
                value={filters.access}
                options={ACADEMY_ACCESS_LEVELS}
                onChange={(value) => updateFilter('access', value)}
              />
            </div>
          </div>

          <div
            className={`grid overflow-hidden transition-all duration-300 lg:grid-cols-6 lg:gap-3 ${
              showFilters
                ? 'mt-4 max-h-[32rem] gap-3 opacity-100'
                : 'max-h-0 gap-0 opacity-0 lg:mt-4 lg:max-h-28 lg:gap-3 lg:opacity-100'
            }`}
          >
            <SelectFilter
              label="Audiences"
              value={filters.audience}
              options={ACADEMY_AUDIENCES}
              onChange={(value) => updateFilter('audience', value)}
            />

            <SelectFilter
              label="Topics"
              value={filters.topic}
              options={ACADEMY_TOPICS}
              onChange={(value) => updateFilter('topic', value)}
            />

            <SelectFilter
              label="Pathways"
              value={filters.section}
              options={ACADEMY_SECTIONS.map((section) => ({
                id: section.id,
                label: section.title,
              }))}
              onChange={(value) => updateFilter('section', value)}
            />

            <SelectFilter
              label="Formats"
              value={filters.format}
              options={ACADEMY_FORMATS}
              onChange={(value) => updateFilter('format', value)}
            />

            <SelectFilter
              label="Access"
              value={filters.access}
              options={ACADEMY_ACCESS_LEVELS}
              onChange={(value) => updateFilter('access', value)}
            />

            <SelectFilter
              label="Levels"
              value={filters.level}
              options={LEVELS}
              onChange={(value) => updateFilter('level', value)}
            />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300">
              Library results
            </p>

            <p className="mt-2 text-lg font-black italic uppercase tracking-[-0.03em] text-slate-50">
              {filteredVideos.length}{' '}
              {filteredVideos.length === 1 ? 'lesson' : 'lessons'} ready.
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Browse free learning resources and preview upcoming member
              content.
            </p>
          </div>

          {(query || activeFilterCount > 0) && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-2 border border-white/10 bg-[#09090B] px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-200"
            >
              <X className="h-4 w-4" />
              Clear filters
            </button>
          )}
        </div>

        {filteredVideos.length > 0 ? (
          <div className="mt-7 grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredVideos.map((video, index) => (
              <AcademyVideoCard
                key={video.id}
                video={video}
                priority={index < 4}
              />
            ))}
          </div>
        ) : (
          <div className="mt-7 border border-dashed border-cyan-400/25 bg-[#09090B] px-6 py-16 text-center">
            <Filter className="mx-auto h-10 w-10 text-cyan-300/80" />

            <h2 className="mt-5 text-2xl font-black italic uppercase tracking-[-0.04em] text-slate-50">
              No lessons found.
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
              Clear one or more filters, try a broader search, or return to the
              full Academy library.
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="mt-6 bg-[#2563EB] px-5 py-3 text-sm font-extrabold italic uppercase tracking-wide text-white transition hover:bg-blue-500"
            >
              Reset library
            </button>
          </div>
        )}
      </div>
    </section>
  );
}