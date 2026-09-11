'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock3,
  Layers3,
  LockKeyhole,
  PlayCircle,
  School,
  Sparkles,
  Users,
} from 'lucide-react';

function formatLabel(value = '') {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getAccessLabel(accessLevel) {
  const labels = {
    public: 'Free',
    members: 'Members',
    'school-partner': 'School / Partner',
    paid: 'Paid Course',
  };

  return labels[accessLevel] || 'Course';
}

function getAccessIcon(accessLevel) {
  if (accessLevel === 'public') return CheckCircle2;
  if (accessLevel === 'school-partner') return School;
  return LockKeyhole;
}

export default function AcademyCourseCard({ course }) {
  const AccessIcon = getAccessIcon(course.accessLevel);

  return (
    <Link
      href={`/academy/courses/${course.slug}`}
      className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131722]"
    >
      <article className="relative flex h-full min-h-[390px] flex-col overflow-hidden border border-white/10 bg-[#09090B] p-6 shadow-xl shadow-black/20 transition duration-300 hover:-translate-y-2 hover:border-cyan-400/45 hover:shadow-cyan-950/20">
        <div
          className="absolute inset-0 -z-20 opacity-90 transition duration-500 group-hover:opacity-100"
          style={{
            background: `radial-gradient(circle at top right, ${course.accent.primary}33, transparent 35%), linear-gradient(135deg, #09090B 0%, #09090B 72%, ${course.accent.secondary}18 100%)`,
          }}
        />

        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{
            background: `linear-gradient(90deg, ${course.accent.primary}, ${course.accent.secondary})`,
          }}
        />

        <div className="flex items-start justify-between gap-4">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-lg shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${course.accent.primary}, ${course.accent.secondary})`,
              color: '#09090B',
            }}
          >
            <BookOpen className="h-6 w-6" />
          </span>

          <span
            className="inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[9px] font-medium uppercase tracking-[0.15em]"
            style={{
              borderColor: `${course.accent.primary}66`,
              backgroundColor: `${course.accent.primary}14`,
              color: course.accent.primary,
            }}
          >
            <AccessIcon className="h-3.5 w-3.5" />
            {getAccessLabel(course.accessLevel)}
          </span>
        </div>

        <p
          className="mt-7 font-mono text-[10px] font-medium uppercase tracking-[0.22em]"
          style={{ color: course.accent.primary }}
        >
          {course.status === 'coming-soon' ? 'Course in development' : 'Academy course'}
        </p>

        <h2 className="mt-3 text-2xl font-black italic uppercase leading-[0.92] tracking-[-0.045em] text-slate-50">
          {course.title}
        </h2>

        <p className="mt-4 text-sm leading-6 text-slate-300">
          {course.shortDescription}
        </p>

        <div className="mt-6 grid grid-cols-3 border-y border-white/10">
          <div className="py-3">
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">
              Modules
            </p>
            <p className="mt-1 text-sm font-bold text-slate-100">
              {course.moduleCount}
            </p>
          </div>

          <div className="border-x border-white/10 py-3 text-center">
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">
              Lessons
            </p>
            <p className="mt-1 text-sm font-bold text-slate-100">
              {course.lessonCount}
            </p>
          </div>

          <div className="py-3 text-right">
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">
              Time
            </p>
            <p className="mt-1 text-sm font-bold text-slate-100">
              {Math.round(course.estimatedMinutes / 60)}h
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 bg-cyan-400/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-cyan-200">
            <Users className="h-3.5 w-3.5" />
            {course.audience.map(formatLabel).join(' / ')}
          </span>

          <span className="inline-flex items-center gap-1.5 bg-white/[0.05] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-300">
            <Layers3 className="h-3.5 w-3.5" />
            {formatLabel(course.level)}
          </span>

          {course.projectIncluded && (
            <span className="inline-flex items-center gap-1.5 bg-emerald-400/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              Project
            </span>
          )}

          {course.certificateEligible && (
            <span className="inline-flex items-center gap-1.5 bg-amber-400/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-amber-100">
              <Award className="h-3.5 w-3.5" />
              Certificate
            </span>
          )}
        </div>

        <div
          className="mt-auto flex items-center justify-between gap-3 pt-7 text-sm font-extrabold italic uppercase tracking-wide"
          style={{ color: course.accent.primary }}
        >
          <span>
            {course.status === 'coming-soon'
              ? 'View course overview'
              : 'Open course'}
          </span>

          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </article>
    </Link>
  );
}