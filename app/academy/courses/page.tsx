import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Layers3,
  LockKeyhole,
  School,
  Sparkles,
} from 'lucide-react';

import AcademyCourseCard from '@/components/academy/AcademyCourseCard';
import { ACADEMY_COURSES } from '@/lib/academy-courses-data';

export const metadata = {
  title: 'Courses | MetaWork Academy',
  description:
    'Explore structured MetaWork Academy courses for creators, students, educators, and school partners.',
};

const courseBenefits = [
  {
    icon: Layers3,
    title: 'Structured learning',
    description:
      'Move through an intentional sequence instead of piecing together disconnected resources.',
    color: 'text-cyan-200 bg-cyan-400/10 border-cyan-400/25',
  },
  {
    icon: Sparkles,
    title: 'Practical outcomes',
    description:
      'Build projects, concepts, products, and visible evidence of learning along the way.',
    color: 'text-emerald-200 bg-emerald-400/10 border-emerald-400/25',
  },
  {
    icon: GraduationCap,
    title: 'Built to grow',
    description:
      'Courses are designed for future assessments, progress tracking, member access, and school use.',
    color: 'text-blue-200 bg-blue-500/10 border-blue-400/25',
  },
];

export default function AcademyCoursesPage() {
  const publicCourses = ACADEMY_COURSES.filter(
    (course) => course.accessLevel === 'public'
  );

  const memberCourses = ACADEMY_COURSES.filter(
    (course) => course.accessLevel === 'members'
  );

  const schoolCourses = ACADEMY_COURSES.filter(
    (course) => course.accessLevel === 'school-partner'
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#131722] text-slate-50">
      <section className="relative isolate overflow-hidden border-b border-cyan-400/15 bg-[#131722]">
        <div className="absolute inset-0 -z-30 bg-[linear-gradient(120deg,#131722_0%,#111827_52%,#0a1821_100%)]" />

        <div className="absolute inset-0 -z-20 opacity-[0.16] [background-image:linear-gradient(rgba(34,211,238,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.22)_1px,transparent_1px)] [background-size:46px_46px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />

        <div className="absolute -left-40 top-[-12rem] -z-10 h-[38rem] w-[38rem] rounded-full bg-cyan-400/18 blur-[140px]" />
        <div className="absolute -right-40 -top-28 -z-10 h-[42rem] w-[42rem] rounded-full bg-blue-600/25 blur-[150px]" />
        <div className="absolute bottom-[-22rem] left-[42%] -z-10 h-[34rem] w-[34rem] rounded-full bg-emerald-400/10 blur-[150px]" />

        <div className="relative mx-auto w-full max-w-[1600px] px-5 py-16 sm:px-8 sm:py-24 lg:px-10 2xl:px-12">
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-2 border border-cyan-400/35 bg-cyan-400/10 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-200 shadow-lg shadow-cyan-950/25">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34D399] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34D399]" />
              </span>
              MetaWork Academy // Courses
            </div>

            <h1 className="mt-7 text-5xl font-black italic uppercase leading-[0.86] tracking-[-0.075em] text-slate-50 sm:text-6xl lg:text-7xl xl:text-8xl">
              Learn with purpose.
              <span className="mt-3 block bg-gradient-to-r from-[#22D3EE] via-[#60A5FA] to-[#2563EB] bg-clip-text text-transparent">
                Build with direction.
              </span>
            </h1>

            <p className="mt-8 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
              MetaWork Academy courses turn practical videos, project work,
              and guided learning into focused skill-building experiences for
              creators, students, educators, and school partners.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#course-directory"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-4 text-sm font-extrabold italic uppercase tracking-wide text-white shadow-xl shadow-blue-950/40 transition hover:-translate-y-0.5 hover:bg-blue-500"
              >
                Explore courses
                <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/academy/library"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/35 bg-cyan-400/[0.06] px-6 py-4 text-sm font-extrabold italic uppercase tracking-wide text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-300/60 hover:bg-cyan-400/15"
              >
                Browse free videos
                <BookOpen className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-cyan-400/10 bg-[#09090B] py-12 sm:py-16">
        <div className="mx-auto grid w-full max-w-[1600px] gap-5 px-5 sm:px-8 md:grid-cols-3 lg:px-10 2xl:px-12">
          {courseBenefits.map((benefit) => {
            const Icon = benefit.icon;

            return (
              <article
                key={benefit.title}
                className={`border p-5 ${benefit.color}`}
              >
                <Icon className="h-6 w-6" />

                <h2 className="mt-5 text-lg font-black italic uppercase tracking-[-0.03em] text-slate-50">
                  {benefit.title}
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {benefit.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section
        id="course-directory"
        className="bg-[#131722] py-16 sm:py-24"
      >
        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300">
                Course directory
              </p>

              <h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
                Pick the next skill to build.
              </h2>

              <p className="mt-5 text-base leading-7 text-slate-400">
                Courses are currently being developed and will be released
                through public access, member access, and school or partner
                programs as they become available.
              </p>
            </div>

            <div className="inline-flex items-center gap-3 border border-amber-400/25 bg-amber-400/[0.08] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-100">
              <Sparkles className="h-4 w-4" />
              New courses in development
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {ACADEMY_COURSES.map((course) => (
              <AcademyCourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-cyan-400/10 bg-[#09090B] py-16 sm:py-24">
        <div className="mx-auto grid w-full max-w-[1600px] gap-6 px-5 sm:px-8 lg:grid-cols-3 lg:px-10 2xl:px-12">
          <article className="border border-[#34D399]/25 bg-[#131722] p-6 shadow-xl shadow-black/20">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#34D399]/12 text-[#34D399]">
              <CheckCircle2 className="h-5 w-5" />
            </span>

            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">
              Free access
            </p>

            <h2 className="mt-3 text-2xl font-black italic uppercase tracking-[-0.04em] text-slate-50">
              Start with open learning.
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              Free courses and public video resources give anyone a practical
              way to start building with MetaWork right away.
            </p>

            <Link
              href="/academy/library"
              className="group mt-7 inline-flex items-center gap-2 text-sm font-extrabold italic uppercase tracking-wide text-emerald-200 transition hover:text-emerald-100"
            >
              Open free library
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </article>

          <article className="border border-[#FBBF24]/25 bg-[#131722] p-6 shadow-xl shadow-black/20">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#FBBF24]/12 text-[#FBBF24]">
              <LockKeyhole className="h-5 w-5" />
            </span>

            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-amber-100">
              Member access
            </p>

            <h2 className="mt-3 text-2xl font-black italic uppercase tracking-[-0.04em] text-slate-50">
              Go deeper with membership.
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              Future member access can unlock advanced courses, projects,
              workshops, resources, and credit-supported Academy passes.
            </p>

            <Link
              href="/academy/library?access=members"
              className="group mt-7 inline-flex items-center gap-2 text-sm font-extrabold italic uppercase tracking-wide text-amber-100 transition hover:text-amber-50"
            >
              Preview member content
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </article>

          <article className="border border-blue-400/25 bg-[#131722] p-6 shadow-xl shadow-black/20">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500/12 text-blue-300">
              <School className="h-5 w-5" />
            </span>

            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-blue-300">
              School + partner access
            </p>

            <h2 className="mt-3 text-2xl font-black italic uppercase tracking-[-0.04em] text-slate-50">
              Bring courses to your program.
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              School and partner programs can eventually provide targeted
              courses, guided projects, learner access, and implementation
              support.
            </p>

            <Link
              href="/academy/programs"
              className="group mt-7 inline-flex items-center gap-2 text-sm font-extrabold italic uppercase tracking-wide text-blue-200 transition hover:text-blue-100"
            >
              Explore programs
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </article>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#131722] py-16 sm:py-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.13),transparent_28%),radial-gradient(circle_at_88%_85%,rgba(37,99,235,0.18),transparent_30%)]" />

        <div className="mx-auto w-full max-w-4xl px-5 text-center sm:px-8 lg:px-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[#2563EB] text-white shadow-xl shadow-blue-950/50">
            <GraduationCap className="h-7 w-7" />
          </span>

          <p className="mt-6 font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300">
            Academy courses
          </p>

          <h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
            Courses are being built now.
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400">
            Start with the free video library today. As new courses launch,
            MetaWork Academy will add structured lessons, practical projects,
            knowledge checks, progress tracking, and access options for
            members and partner programs.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/academy/library"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-3.5 text-sm font-extrabold italic uppercase tracking-wide text-white transition hover:-translate-y-0.5 hover:bg-blue-500"
            >
              Start with free videos
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href="/academy/programs"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/[0.06] px-5 py-3.5 text-sm font-extrabold italic uppercase tracking-wide text-cyan-100 transition hover:border-cyan-300/55 hover:bg-cyan-400/15"
            >
              Programs for educators
              <School className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}