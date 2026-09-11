import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProgramEngagementOptions from '@/components/academy/ProgramEngagementOptions';
import GoogleBookingButton from '@/components/academy/GoogleBookingButton';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Handshake,
  Layers3,
  MonitorPlay,
  School,
  Sparkles,
  Users,
} from 'lucide-react';

import {
  ACADEMY_PROGRAMS,
  getAcademyProgramBySlug,
} from '@/lib/academy-programs-data';

type ProgramPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const PROGRAM_ICONS = {
  workshops: Sparkles,
  'curriculum-design': Layers3,
  'online-courses': MonitorPlay,
  'esa-programs': BookOpen,
  'school-partnerships': School,
  'cte-deca': GraduationCap,
};

export async function generateStaticParams() {
  return ACADEMY_PROGRAMS.map((program) => ({
    slug: program.slug,
  }));
}

export async function generateMetadata({ params }: ProgramPageProps) {
  const { slug } = await params;
  const program = getAcademyProgramBySlug(slug);

  if (!program) {
    return {
      title: 'Program Not Found | MetaWork Academy',
    };
  }

  return {
    title: `${program.title} | MetaWork Academy`,
    description: program.heroDescription,
  };
}

export default async function AcademyProgramPage({
  params,
}: ProgramPageProps) {
  const { slug } = await params;
  const program = getAcademyProgramBySlug(slug);

  if (!program) {
    notFound();
  }

  const Icon =
    PROGRAM_ICONS[program.slug as keyof typeof PROGRAM_ICONS] || Sparkles;

  return (
    <main className="min-h-screen overflow-hidden bg-[#131722] text-slate-50">
      {/* HERO */}
      <section className="relative isolate overflow-hidden border-b border-cyan-400/15 bg-[#131722]">
        <div className="absolute inset-0 -z-30 bg-[linear-gradient(120deg,#131722_0%,#111827_52%,#0a1821_100%)]" />

        <div className="absolute inset-0 -z-20 opacity-[0.16] [background-image:linear-gradient(rgba(34,211,238,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.22)_1px,transparent_1px)] [background-size:46px_46px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />

        <div
          className="absolute -left-40 top-[-14rem] -z-10 h-[40rem] w-[40rem] rounded-full blur-[145px]"
          style={{ backgroundColor: `${program.accent.primary}2E` }}
        />

        <div
          className="absolute -right-40 -top-32 -z-10 h-[44rem] w-[44rem] rounded-full blur-[155px]"
          style={{ backgroundColor: `${program.accent.secondary}3D` }}
        />

        <div className="relative mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10 2xl:px-12">
          <Link
            href="/academy/programs"
            className="group inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-cyan-200"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Return to programs
          </Link>

          <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1.18fr)_minmax(380px,0.82fr)] xl:items-end">
            <div>
              <div
                className="inline-flex items-center gap-2 border px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.24em] shadow-lg shadow-black/20"
                style={{
                  borderColor: `${program.accent.primary}66`,
                  backgroundColor: `${program.accent.primary}18`,
                  color: program.accent.primary,
                }}
              >
                <span className="relative flex h-2 w-2">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                    style={{ backgroundColor: program.accent.primary }}
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: program.accent.primary }}
                  />
                </span>
                {program.eyebrow}
              </div>

              <h1 className="mt-7 max-w-5xl text-5xl font-black italic uppercase leading-[0.86] tracking-[-0.075em] text-slate-50 sm:text-6xl lg:text-7xl xl:text-8xl">
                {program.heroTitle}
              </h1>

              <p className="mt-8 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
                {program.heroDescription}
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#start-a-conversation"
                  className="group inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-4 text-sm font-extrabold italic uppercase tracking-wide text-white shadow-xl shadow-blue-950/40 transition hover:-translate-y-0.5 hover:bg-blue-500"
                >
                  {program.ctaLabel}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
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

            <aside className="relative overflow-hidden border border-white/10 bg-[#09090B]/90 p-6 shadow-2xl shadow-black/35 backdrop-blur">
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{
                  background: `linear-gradient(90deg, ${program.accent.primary}, ${program.accent.secondary})`,
                }}
              />

              <span
                className="flex h-14 w-14 items-center justify-center rounded-lg shadow-xl"
                style={{
                  background: `linear-gradient(135deg, ${program.accent.primary}, ${program.accent.secondary})`,
                  color: '#09090B',
                }}
              >
                <Icon className="h-7 w-7" />
              </span>

              <p
                className="mt-6 font-mono text-[10px] font-medium uppercase tracking-[0.22em]"
                style={{ color: program.accent.primary }}
              >
                Best fit for
              </p>

              <div className="mt-4 space-y-3">
                {program.audience.map((item: string) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 border border-white/10 bg-white/[0.025] p-3"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{
                        backgroundColor: `${program.accent.primary}18`,
                        color: program.accent.primary,
                      }}
                    >
                      <Users className="h-4 w-4" />
                    </span>

                    <p className="text-sm font-medium text-slate-200">{item}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* WHAT THIS CAN UNLOCK */}
      <section className="bg-[#131722] py-16 sm:py-24">
        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
          <div className="max-w-4xl">
            <p
              className="font-mono text-[10px] font-medium uppercase tracking-[0.25em]"
              style={{ color: program.accent.primary }}
            >
              The opportunity
            </p>

            <h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
              What this can unlock.
            </h2>

            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
              MetaWork Academy is designed to make learning tangible. Rather
              than stopping at theory, this service gives participants a path
              toward practical projects, visible outcomes, and a clearer
              connection between learning, technology, entrepreneurship, and
              real-world opportunity.
            </p>
          </div>

          <div className="mt-12">
            <p
              className="font-mono text-[10px] font-medium uppercase tracking-[0.25em]"
              style={{ color: program.accent.primary }}
            >
              What participants can do
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {program.outcomes.map((outcome: string, index: number) => (
                <article
                  key={outcome}
                  className="relative min-h-[190px] overflow-hidden border border-white/10 bg-[#09090B] p-5 shadow-lg shadow-black/15"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-1"
                    style={{
                      background: `linear-gradient(90deg, ${program.accent.primary}, ${program.accent.secondary})`,
                    }}
                  />

                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: `${program.accent.primary}18`,
                      color: program.accent.primary,
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </span>

                  <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
                    Outcome {String(index + 1).padStart(2, '0')}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    {outcome}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="border border-white/10 bg-[#09090B] p-6 shadow-xl shadow-black/20">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-md"
                  style={{
                    backgroundColor: `${program.accent.primary}18`,
                    color: program.accent.primary,
                  }}
                >
                  <BadgeCheck className="h-5 w-5" />
                </span>

                <div>
                  <p
                    className="font-mono text-[10px] font-medium uppercase tracking-[0.22em]"
                    style={{ color: program.accent.primary }}
                  >
                    Ideal fit
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    Programs and learners who will get the most from this option.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {program.idealFor.map((item: string) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 border-l-2 bg-white/[0.025] p-3"
                    style={{ borderLeftColor: program.accent.primary }}
                  >
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: program.accent.primary }}
                    />
                    <p className="text-sm leading-6 text-slate-300">{item}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="border border-cyan-400/20 bg-[#09090B] p-6 shadow-xl shadow-black/20">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-md"
                  style={{
                    backgroundColor: `${program.accent.primary}18`,
                    color: program.accent.primary,
                  }}
                >
                  <Handshake className="h-5 w-5" />
                </span>

                <div>
                  <p
                    className="font-mono text-[10px] font-medium uppercase tracking-[0.22em]"
                    style={{ color: program.accent.primary }}
                  >
                    Program readiness
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    A simple, low-friction process to begin.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="flex gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: `${program.accent.primary}18`,
                      color: program.accent.primary,
                    }}
                  >
                    <Users className="h-4 w-4" />
                  </span>

                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
                      Start with
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">
                      A program contact, learner group, and a clear outcome.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: `${program.accent.primary}18`,
                      color: program.accent.primary,
                    }}
                  >
                    <Clock3 className="h-4 w-4" />
                  </span>

                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
                      Plan together
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">
                      Define scope, timing, delivery format, and starting option.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: `${program.accent.primary}18`,
                      color: program.accent.primary,
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                  </span>

                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
                      Scale later
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">
                      Begin small, then grow into a pilot or ongoing partnership.
                    </p>
                  </div>
                </div>
              </div>
            </article>
          </div>

          {program.disclaimer && (
            <div className="mt-5 border border-[#FBBF24]/30 bg-[#FBBF24]/[0.08] p-5">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-amber-100">
                Important information
              </p>
              <p className="mt-3 text-sm leading-6 text-amber-50/80">
                {program.disclaimer}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* WHAT YOUR PROGRAM RECEIVES */}
      <section className="border-y border-cyan-400/10 bg-[#09090B] py-16 sm:py-24">
        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
          <div className="max-w-3xl">
            <p
              className="font-mono text-[10px] font-medium uppercase tracking-[0.25em]"
              style={{ color: program.accent.primary }}
            >
              What your program receives
            </p>

            <h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
              Designed to be practical.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {program.deliverables.map((item: string, index: number) => (
              <article
                key={item}
                className="relative overflow-hidden border border-white/10 bg-[#131722] p-6"
              >
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: program.accent.primary }}
                />

                <span
                  className="flex h-10 w-10 items-center justify-center rounded-md"
                  style={{
                    backgroundColor: `${program.accent.primary}18`,
                    color: program.accent.primary,
                  }}
                >
                  <span className="font-mono text-xs font-bold">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </span>

                <p className="mt-5 text-sm leading-6 text-slate-200">{item}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* START WHERE IT MAKES SENSE */}
      <section className="relative overflow-hidden bg-[#131722] py-16 sm:py-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_20%,rgba(37,99,235,0.16),transparent_30%),radial-gradient(circle_at_10%_80%,rgba(34,211,238,0.10),transparent_28%)]" />

        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
          <div className="max-w-3xl">
            <p
              className="font-mono text-[10px] font-medium uppercase tracking-[0.25em]"
              style={{ color: program.accent.primary }}
            >
              Engagement models
            </p>

            <h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
              Start where it makes sense.
            </h2>

            <p className="mt-5 text-base leading-7 text-slate-400">
              Start with the scope that fits your current goals. Open each
              option to review duration, delivery format, participation
              requirements, included resources, and how investment is determined.
            </p>
          </div>

          <ProgramEngagementOptions
            formats={program.formats}
            accentPrimary={program.accent.primary}
            accentSecondary={program.accent.secondary}
          />
        </div>
      </section>

      {/* START A CONVERSATION */}
      <section
        id="start-a-conversation"
        className="relative overflow-hidden border-t border-cyan-400/15 bg-[#09090B] py-16 sm:py-24"
      >
        <div className="absolute inset-0 -z-10 opacity-[0.12] [background-image:linear-gradient(rgba(34,211,238,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.18)_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="mx-auto w-full max-w-4xl px-5 text-center sm:px-8 lg:px-10">
          <span
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg shadow-xl shadow-black/30"
            style={{
              background: `linear-gradient(135deg, ${program.accent.primary}, ${program.accent.secondary})`,
              color: '#09090B',
            }}
          >
            <Handshake className="h-7 w-7" />
          </span>

          <p
            className="mt-6 font-mono text-[10px] font-medium uppercase tracking-[0.25em]"
            style={{ color: program.accent.primary }}
          >
            Start a conversation
          </p>

          <h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
            Let&apos;s plan the right next step.
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400">
            Tell us about your learners, program goals, timeline, and the kind
            of experience you want to create. We can start with a conversation
            and identify the best first move together.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <GoogleBookingButton
							label={program.ctaLabel}
							className="inline-flex"
						/>
          </div>

          <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
						Choose a time that works for you
					</p>
        </div>
      </section>
    </main>
  );
}