'use client';

import Link from 'next/link';
import { LockKeyhole, Play, Sparkles } from 'lucide-react';
import { getSectionById, getYoutubeThumbnail } from '@/lib/academy-data';

function formatLabel(value = '') {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function AcademyVideoCard({ video, priority = false }) {
  const section = getSectionById(video.primaryPathwaySlug);
  const thumbnail = getYoutubeThumbnail(video.youtubeId);
  const isLocked = video.access !== 'public';

  return (
    <Link
      href={`/academy/library/${video.slug}`}
      className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded-2xl"
      aria-label={`Watch ${video.title}`}
    >
      <article className="h-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-xl shadow-slate-950/20 transition duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-cyan-950/30">
        <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-cyan-950 via-slate-900 to-violet-950">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt=""
              loading={priority ? 'eager' : 'lazy'}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105 group-hover:opacity-80"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.24),_transparent_36%),linear-gradient(135deg,_#172554,_#020617)]">
              <Sparkles className="h-12 w-12 text-cyan-300/80" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
<div className="absolute inset-0 bg-gradient-to-tr from-cyan-400/20 via-transparent to-violet-400/20 opacity-70 transition duration-500 group-hover:opacity-100" />

          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span className="rounded-full border border-white/15 bg-slate-950/75 px-2.5 py-1 text-xs font-medium text-slate-100 backdrop-blur">
              {section?.title || 'MetaWork Academy'}
            </span>
          </div>

          <div className="absolute right-3 top-3">
            {isLocked ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-100 backdrop-blur">
                <LockKeyhole className="h-3.5 w-3.5" />
                Members
              </span>
            ) : (
              <span className="rounded-full border border-cyan-200/30 bg-cyan-400/20 px-2.5 py-1 text-xs font-bold text-cyan-50 shadow-lg shadow-cyan-950/30 backdrop-blur">
                 Free learning
              </span>
            )}
          </div>

          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-sky-400 to-blue-500 text-slate-950 shadow-xl shadow-cyan-500/35 transition duration-300 group-hover:scale-110 group-hover:rotate-3">
              {isLocked ? (
                <LockKeyhole className="h-4 w-4" />
              ) : (
                <Play className="ml-0.5 h-4 w-4 fill-current" />
              )}
            </span>
            {video.durationLabel && (
              <span className="text-xs font-medium text-slate-100">
                {video.durationLabel}
              </span>
            )}
          </div>
        </div>

        <div className="flex h-[calc(100%-auto)] flex-col p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-200">
              {formatLabel(video.format)}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300">
              {formatLabel(video.level)}
            </span>
          </div>

          <h3 className="text-lg font-semibold leading-snug text-white transition group-hover:text-cyan-200">
            {video.title}
          </h3>

          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
            {video.description}
          </p>

          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
            <span className="text-slate-500">
              {(video.audience ?? [])
                .map((audience) => formatLabel(audience))
                .join(' · ')}
            </span>
                        <span className="font-medium text-cyan-300 transition group-hover:text-cyan-200">
              {isLocked ? 'Preview' : 'Watch'}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}