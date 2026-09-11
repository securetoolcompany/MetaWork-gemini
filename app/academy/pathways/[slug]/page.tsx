import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  Clock3,
  Compass,
  GraduationCap,
  Layers3,
  PlayCircle,
  Sparkles,
  Users,
} from 'lucide-react';

import AcademyVideoCard from '@/components/academy/AcademyVideoCard';
import AcademyCourseCard from '@/components/academy/AcademyCourseCard';

import {
  getAcademyCoursesForPathway,
  getAcademyLessonsForPathway,
} from '@/lib/academy-selectors';

import {
  ACADEMY_PATHWAYS,
  getAcademyPathwayBySlug,
} from '@/lib/academy-pathways-data';

type PathwayPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function formatLabel(value = '') {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function generateStaticParams() {
  return ACADEMY_PATHWAYS.map((pathway) => ({
    slug: pathway.slug,
  }));
}

export async function generateMetadata({ params }: PathwayPageProps) {
  const { slug } = await params;
  const pathway = getAcademyPathwayBySlug(slug);

  if (!pathway) {
    return {
      title: 'Pathway Not Found | MetaWork Academy',
    };
  }

  return {
    title: `${pathway.title} Pathway | MetaWork Academy`,
    description: pathway.heroDescription,
  };
}

export default async function AcademyPathwayPage({
  params,
}: PathwayPageProps) {
  const { slug } = await params;
  const pathway = getAcademyPathwayBySlug(slug);

  if (!pathway) {
    notFound();
  }

  const recommendedVideos = getAcademyLessonsForPathway(pathway.slug);

	const relatedCourses = getAcademyCoursesForPathway(pathway.slug);

  return (
    <main className="min-h-screen overflow-hidden bg-[#131722] text-slate-50">
      <section className="relative isolate overflow-hidden border-b border-cyan-400/15 bg-[#131722]">
        <div className="absolute inset-0 -z-30 bg-[linear-gradient(120deg,#131722_0%,#111827_52%,#0a1821_100%)]" />

        <div className="absolute inset-0 -z-20 opacity-[0.16] [background-image:linear-gradient(rgba(34,211,238,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.22)_1px,transparent_1px)] [background-size:46px_46px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />

        <div
          className="absolute -left-40 top-[-14rem] -z-10 h-[40rem] w-[40rem] rounded-full blur-[145px]"
          style={{ backgroundColor: `${pathway.accent.primary}32` }}
        />

        <div
          className="absolute -right-40 -top-32 -z-10 h-[44rem] w-[44rem] rounded-full blur-[155px]"
          style={{ backgroundColor: `${pathway.accent.secondary}42` }}
        />

        <div className="relative mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10 2xl:px-12">
          <Link
            href="/academy"
            className="group inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-cyan-200"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Return to Academy
          </Link>

          <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] xl:items-end">
            <div>
              <div
                className="inline-flex items-center gap-2 border px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.24em] shadow-lg shadow-black/20"
                style={{
                  borderColor: `${pathway.accent.primary}66`,
                  backgroundColor: `${pathway.accent.primary}18`,
                  color: pathway.accent.primary,
                }}
              >
                <Compass className="h-3.5 w-3.5" />
                {pathway.eyebrow}
              </div>

              <h1 className="mt-7 max-w-5xl text-4xl font-black italic uppercase leading-[0.92] tracking-[-0.055em] text-slate-50 sm:text-6xl lg:text-7xl xl:text-8xl">
                {pathway.heroTitle}
              </h1>

              <p className="mt-8 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
                {pathway.heroDescription}
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                {pathway.audience.map((audience) => (
                  <span
                    key={audience}
                    className="border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-slate-200"
                  >
                    {formatLabel(audience)}
                  </span>
                ))}

                <span
                  className="border px-3 py-2 font-mono text-[9px] font-medium uppercase tracking-[0.15em]"
                  style={{
                    borderColor: `${pathway.accent.primary}66`,
                    backgroundColor: `${pathway.accent.primary}12`,
                    color: pathway.accent.primary,
                  }}
                >
                  {formatLabel(pathway.level)}
                </span>
              </div>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#pathway-map"
                  className="group inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-4 text-sm font-extrabold italic uppercase tracking-wide text-white shadow-xl shadow-blue-950/40 transition hover:-translate-y-0.5 hover:bg-blue-500"
                >
                  View mastery map
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>

                <a
                  href="#pathway-lessons"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/35 bg-cyan-400/[0.06] px-6 py-4 text-sm font-extrabold italic uppercase tracking-wide text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-300/60 hover:bg-cyan-400/15"
                >
                  Explore available lessons
                  <PlayCircle className="h-4 w-4" />
                </a>
              </div>
            </div>

            <aside
              className="border p-6 shadow-2xl shadow-black/35"
              style={{
                borderColor: `${pathway.accent.primary}55`,
                backgroundColor: '#09090B',
              }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-lg shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${pathway.accent.primary}, ${pathway.accent.secondary})`,
                  color: '#09090B',
                }}
              >
                <BadgeCheck className="h-6 w-6" />
              </span>

              <p
                className="mt-6 font-mono text-[10px] font-medium uppercase tracking-[0.22em]"
                style={{ color: pathway.accent.primary }}
              >
                Pathway outcome
              </p>

              <p className="mt-4 text-lg font-black italic uppercase leading-[1.05] tracking-[-0.035em] text-slate-50">
                {pathway.outcome}
              </p>

              <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5">
                <Clock3
                  className="h-5 w-5"
                  style={{ color: pathway.accent.primary }}
                />
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-slate-500">
                    Suggested starting commitment
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-200">
                    About {pathway.estimatedMinutes} minutes of available and
                    recommended learning.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section id="pathway-map" className="bg-[#131722] py-16 sm:py-24">
        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
          <div className="max-w-4xl">
            <p
              className="font-mono text-[10px] font-medium uppercase tracking-[0.25em]"
              style={{ color: pathway.accent.primary }}
            >
              Mastery map
            </p>

            <h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
              The path forward.
            </h2>

            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-400">
              This pathway organizes the subject into a practical progression.
              Start wherever your current knowledge makes sense, then use the
              map to identify the next skill or lesson to build.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {pathway.milestones.map((milestone) => (
              <article
                key={milestone.number}
                className="relative min-h-[270px] overflow-hidden border bg-[#09090B] p-6 shadow-xl shadow-black/20"
                style={{
                  borderColor: `${pathway.accent.primary}44`,
                }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{
                    background: `linear-gradient(90deg, ${pathway.accent.primary}, ${pathway.accent.secondary})`,
                  }}
                />

                <span
                  className="flex h-12 w-12 items-center justify-center rounded-lg font-mono text-sm font-black"
                  style={{
                    backgroundColor: `${pathway.accent.primary}18`,
                    color: pathway.accent.primary,
                  }}
                >
                  {milestone.number}
                </span>

                <p
                  className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em]"
                  style={{ color: pathway.accent.primary }}
                >
                  {milestone.label}
                </p>

                <h3 className="mt-3 text-2xl font-black italic uppercase tracking-[-0.04em] text-slate-50">
                  {milestone.title}
                </h3>

                <p className="mt-4 text-sm leading-7 text-slate-300">
                  {milestone.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

            <section
        id="pathway-lessons"
        className="border-y border-cyan-400/10 bg-[#09090B] py-16 sm:py-24"
      >
        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="max-w-4xl">
              <p
                className="font-mono text-[10px] font-medium uppercase tracking-[0.25em]"
                style={{ color: pathway.accent.primary }}
              >
                Available lessons
              </p>

              <h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
                Start with these.
              </h2>

              <p className="mt-5 text-base leading-7 text-slate-400">
                These free and available Academy lessons are the strongest
                immediate starting points for this pathway. More lessons,
                activities, and structured course content can be added as the
                Academy grows.
              </p>
            </div>

            <Link
              href={`/academy/library?section=${pathway.id}`}
              className="group inline-flex shrink-0 items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-300 transition hover:text-cyan-100"
            >
              Browse related library lessons
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {recommendedVideos.length > 0 ? (
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {recommendedVideos.map((video, index) => (
                <AcademyVideoCard
                  key={video.id}
                  video={video}
                  priority={index === 0}
                />
              ))}
            </div>
          ) : (
            <div className="mt-10 border border-dashed border-cyan-400/25 bg-[#131722] p-8 text-center">
              <BookOpen className="mx-auto h-9 w-9 text-cyan-300" />

              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
                Lessons are being added
              </p>

              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-300">
                This pathway is ready for structured learning content. Check
                the Academy Library for currently available resources.
              </p>

              <Link
                href="/academy/library"
                className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-300 transition hover:text-cyan-100"
              >
                Browse the Academy Library
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="bg-[#131722] py-16 sm:py-24">
        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
          <div className="max-w-4xl">
            <p
              className="font-mono text-[10px] font-medium uppercase tracking-[0.25em]"
              style={{ color: pathway.accent.primary }}
            >
              Structured course options
            </p>

            <h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
              Go deeper when you&apos;re ready.
            </h2>

            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-400">
              Pathways help identify the right direction. Courses package
              lessons, activity materials, teacher guidance, knowledge checks,
              and practical projects into a more structured learning experience.
            </p>
          </div>

          {relatedCourses.length > 0 ? (
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {relatedCourses.map((course) => (
                <AcademyCourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <div className="mt-10 border border-dashed border-cyan-400/25 bg-[#09090B] p-8 text-center">
              <GraduationCap className="mx-auto h-9 w-9 text-cyan-300" />

              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
                Course options are being prepared
              </p>

              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-300">
                There are no structured course recommendations assigned to this
                pathway yet. Explore the Academy Library for free lessons and
                practical starting points.
              </p>

              <Link
                href="/academy"
                className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-300 transition hover:text-cyan-100"
              >
                Return to Academy
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}