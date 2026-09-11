import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  BookOpenCheck,
  GraduationCap,
  Handshake,
  Landmark,
  MonitorPlay,
  Presentation,
  ShieldCheck,
  Sparkles,
  Store,
  Wallet,
} from 'lucide-react';

import AcademyVideoCard from '@/components/academy/AcademyVideoCard';
import GoogleBookingButton from '@/components/academy/GoogleBookingButton';
import {
  ACADEMY_SECTIONS,
  ACADEMY_SERVICES,
  getFeaturedVideos,
} from '@/lib/academy-data';

export const metadata = {
  title: 'MetaWork Academy',
  description:
    'Practical learning for creators, students, educators, and school partners.',
};

const ICONS = {
  Sparkles,
  Store,
  ShieldCheck,
  Wallet,
  GraduationCap,
  Presentation,
  BookOpenCheck,
  MonitorPlay,
  Landmark,
  Handshake,
  BadgeCheck,
};

function IconFor({
  name,
  className,
}: {
  name: keyof typeof ICONS | string;
  className?: string;
}) {
  const Icon = ICONS[name as keyof typeof ICONS] || Sparkles;
  return <Icon className={className} />;
}

const serviceThemes = [
  {
    gradient: 'from-cyan-400/25 via-cyan-400/10 to-blue-600/10',
    icon: 'from-[#22D3EE] to-[#2563EB]',
    border: 'hover:border-cyan-400/55',
    label: 'text-cyan-200',
    line: 'bg-[#22D3EE]',
  },
  {
    gradient: 'from-blue-500/25 via-blue-500/10 to-indigo-600/10',
    icon: 'from-[#60A5FA] to-[#2563EB]',
    border: 'hover:border-blue-400/55',
    label: 'text-blue-200',
    line: 'bg-[#2563EB]',
  },
  {
    gradient: 'from-emerald-400/25 via-emerald-400/10 to-teal-600/10',
    icon: 'from-[#34D399] to-teal-500',
    border: 'hover:border-emerald-400/55',
    label: 'text-emerald-200',
    line: 'bg-[#34D399]',
  },
  {
    gradient: 'from-amber-400/25 via-amber-400/10 to-orange-600/10',
    icon: 'from-[#FBBF24] to-orange-500',
    border: 'hover:border-amber-300/55',
    label: 'text-amber-100',
    line: 'bg-[#FBBF24]',
  },
  {
    gradient: 'from-sky-400/25 via-blue-400/10 to-cyan-600/10',
    icon: 'from-sky-300 to-[#22D3EE]',
    border: 'hover:border-sky-400/55',
    label: 'text-sky-200',
    line: 'bg-sky-400',
  },
  {
    gradient: 'from-indigo-400/25 via-indigo-400/10 to-blue-700/10',
    icon: 'from-indigo-300 to-[#2563EB]',
    border: 'hover:border-indigo-400/55',
    label: 'text-indigo-200',
    line: 'bg-indigo-400',
  },
];

const roadmapSteps = [
  {
    number: '01',
    label: 'Pick a mission',
    title: 'Choose your pathway',
    description:
      'Start with the skills, audience, or real-world goal that matters most.',
    badge: 'bg-[#22D3EE] text-[#09090B]',
    panel: 'border-cyan-400/30 bg-cyan-400/[0.08]',
    labelColor: 'text-cyan-300',
  },
  {
    number: '02',
    label: 'Build skills',
    title: 'Learn by doing',
    description:
      'Use practical videos, guided resources, and real MetaWork workflows.',
    badge: 'bg-[#2563EB] text-white',
    panel: 'border-blue-400/30 bg-blue-500/[0.08]',
    labelColor: 'text-blue-300',
  },
  {
    number: '03',
    label: 'Create outcomes',
    title: 'Put it to work',
    description:
      'Build projects, products, storefronts, and opportunities you can show.',
    badge: 'bg-[#34D399] text-[#09090B]',
    panel: 'border-emerald-400/30 bg-emerald-400/[0.08]',
    labelColor: 'text-emerald-300',
  },
];

