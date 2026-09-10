import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LockKeyhole,
  Play,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
} from 'lucide-react';

import AcademyVideoCard from '@/components/academy/AcademyVideoCard';
import {
  ACADEMY_VIDEOS,
  getSectionById,
} from '@/lib/academy-data';

type VideoPageProps = {
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

function getVideoBySlug(slug: string) {
  return ACADEMY_VIDEOS.find((video) => video.slug === slug);
}

function getAdjacentVideos(currentVideoId: string) {
  const publicVideos = ACADEMY_VIDEOS.filter(
    (video) => video.accessLevel === 'public'
  );

  const currentIndex = publicVideos.findIndex(
    (video) => video.id === currentVideoId
  );

  return {
    previous:
      currentIndex > 0 ? publicVideos[currentIndex - 1] : null,
    next:
      currentIndex >= 0 && currentIndex < publicVideos.length - 1
        ? publicVideos[currentIndex + 1]
        : null,
  };
}

function getRelatedVideos(currentVideoId: string, sectionId: string) {
  const sameSection = ACADEMY_VIDEOS.filter(
    (video) =>
      video.id !== currentVideoId &&
      video.sectionId === sectionId &&
      video.accessLevel === 'public'
  );

  const fallback = ACADEMY_VIDEOS.filter(
    (video) =>
      video.id !== currentVideoId &&
      video.accessLevel === 'public' &&
      video.sectionId !== sectionId
  );

  return [...sameSection, ...fallback].slice(0, 3);
}

export async function generateMetadata({ params }: VideoPageProps) {
  const { slug } = await params;
  const video = getVideoBySlug(slug);

  if (!video) {
    return {
      title: 'Video Not Found | MetaWork Academy',
    };
  }

  return {
    title: `${video.title} | MetaWork Academy`,
    description: video.description,
  };
}

export default async function AcademyVideoPage({ params }: VideoPageProps) {
  const { slug } = await params;
  const video = getVideoBySlug(slug);

  if (!video) {
    notFound();
  }

  const section = getSectionById(video.sectionId);
  const isLocked = video.accessLevel !== 'public';
  const relatedVideos = getRelatedVideos(video.id, video.sectionId);
  const { previous, next } = getAdjacentVideos(video.id);

  return (
    <main className="min-h-screen overflow-hidden bg-[#131722] text-slate-50">
      <section className="relative isolate overflow-hidden border-b border-cyan-400/15 bg-[#131722]">
        <div className="absolute inset-0 -z-30 bg-[linear-gradient(120deg,#131722_0%,#111827_52%,#0a1821_100%)]" />

        <div className="absolute inset-0 -z-20 opacity-[0.14] [background-image:linear-gradient(rgba(34,211,238,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.22)_1px,transparent_1px)] [background-size:46px_46px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />

        <div className="absolute -left-44 top-[-16rem] -z-10 h-[40rem] w-[40rem] rounded-full bg-cyan-400/16 blur-[145px]" />
        <div className="absolute -right-40 -top-32 -z-10 h-[44rem] w-[44rem] rounded-full bg-blue-600/25 blur-[150px]" />

        <div className="relative mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10 2xl:px-12">
          <Link
            href="/academy/library"
            className="group inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-cyan-200"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Return to library
          </Link>

          <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)] xl:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 border border-cyan-400/35 bg-cyan-400/10 px-3 py-2 font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-cyan-200">
                  <BookOpen className="h-3.5 w-3.5" />
                  {section?.title || 'MetaWork Academy'}
                </span>

                {isLocked ? (
                  <span className="inline-flex items-center gap-2 border border-[#FBBF24]/35 bg-[#FBBF24]/10 px-3 py-2 font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-amber-100">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Member access
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 border border-[#34D399]/35 bg-[#34D399]/10 px-3 py-2 font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-emerald-100">
                    <span className="h-2 w-2 rounded-full bg-[#34D399]" />
                    Free access
                  </span>
                )}
              </div>

              <h1 className="mt-6 max-w-5xl text-4xl font-black italic uppercase leading-[0.9] tracking-[-0.065em] text-slate-50 sm:text-5xl lg:text-6xl xl:text-7xl">
                {video.title}
              </h1>

              <p className="mt-6 max-w-4xl text-lg leading-8 text-slate-300">
                {video.description}
              </p>
            </div>

            <aside className="border border-cyan-400/20 bg-[#09090B]/80 p-5 shadow-xl shadow-black/25 backdrop-blur">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300">
                Lesson information
              </p>

              <div className="mt-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-cyan-400/10 text-cyan-300">
                    <Tag className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
                      Format
                    </p>
                    <p className="mt-0.5 text-sm font-extrabold italic uppercase tracking-wide text-slate-100">
                      {formatLabel(video.format)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-300">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
                      Skill level
                    </p>
                    <p className="mt-0.5 text-sm font-extrabold italic uppercase tracking-wide text-slate-100">
                      {formatLabel(video.level)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-300">
                    <Clock3 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
                      Duration
                    </p>
                    <p className="mt-0.5 text-sm font-extrabold italic uppercase tracking-wide text-slate-100">
                      {video.durationLabel || 'MetaWork lesson'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-400/10 text-amber-200">
                    <Users className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
                      Built for
                    </p>
                    <p className="mt-0.5 text-sm font-extrabold italic uppercase tracking-wide text-slate-100">
                      {video.audiences.map(formatLabel).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="relative bg-[#131722] py-10 sm:py-14">
        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
          <div className="grid gap-10 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)] xl:items-start">
            <div>
              <div className="relative overflow-hidden border border-cyan-400/25 bg-[#09090B] shadow-2xl shadow-black/40">
                <div className="absolute inset-x-0 top-0 z-20 h-1 bg-gradient-to-r from-[#22D3EE] via-[#2563EB] to-[#34D399]" />

                <div className="relative aspect-video bg-[#09090B]">
                  {isLocked ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.15),_transparent_35%),linear-gradient(135deg,_#09090B,_#131722)] p-6">
                      <div className="max-w-lg text-center">
                        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg border border-[#FBBF24]/35 bg-[#FBBF24]/10 text-[#FBBF24]">
                          <LockKeyhole className="h-8 w-8" />
                        </span>

                        <p className="mt-6 font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-amber-200">
                          Member lesson
                        </p>

                        <h2 className="mt-3 text-2xl font-black italic uppercase tracking-[-0.04em] text-slate-50 sm:text-3xl">
                          Unlock this learning path.
                        </h2>

                        <p className="mt-4 text-sm leading-6 text-slate-400">
                          This content is reserved for Academy members, approved
                          participants, and school or partner accounts.
                        </p>

                        <Link
                          href="/academy/library?access=members"
                          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#FBBF24] px-5 py-3 text-sm font-extrabold italic uppercase tracking-wide text-[#09090B] transition hover:bg-amber-300"
                        >
                          Preview membership
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  ) : video.youtubeId ? (
                    <iframe
                      className="absolute inset-0 h-full w-full"
                      src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?rel=0&modestbranding=1&playsinline=1`}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(34,211,238,0.18),_transparent_42%),linear-gradient(135deg,_#09090B,_#131722)] p-6">
                      <div className="text-center">
                        <Play className="mx-auto h-12 w-12 text-cyan-300" />
                        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
                          Lesson coming soon
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {previous ? (
                  <Link
                    href={`/academy/library/${previous.slug}`}
                    className="group inline-flex items-center gap-2 border border-white/10 bg-[#09090B] px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-slate-300 transition hover:border-cyan-400/35 hover:text-cyan-200"
                  >
                    <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    Previous lesson
                  </Link>
                ) : (
                  <span className="hidden sm:block" />
                )}

                {next ? (
                  <Link
                    href={`/academy/library/${next.slug}`}
                    className="group inline-flex items-center gap-2 border border-cyan-400/25 bg-cyan-400/[0.07] px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200 transition hover:border-cyan-300/50 hover:bg-cyan-400/15"
                  >
                    Next lesson
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </div>

              <div className="mt-10 border-t border-white/10 pt-10">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-cyan-300">
                  What you&apos;ll learn
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {video.learningOutcomes?.map((outcome: string, index: number) => (
                    <div
                      key={outcome}
                      className="flex gap-3 border border-white/10 bg-[#09090B] p-4"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#34D399]/15 text-[#34D399]">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>

                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-slate-500">
                          Outcome {String(index + 1).padStart(2, '0')}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-200">
                          {outcome}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-10 border-t border-white/10 pt-10">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-cyan-300">
                  Topics in this lesson
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {video.topics.map((topic: string) => (
                    <Link
                      key={topic}
                      href={`/academy/library?topic=${topic}`}
                      className="border border-cyan-400/25 bg-cyan-400/[0.06] px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200 transition hover:border-cyan-300/55 hover:bg-cyan-400/14"
                    >
                      {formatLabel(topic)}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <aside className="xl:sticky xl:top-8">
              <div className="border border-white/10 bg-[#09090B] p-6 shadow-xl shadow-black/20">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#2563EB] text-white shadow-lg shadow-blue-950/50">
                  <ShieldCheck className="h-5 w-5" />
                </span>

                <p className="mt-5 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-blue-300">
                  Continue learning
                </p>

                <h2 className="mt-3 text-2xl font-black italic uppercase leading-[0.95] tracking-[-0.04em] text-slate-50">
                  Build your MetaWork skill stack.
                </h2>

                <p className="mt-4 text-sm leading-6 text-slate-400">
                  Explore the full library to move from foundational workflows
                  into storefronts, IP, payouts, partnerships, and deeper
                  Academy content.
                </p>

                <Link
                  href="/academy/library"
                  className="group mt-6 inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-3 text-sm font-extrabold italic uppercase tracking-wide text-white transition hover:bg-blue-500"
                >
                  Browse all lessons
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {relatedVideos.length > 0 && (
        <section className="border-t border-cyan-400/10 bg-[#09090B] py-16 sm:py-20">
          <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-cyan-300">
                  Keep building
                </p>
                <h2 className="mt-3 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
                  Related lessons
                </h2>
              </div>

              <Link
                href="/academy/library"
                className="group inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-300 transition hover:text-cyan-100"
              >
                Open full library
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {relatedVideos.map((relatedVideo) => (
                <AcademyVideoCard
                  key={relatedVideo.id}
                  video={relatedVideo}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}