import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Handshake,
  Layers3,
  MonitorPlay,
  School,
  Sparkles,
} from 'lucide-react';

import { ACADEMY_PROGRAMS } from '@/lib/academy-programs-data';

export const metadata = {
  title: 'Programs & Partnerships | MetaWork Academy',
  description:
    'Explore MetaWork Academy workshops, curriculum design, online courses, ESA programs, school partnerships, and CTE/DECA support.',
};

const PROGRAM_ICONS = {
  workshops: Sparkles,
  'curriculum-design': Layers3,
  'online-courses': MonitorPlay,
  'esa-programs': BookOpen,
  'school-partnerships': School,
  'cte-deca': GraduationCap,
};

export default function AcademyProgramsPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#131722] text-slate-50">
      <section className="relative isolate overflow-hidden border-b border-cyan-400/15 bg-[#131722]">
        <div className="absolute inset-0 -z-30 bg-[linear-gradient(120deg,#131722_0%,#111827_52%,#0a1821_100%)]" />

        <div className="absolute inset-0 -z-20 opacity-[0.16] [background-image:linear-gradient(rgba(34,211,238,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.22)_1px,transparent_1px)] [background-size:46px_46px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />

        <div className="absolute -left-40 top-[-12rem] -z-10 h-[38rem] w-[38rem] rounded-full bg-cyan-400/18 blur-[140px]" />
        <div className="absolute -right-32 top-[-12rem] -z-10 h-[42rem] w-[42rem] rounded-full bg-blue-600/25 blur-[150px]" />
        <div className="absolute bottom-[-22rem] left-[40%] -z-10 h-[34rem] w-[34rem] rounded-full bg-emerald-400/10 blur-[150px]" />

        <div className="relative mx-auto w-full max-w-[1600px] px-5 py-16 sm:px-8 sm:py-24 lg:px-10 2xl:px-12">
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-2 border border-cyan-400/35 bg-cyan-400/10 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34D399] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34D399]" />
              </span>
              MetaWork Academy // Programs
            </div>

            <h1 className="mt-7 text-5xl font-black italic uppercase leading-[0.86] tracking-[-0.075em] text-slate-50 sm:text-6xl lg:text-7xl xl:text-8xl">
              Build opportunity
              <span className="mt-3 block bg-gradient-to-r from-[#22D3EE] via-[#60A5FA] to-[#2563EB] bg-clip-text text-transparent">
                into the program.
              </span>
            </h1>

            <p className="mt-8 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
              MetaWork Academy brings practical creator commerce, product
              development, entrepreneurship, digital ownership, and
              career-connected learning into classrooms, communities, and
              learner pathways.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#program-directory"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-4 text-sm font-extrabold italic uppercase tracking-wide text-white shadow-xl shadow-blue-950/40 transition hover:-translate-y-0.5 hover:bg-blue-500"
              >
                Explore programs
                <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/academy/library"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/35 bg-cyan-400/[0.06] px-6 py-4 text-sm font-extrabold italic uppercase tracking-wide text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-300/60 hover:bg-cyan-400/15"
              >
                Explore Academy Library
                <BookOpen className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="program-directory" className="bg-[#131722] py-16 sm:py-24">
        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300">
                Program directory
              </p>

              <h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
                Choose the right starting point.
              </h2>

              <p className="mt-5 text-base leading-7 text-slate-400">
                Start with one workshop, build a classroom project, develop a
                curriculum layer, or plan an ongoing partnership. Each option
                can become the first step toward broader student access later.
              </p>
            </div>

            <div className="inline-flex items-center gap-3 border border-emerald-400/25 bg-emerald-400/[0.08] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-200">
              <Handshake className="h-4 w-4" />
              Partnership planning available
            </div>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {ACADEMY_PROGRAMS.map((program) => {
              const Icon =
                PROGRAM_ICONS[
                  program.slug as keyof typeof PROGRAM_ICONS
                ] || Sparkles;

              return (
                <Link
                  key={program.slug}
                  href={`/academy/programs/${program.slug}`}
                  className="group relative isolate min-h-[330px] overflow-hidden border border-white/10 bg-[#09090B] p-6 shadow-xl shadow-black/20 transition duration-300 hover:-translate-y-2 hover:border-cyan-400/45"
                >
                  <div
                    className="absolute inset-0 -z-20 opacity-90"
                    style={{
                      background: `radial-gradient(circle at top right, ${program.accent.primary}33, transparent 38%), linear-gradient(135deg, #09090B 0%, #09090B 72%, ${program.accent.secondary}16 100%)`,
                    }}
                  />

                  <div
                    className="absolute inset-x-0 top-0 h-1"
                    style={{
                      background: `linear-gradient(90deg, ${program.accent.primary}, ${program.accent.secondary})`,
                    }}
                  />

                  <div className="flex items-start justify-between gap-4">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-lg shadow-xl"
                      style={{
                        background: `linear-gradient(135deg, ${program.accent.primary}, ${program.accent.secondary})`,
                        color: '#09090B',
                      }}
                    >
                      <Icon className="h-6 w-6" />
                    </span>

                    <span
                      className="border px-2.5 py-1 font-mono text-[9px] font-medium uppercase tracking-[0.16em]"
                      style={{
                        borderColor: `${program.accent.primary}66`,
                        color: program.accent.primary,
                        backgroundColor: `${program.accent.primary}12`,
                      }}
                    >
                      Academy service
                    </span>
                  </div>

                  <p
                    className="mt-7 font-mono text-[10px] uppercase tracking-[0.24em]"
                    style={{ color: program.accent.primary }}
                  >
                    {program.eyebrow.replace('MetaWork Academy // ', '')}
                  </p>

                  <h3 className="mt-3 text-2xl font-black italic uppercase leading-none tracking-[-0.045em] text-slate-50">
                    {program.title}
                  </h3>

                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    {program.heroDescription}
                  </p>

                  <div
                    className="mt-7 inline-flex items-center gap-2 text-sm font-extrabold italic uppercase tracking-wide"
                    style={{ color: program.accent.primary }}
                  >
                    Explore service
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}