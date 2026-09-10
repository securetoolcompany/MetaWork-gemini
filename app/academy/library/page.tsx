import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  GraduationCap,
  Play,
  Search,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';

import AcademyLibraryClient from '@/components/academy/AcademyLibraryClient.jsx';
import { getFeaturedVideos } from '@/lib/academy-data';

export const metadata = {
  title: 'Academy Library | MetaWork',
  description:
    'Browse MetaWork Academy videos for creators, students, educators, and school partners.',
};

const audiencePaths = [
  {
    id: 'creators',
    label: 'Creators',
    description: 'Build your brand, storefront, and revenue systems.',
    icon: Store,
    accent: 'border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-200',
  },
  {
    id: 'students',
    label: 'Students',
    description: 'Turn ideas into real-world skills and projects.',
    icon: Sparkles,
    accent: 'border-blue-400/30 bg-blue-500/[0.08] text-blue-200',
  },
  {
    id: 'educators',
    label: 'Educators',
    description: 'Bring creator commerce into your learning program.',
    icon: GraduationCap,
    accent: 'border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200',
  },
];

export default function AcademyLibraryPage() {
  const [featuredVideo] = getFeaturedVideos(1);
 
	return (
    <main className="min-h-screen overflow-hidden bg-[#131722] text-slate-50">
      <section className="relative isolate overflow-hidden border-b border-cyan-400/15 bg-[#131722]">
        <div className="absolute inset-0 -z-30 bg-[linear-gradient(120deg,#131722_0%,#101b33_50%,#071923_100%)]" />

        <div className="absolute inset-0 -z-20 opacity-[0.18] [background-image:linear-gradient(rgba(34,211,238,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.22)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />

        <div className="absolute -left-40 top-[-12rem] -z-10 h-[38rem] w-[38rem] rounded-full bg-cyan-400/20 blur-[140px]" />
        <div className="absolute right-[-12rem] top-[-14rem] -z-10 h-[44rem] w-[44rem] rounded-full bg-blue-600/30 blur-[150px]" />
        <div className="absolute bottom-[-24rem] left-[38%] -z-10 h-[36rem] w-[36rem] rounded-full bg-emerald-400/10 blur-[150px]" />

        <div className="relative mx-auto w-full max-w-[1600px] px-5 pb-10 pt-8 sm:px-8 sm:pb-12 sm:pt-10 lg:px-10 2xl:px-12">
          <Link
            href="/academy"
            className="group inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-cyan-200"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Return to Academy
          </Link>

          <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(500px,1.05fr)] xl:items-center">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 border border-cyan-400/35 bg-cyan-400/10 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.26em] text-cyan-200 shadow-lg shadow-cyan-950/25">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34D399] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34D399]" />
                </span>
                Academy Library // Active
              </div>

              <h1 className="mt-7 text-5xl font-black italic uppercase leading-[0.84] tracking-[-0.08em] text-slate-50 sm:text-6xl lg:text-7xl xl:text-8xl">
                Learn it.
                <span className="mt-3 block bg-gradient-to-r from-[#22D3EE] via-[#60A5FA] to-[#2563EB] bg-clip-text text-transparent">
                  Build it.
                </span>
                <span className="mt-3 block text-slate-50">Own it.</span>
              </h1>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                Real MetaWork workflows for building products, launching
                storefronts, protecting creative work, and turning knowledge
                into opportunity.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="#library-search"
                  className="group inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-5 py-3.5 text-sm font-extrabold italic uppercase tracking-wide text-white shadow-xl shadow-blue-950/40 transition hover:-translate-y-0.5 hover:bg-blue-500"
                >
                  Explore all lessons
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>

                <span className="inline-flex items-center gap-2 rounded-lg border border-[#34D399]/35 bg-[#34D399]/10 px-5 py-3.5 text-sm font-extrabold italic uppercase tracking-wide text-emerald-100">
									<span className="h-2 w-2 rounded-full bg-[#34D399]" />
									Featured lesson ready
								</span>
              </div>

              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 bg-[#22D3EE]" />
                  Creator systems
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 bg-[#2563EB]" />
                  Student pathways
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 bg-[#34D399]" />
                  Education programs
                </span>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-cyan-400/25 via-blue-500/20 to-emerald-400/10 blur-3xl" />

              <div className="relative overflow-hidden border border-cyan-400/30 bg-[#09090B]/90 shadow-2xl shadow-black/45 backdrop-blur">
                <div className="absolute inset-x-0 top-0 z-20 h-1 bg-gradient-to-r from-[#22D3EE] via-[#2563EB] to-[#34D399]" />

                <div className="relative aspect-video overflow-hidden bg-[#09090B]">
									{featuredVideo?.youtubeId ? (
										<iframe
											className="absolute inset-0 h-full w-full"
											src={`https://www.youtube-nocookie.com/embed/${featuredVideo.youtubeId}?rel=0&modestbranding=1&playsinline=1`}
											title={featuredVideo.title}
											allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
											allowFullScreen
										/>
									) : (
										<div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(34,211,238,0.20),_transparent_45%),linear-gradient(135deg,_#09090B,_#0a1d2a)]">
											<div className="text-center">
												<Play className="mx-auto h-10 w-10 text-cyan-300" />
												<p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
													Featured lesson loading
												</p>
											</div>
										</div>
									)}

								</div>

                <div className="grid grid-cols-3 border-t border-white/10">
                  <div className="border-r border-white/10 p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-slate-500">
                      Format
                    </p>
                    <p className="mt-1 text-sm font-extrabold italic uppercase tracking-wide text-cyan-200">
                      Tutorial
                    </p>
                  </div>

                  <div className="border-r border-white/10 p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-slate-500">
                      Access
                    </p>
                    <p className="mt-1 text-sm font-extrabold italic uppercase tracking-wide text-emerald-200">
                      Free
                    </p>
                  </div>

                  <div className="p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-slate-500">
                      Status
                    </p>
                    <p className="mt-1 text-sm font-extrabold italic uppercase tracking-wide text-blue-200">
                      Ready
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {audiencePaths.map((path) => {
              const Icon = path.icon;

              return (
                <Link
                  key={path.label}
                  href={`/academy/library?audience=${path.id}`}
                  className={`group flex items-center gap-4 border p-4 transition hover:-translate-y-1 hover:bg-white/[0.055] ${path.accent}`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#09090B]/70">
                    <Icon className="h-5 w-5" />
                  </span>

                  <div className="min-w-0">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-70">
                      Learning path
                    </p>
                    <h2 className="mt-1 text-base font-black italic uppercase tracking-[-0.025em] text-slate-50">
                      For {path.label}
                    </h2>
                    <p className="mt-1 truncate text-xs text-slate-300/80">
                      {path.description}
                    </p>
                  </div>

                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section id="library-search">
        <AcademyLibraryClient />
      </section>
    </main>
  );
}