export default function AcademyPage() {
  const featuredVideos = getFeaturedVideos(3);

  return (
    <main className="min-h-screen overflow-hidden bg-[#131722] text-slate-50">
      {/* HERO */}
      <section className="relative isolate overflow-hidden border-b border-cyan-400/15 bg-[#131722]">
        <div className="absolute inset-0 -z-30 bg-[linear-gradient(120deg,#131722_0%,#111827_52%,#0a1821_100%)]" />

        <div className="absolute inset-0 -z-20 opacity-[0.16] [background-image:linear-gradient(rgba(34,211,238,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.22)_1px,transparent_1px)] [background-size:46px_46px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />

        <div className="absolute -left-40 top-4 -z-10 h-[34rem] w-[34rem] rounded-full bg-cyan-400/15 blur-[120px]" />
        <div className="absolute -right-40 -top-28 -z-10 h-[42rem] w-[42rem] rounded-full bg-blue-600/25 blur-[140px]" />
        <div className="absolute bottom-[-20rem] left-[30%] -z-10 h-[34rem] w-[34rem] rounded-full bg-emerald-400/10 blur-[140px]" />

        <div className="mx-auto w-full max-w-[1600px] px-5 pb-20 pt-16 sm:px-8 sm:pb-24 sm:pt-24 lg:px-10 lg:pb-28 2xl:px-12">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.18fr)_minmax(430px,0.82fr)] xl:gap-16">
            <div>
              <div className="inline-flex items-center gap-2 border border-cyan-400/35 bg-cyan-400/10 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.26em] text-cyan-200 shadow-lg shadow-cyan-950/25">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34D399] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34D399]" />
                </span>
                MetaWork Academy // Online
              </div>

              <h1 className="mt-7 max-w-5xl text-5xl font-black italic uppercase leading-[0.86] tracking-[-0.075em] text-slate-50 sm:text-6xl lg:text-7xl xl:text-8xl">
                Learn the tools.
                <span className="mt-3 block bg-gradient-to-r from-[#22D3EE] via-[#60A5FA] to-[#2563EB] bg-clip-text text-transparent">
                  Build what&apos;s next.
                </span>
              </h1>

              <p className="mt-8 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
                Practical learning for creators, students, educators, and
                school partners building real products, brands, storefronts,
                ownership systems, and entrepreneurial opportunities.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/academy/library"
                  className="group inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-4 text-sm font-extrabold italic uppercase tracking-wide text-white shadow-xl shadow-blue-950/40 transition hover:-translate-y-0.5 hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:ring-offset-2 focus-visible:ring-offset-[#131722]"
                >
                  Explore free videos
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>

                <Link
                  href="/academy/programs"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/35 bg-cyan-400/[0.06] px-6 py-4 text-sm font-extrabold italic uppercase tracking-wide text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-300/60 hover:bg-cyan-400/15"
                >
                  Programs for educators
                  <BookOpen className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-11 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="border-l-2 border-[#22D3EE] bg-[#09090B]/85 p-4 shadow-lg shadow-black/15">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">
                    Learn
                  </p>
                  <p className="mt-2 text-sm font-extrabold italic uppercase tracking-wide text-slate-100">
                    Real workflows
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Practical lessons built around tools you can actually use.
                  </p>
                </div>

                <div className="border-l-2 border-[#2563EB] bg-[#09090B]/85 p-4 shadow-lg shadow-black/15">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-blue-300">
                    Build
                  </p>
                  <p className="mt-2 text-sm font-extrabold italic uppercase tracking-wide text-slate-100">
                    Visible outcomes
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Turn learning into projects, products, and progress.
                  </p>
                </div>

                <div className="border-l-2 border-[#34D399] bg-[#09090B]/85 p-4 shadow-lg shadow-black/15">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">
                    Grow
                  </p>
                  <p className="mt-2 text-sm font-extrabold italic uppercase tracking-wide text-slate-100">
                    Real opportunity
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Build skills that connect to commerce and career paths.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[600px] lg:max-w-none">
              <div className="absolute -inset-4 bg-gradient-to-br from-cyan-400/25 via-blue-600/20 to-emerald-400/10 blur-3xl" />

              <div className="relative overflow-hidden border border-cyan-400/25 bg-[#09090B]/90 p-5 shadow-2xl shadow-black/40 backdrop-blur sm:p-7">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#22D3EE] via-[#2563EB] to-[#34D399]" />

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300">
                      Academy roadmap
                    </p>
                    <h2 className="mt-3 text-2xl font-black italic uppercase tracking-[-0.045em] text-slate-50">
                      From first step to real output.
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Learn something useful. Build something real. Keep going.
                    </p>
                  </div>

                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#2563EB] text-white shadow-lg shadow-blue-950/50">
                    <Sparkles className="h-5 w-5" />
                  </span>
                </div>

                <div className="relative mt-8 space-y-4 before:absolute before:left-[1.35rem] before:top-8 before:h-[calc(100%-4rem)] before:w-px before:bg-gradient-to-b before:from-[#22D3EE] before:via-[#2563EB] before:to-[#34D399]">
                  {roadmapSteps.map((step) => (
                    <div
                      key={step.number}
                      className={`relative flex gap-4 border p-4 transition hover:translate-x-1 ${step.panel}`}
                    >
                      <span
                        className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-sm font-black shadow-lg ${step.badge}`}
                      >
                        {step.number}
                      </span>

                      <div className="pt-0.5">
                        <p
                          className={`font-mono text-[9px] uppercase tracking-[0.22em] ${step.labelColor}`}
                        >
                          {step.label}
                        </p>
                        <h3 className="mt-1 font-extrabold italic uppercase tracking-wide text-slate-50">
                          {step.title}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-slate-300/80">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/academy/library"
                  className="group mt-7 inline-flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.18em] text-cyan-300 transition hover:text-cyan-100"
                >
                  Start with a free lesson
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PATHWAYS */}
      <section className="border-y border-cyan-400/10 bg-[#131722] py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300">
              Academy pathways
            </p>

            <h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
              Choose your mission.
            </h2>

            <p className="mt-5 text-base leading-7 text-slate-400">
              Pathways are guided maps to mastery. Choose a subject area, see
              the skills and lessons available, and build toward deeper
              learning, projects, and future member-only courses.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {ACADEMY_SECTIONS.map((section) => (
              <Link
                key={section.id}
                href={`/academy/pathways/${section.slug}`}
                className="group relative isolate min-h-[270px] overflow-hidden border border-white/10 bg-[#09090B] p-6 shadow-xl shadow-black/20 transition duration-300 hover:-translate-y-2 hover:border-cyan-400/45"
              >
                <div
                  className={`absolute inset-0 -z-20 bg-gradient-to-br ${section.accent} opacity-[0.16] transition duration-500 group-hover:opacity-[0.28]`}
                />

                <div className="absolute right-0 top-0 h-full w-[2px] bg-gradient-to-b from-transparent via-cyan-300/60 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />

                <div
                  className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${section.accent}`}
                />

                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${section.accent} shadow-xl`}
                  >
                    <IconFor
                      name={section.icon}
                      className="h-6 w-6 text-white"
                    />
                  </span>

                  <span className="border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-cyan-200">
                    Academy pathway
                  </span>
                </div>

                <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500">
                  Mastery map
                </p>

                <h3 className="mt-2 text-2xl font-black italic uppercase leading-none tracking-[-0.045em] text-slate-50">
                  {section.title}
                </h3>

                <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
                  {section.description}
                </p>

                <div className="mt-7 inline-flex items-center gap-2 text-sm font-extrabold italic uppercase tracking-wide text-cyan-200">
                  View the map
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-4 border border-cyan-400/20 bg-cyan-400/[0.05] p-5 sm:flex-row sm:items-center sm:justify-between">
						<p className="max-w-3xl text-sm leading-6 text-slate-300">
							Each pathway includes a mastery map, recommended free lessons, and related
							Academy course options—so learners can start small and build toward a
							deeper goal.
						</p>

						<Link
							href="/academy/library"
							className="group inline-flex shrink-0 items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-200 transition hover:text-cyan-100"
						>
							Browse all lessons
							<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
						</Link>
					</div>
        </div>
      </section>

      {/* PROGRAMS */}
      <section id="programs" className="relative overflow-hidden py-16 sm:py-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_20%,rgba(37,99,235,0.17),transparent_30%),radial-gradient(circle_at_10%_80%,rgba(34,211,238,0.10),transparent_28%)]" />

        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.4fr)] xl:gap-16">
            <div className="lg:sticky lg:top-8 lg:h-fit">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-blue-300">
                Programs + partnerships
              </p>

              <h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
                Build opportunity into the program.
              </h2>

              <p className="mt-6 text-base leading-7 text-slate-400">
                MetaWork Academy supports workshops, curriculum design, school
                partnerships, entrepreneurship programs, CTE pathways, DECA
                activities, and career-connected learning.
              </p>

              <p className="mt-5 text-sm leading-6 text-slate-500">
                For educators, advisors, school leaders, community programs,
                and partners ready to explore a practical next step.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/academy/programs"
                  className="group inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-3.5 text-sm font-extrabold italic uppercase tracking-wide text-white transition hover:-translate-y-0.5 hover:bg-blue-500"
                >
                  Compare program options
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>

                <a
                  href="#partner-with-us"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-400/40 bg-blue-500/10 px-5 py-3.5 text-sm font-extrabold italic uppercase tracking-wide text-blue-100 transition hover:-translate-y-0.5 hover:border-blue-300/70 hover:bg-blue-500/20"
                >
                  Plan a partnership
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {ACADEMY_SERVICES.map((service, index) => {
                const theme = serviceThemes[index % serviceThemes.length];

                return (
									<Link
										key={service.title}
										href={`/academy/programs/${service.slug}`}
										className={`group relative isolate min-h-[230px] overflow-hidden border border-white/10 bg-[#09090B] p-6 shadow-xl shadow-black/20 transition duration-300 hover:-translate-y-1 ${theme.border}`}
									>
										<div
											className={`absolute inset-0 -z-20 bg-gradient-to-br ${theme.gradient} opacity-80 transition duration-500 group-hover:opacity-100`}
										/>

										<div
											className={`absolute inset-x-0 top-0 h-1 ${theme.line}`}
										/>

										<div className="absolute -right-10 -top-10 -z-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

										<span
											className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${theme.icon} shadow-lg`}
										>
											<IconFor
												name={service.icon}
												className="h-6 w-6 text-[#09090B]"
											/>
										</span>

										<p
											className={`mt-6 font-mono text-[9px] font-medium uppercase tracking-[0.22em] ${theme.label}`}
										>
											Academy service
										</p>

										<h3 className="mt-2 text-xl font-black italic uppercase leading-none tracking-[-0.035em] text-slate-50">
											{service.title}
										</h3>

										<p className="mt-4 text-sm leading-6 text-slate-300">
											{service.description}
										</p>

										<span
											className={`mt-6 inline-flex items-center gap-2 text-sm font-extrabold italic uppercase tracking-wide ${theme.label}`}
										>
											Learn more
											<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
										</span>
									</Link>
								);
              })}
            </div>
          </div>
        </div>
      </section>

      {/* FREE VIDEOS */}
      <section className="border-y border-cyan-400/10 bg-[#09090B] py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="max-w-3xl">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-[#34D399]">
                Free tools // Start now
              </p>

              <h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
                Get moving today.
              </h2>

              <p className="mt-5 text-base leading-7 text-slate-400">
                No enrollment required. Pick a practical MetaWork task, watch a
                free walkthrough, and start building right away.
              </p>
            </div>

            <Link
              href="/academy/library"
              className="group inline-flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.18em] text-cyan-300 transition hover:text-cyan-100"
            >
              Browse the full free library
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {featuredVideos.map((video, index) => (
              <AcademyVideoCard
                key={video.id}
                video={video}
                priority={index === 0}
              />
            ))}
          </div>
        </div>
      </section>

			{/* COURSES */}
				<section className="relative overflow-hidden bg-[#131722] py-16 sm:py-24">
					<div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.13),transparent_28%),radial-gradient(circle_at_88%_85%,rgba(37,99,235,0.18),transparent_30%)]" />

					<div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
						<div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-center">
							<div>
								<p className="font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300">
									Academy courses
								</p>

								<h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
									Go from watching to building.
								</h2>

								<p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
									MetaWork Academy courses organize lessons, activities, projects,
									teacher resources, and assessments into focused six-lesson learning
									experiences. Start with the skill your learners need now, or build
									toward the complete Create. Build. Earn. sequence.
								</p>

								<div className="mt-8 flex flex-col gap-3 sm:flex-row">
									<Link
										href="/academy/courses"
										className="group inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-3.5 text-sm font-extrabold italic uppercase tracking-wide text-white shadow-xl shadow-blue-950/40 transition hover:-translate-y-0.5 hover:bg-blue-500"
									>
										Explore Academy courses
										<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
									</Link>

									<Link
										href="/academy/programs/online-courses"
										className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/[0.06] px-5 py-3.5 text-sm font-extrabold italic uppercase tracking-wide text-cyan-100 transition hover:border-cyan-300/55 hover:bg-cyan-400/15"
									>
										Online course options
										<BookOpen className="h-4 w-4" />
									</Link>
								</div>
							</div>

							<div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
								<Link
									href="/academy/courses/blockchain-basics"
									className="group relative overflow-hidden border border-cyan-400/25 bg-[#09090B] p-5 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-cyan-300/50"
								>
									<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#22D3EE] to-[#2563EB]" />

									<p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-300">
										Course 01 // Available
									</p>

									<h3 className="mt-3 text-xl font-black italic uppercase tracking-[-0.035em] text-slate-50">
										Blockchain Basics
									</h3>

									<p className="mt-2 text-sm leading-6 text-slate-400">
										6 lessons · 6 recorded videos · classroom-ready resources
									</p>

									<span className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold italic uppercase tracking-wide text-cyan-200">
										View course
										<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
									</span>
								</Link>

								<Link
									href="/academy/courses/design-ip-creation"
									className="group relative overflow-hidden border border-blue-400/25 bg-[#09090B] p-5 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-blue-300/50"
								>
									<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2563EB] to-[#22D3EE]" />

									<p className="font-mono text-[9px] uppercase tracking-[0.18em] text-blue-300">
										Course 02 // Available
									</p>

									<h3 className="mt-3 text-xl font-black italic uppercase tracking-[-0.035em] text-slate-50">
										Design & IP Creation
									</h3>

									<p className="mt-2 text-sm leading-6 text-slate-400">
										6 lessons · 6 recorded videos · design-to-product workflows
									</p>

									<span className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold italic uppercase tracking-wide text-blue-200">
										View course
										<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
									</span>
								</Link>

								<Link
									href="/academy/courses/sales-client-acquisition"
									className="group relative overflow-hidden border border-emerald-400/25 bg-[#09090B] p-5 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-emerald-300/50"
								>
									<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#34D399] to-[#22D3EE]" />

									<p className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-300">
										Course 03 // In production
									</p>

									<h3 className="mt-3 text-xl font-black italic uppercase tracking-[-0.035em] text-slate-50">
										Sales & Client Acquisition
									</h3>

									<p className="mt-2 text-sm leading-6 text-slate-400">
										6 lessons · recordings in production · market-ready skills
									</p>

									<span className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold italic uppercase tracking-wide text-emerald-200">
										View course
										<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
									</span>
								</Link>
							</div>
						</div>
					</div>
				</section>

      {/* MEMBERS */}
      <section className="relative overflow-hidden py-16 sm:py-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(251,191,36,0.10),transparent_26%),radial-gradient(circle_at_88%_85%,rgba(34,211,238,0.13),transparent_28%)]" />

        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
          <div className="relative overflow-hidden border border-[#FBBF24]/25 bg-[#09090B] p-7 shadow-2xl shadow-black/30 sm:p-10 lg:p-14">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#FBBF24] via-[#2563EB] to-[#22D3EE]" />

            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 border border-[#FBBF24]/35 bg-[#FBBF24]/10 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-amber-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  Members area
                </div>

                <h2 className="mt-5 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
                  Go deeper when you&apos;re ready.
                </h2>

                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                  Member access will bring together advanced workshops,
                  structured courses, guided projects, exclusive resources, and
                  school or partner learning collections.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/academy/library?access=members"
                    className="group inline-flex items-center justify-center gap-2 rounded-lg bg-[#FBBF24] px-5 py-3.5 text-sm font-extrabold italic uppercase tracking-wide text-[#09090B] transition hover:-translate-y-0.5 hover:bg-amber-300"
                  >
                    Preview member content
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>

                  <span className="inline-flex items-center justify-center border border-white/15 bg-white/[0.03] px-5 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">
                    Access options coming soon
                  </span>
                </div>
              </div>

              <div className="grid gap-3">
                {[
                  'Guided pathways and future course sequences',
                  'Exclusive workshops and deeper tool training',
                  'Projects, resources, and future knowledge checks',
                  'Approved member, credit-pass, and school access options',
                ].map((item, index) => {
                  const colors = [
                    'border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-200',
                    'border-blue-400/25 bg-blue-400/[0.08] text-blue-200',
                    'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200',
                    'border-amber-400/25 bg-amber-400/[0.08] text-amber-100',
                  ];

                  return (
                    <div
                      key={item}
                      className="flex items-center gap-3 border border-white/10 bg-white/[0.025] p-4"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${colors[index]}`}
                      >
                        <BadgeCheck className="h-4 w-4" />
                      </span>

                      <p className="text-sm font-medium text-slate-200">
                        {item}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PARTNERSHIP CTA */}
      <section
        id="partner-with-us"
        className="relative overflow-hidden border-t border-cyan-400/15 bg-[#09090B] py-16 sm:py-20"
      >
        <div className="absolute inset-0 -z-10 opacity-[0.12] [background-image:linear-gradient(rgba(34,211,238,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.18)_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="mx-auto w-full max-w-4xl px-5 text-center sm:px-8 lg:px-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[#2563EB] text-white shadow-xl shadow-blue-950/50">
            <Handshake className="h-7 w-7" />
          </span>

          <p className="mt-6 font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300">
            Partner with MetaWork
          </p>

          <h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
            Bring Academy to your program.
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400">
            Let&apos;s discuss workshops, curriculum design, school
            partnerships, CTE and DECA opportunities, or a custom learning
            pathway for your community.
          </p>

          <div className="mt-8 inline-flex flex-col items-center">
            <GoogleBookingButton label="Book a partnership conversation" />

            <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
              Choose a time that works for you
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}