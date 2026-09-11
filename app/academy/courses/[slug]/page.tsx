import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  GraduationCap,
  Layers3,
  LockKeyhole,
  Play,
  PlayCircle,
  School,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';

import { getAcademyCourseBySlug } from '@/lib/academy-courses-data';

type CoursePageProps = {
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

function getAccessDetails(course: any) {
  if (course.accessLevel === 'public') {
    return {
      label: 'Free access',
      description:
        'This course is available through open MetaWork Academy learning resources.',
      icon: CheckCircle2,
      panel: 'border-emerald-400/30 bg-emerald-400/[0.08]',
      text: 'text-emerald-200',
      actionLabel: 'Explore free learning',
      actionHref: '/academy/library',
    };
  }

  if (course.accessLevel === 'school-partner') {
    return {
      label: 'School / partner access',
      description:
        'This structured program is designed for participating schools, educators, partner organizations, and approved learner groups.',
      icon: School,
      panel: 'border-blue-400/30 bg-blue-500/[0.08]',
      text: 'text-blue-200',
      actionLabel: 'Explore program options',
      actionHref: '/academy/programs',
    };
  }

  if (course.accessLevel === 'paid') {
    return {
      label: 'Course access',
      description:
        'This course will be available through enrollment or a future Academy access option.',
      icon: LockKeyhole,
      panel: 'border-amber-400/30 bg-amber-400/[0.08]',
      text: 'text-amber-100',
      actionLabel: 'Course access coming soon',
      actionHref: '/academy/courses',
    };
  }

  return {
    label: 'Member access',
    description:
      'This course will be available through Academy membership, approved access, or eligible school and partner programs.',
    icon: LockKeyhole,
    panel: 'border-[#FBBF24]/30 bg-[#FBBF24]/[0.08]',
    text: 'text-amber-100',
    actionLabel: 'Preview member content',
    actionHref: '/academy/library?access=members',
  };
}

export async function generateStaticParams() {
  const { ACADEMY_COURSES } = await import('@/lib/academy-courses-data');

  return ACADEMY_COURSES.map((course) => ({
    slug: course.slug,
  }));
}

export async function generateMetadata({ params }: CoursePageProps) {
  const { slug } = await params;
  const course = getAcademyCourseBySlug(slug);

  if (!course) {
    return {
      title: 'Course Not Found | MetaWork Academy',
    };
  }

  return {
    title: `${course.title} | MetaWork Academy`,
    description: course.description || course.shortDescription,
  };
}

export default async function AcademyCoursePage({
  params,
}: CoursePageProps) {
  const { slug } = await params;
  const course = getAcademyCourseBySlug(slug);

  if (!course) {
    notFound();
  }

  const access = getAccessDetails(course);
  const AccessIcon = access.icon;
  const totalHours = Math.max(1, Math.round(course.estimatedMinutes / 60));

  return (
    <main className="min-h-screen overflow-hidden bg-[#131722] text-slate-50">
      {/* HERO */}
      <section className="relative isolate overflow-hidden border-b border-cyan-400/15 bg-[#131722]">
        <div className="absolute inset-0 -z-30 bg-[linear-gradient(120deg,#131722_0%,#111827_52%,#0a1821_100%)]" />

        <div className="absolute inset-0 -z-20 opacity-[0.16] [background-image:linear-gradient(rgba(34,211,238,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.22)_1px,transparent_1px)] [background-size:46px_46px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />

        <div
          className="absolute -left-40 top-[-14rem] -z-10 h-[40rem] w-[40rem] rounded-full blur-[145px]"
          style={{ backgroundColor: `${course.accent.primary}32` }}
        />

        <div
          className="absolute -right-40 -top-32 -z-10 h-[44rem] w-[44rem] rounded-full blur-[155px]"
          style={{ backgroundColor: `${course.accent.secondary}42` }}
        />

        <div className="relative mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10 2xl:px-12">
          <Link
            href="/academy/courses"
            className="group inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-cyan-200"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Return to courses
          </Link>

          <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] xl:items-end">
            <div>
              <div
                className="inline-flex items-center gap-2 border px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.24em] shadow-lg shadow-black/20"
                style={{
                  borderColor: `${course.accent.primary}66`,
                  backgroundColor: `${course.accent.primary}18`,
                  color: course.accent.primary,
                }}
              >
                <span className="relative flex h-2 w-2">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                    style={{ backgroundColor: course.accent.primary }}
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: course.accent.primary }}
                  />
                </span>
                MetaWork Academy // Flagship Program
              </div>

              <h1 className="mt-7 max-w-5xl text-5xl font-black italic uppercase leading-[0.86] tracking-[-0.075em] text-slate-50 sm:text-6xl lg:text-7xl xl:text-8xl">
                {course.title}
              </h1>

              <p className="mt-8 max-w-4xl text-lg leading-8 text-slate-300 sm:text-xl">
                {course.description}
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                {course.audience.map((audience: string) => (
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
                    borderColor: `${course.accent.primary}66`,
                    backgroundColor: `${course.accent.primary}12`,
                    color: course.accent.primary,
                  }}
                >
                  {formatLabel(course.level)}
                </span>

                <span className="border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-2 font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-emerald-200">
                  Project-based
                </span>

                <span className="border border-amber-400/25 bg-amber-400/[0.08] px-3 py-2 font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-amber-100">
                  Certificate pathway
                </span>
              </div>
            </div>

            <aside className={`border p-6 shadow-2xl shadow-black/35 ${access.panel}`}>
              <div className="flex items-start gap-4">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${course.accent.primary}, ${course.accent.secondary})`,
                    color: '#09090B',
                  }}
                >
                  <AccessIcon className="h-6 w-6" />
                </span>

                <div>
                  <p
                    className="font-mono text-[10px] font-medium uppercase tracking-[0.22em]"
                    style={{ color: course.accent.primary }}
                  >
                    Program access
                  </p>

                  <h2 className={`mt-2 text-xl font-black italic uppercase tracking-[-0.04em] ${access.text}`}>
                    {access.label}
                  </h2>
                </div>
              </div>

              <p className="mt-5 text-sm leading-6 text-slate-300">
                {access.description}
              </p>

              <div className="mt-5 border border-[#FBBF24]/25 bg-[#FBBF24]/[0.08] p-4">
                <p className="font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-amber-100">
                  Program status
                </p>
                <p className="mt-2 text-sm font-bold text-amber-50">
									{course.recordedLessonCount > 0
										? `${course.recordedLessonCount} of ${course.lessonCount} lessons are currently recorded.`
										: `${course.lessonCount} lessons are currently in production.`}
								</p>
              </div>

              <Link
                href={access.actionHref}
                className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 py-3.5 text-sm font-extrabold italic uppercase tracking-wide text-white transition hover:-translate-y-0.5 hover:bg-blue-500"
              >
                {access.actionLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </aside>
          </div>
        </div>
      </section>

      {/* PROGRAM SNAPSHOT */}
      <section className="border-b border-cyan-400/10 bg-[#09090B] py-8">
        <div className="mx-auto grid w-full max-w-[1600px] grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 px-5 sm:grid-cols-3 lg:grid-cols-6 sm:px-8 lg:px-10 2xl:px-12">
          <div className="bg-[#09090B] p-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
              Units
            </p>
            <p className="mt-2 text-3xl font-black italic text-slate-50">
              {course.unitCount}
            </p>
          </div>

          <div className="bg-[#09090B] p-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
              Lessons
            </p>
            <p className="mt-2 text-3xl font-black italic text-slate-50">
              {course.lessonCount}
            </p>
          </div>

          <div className="bg-[#09090B] p-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
              Recorded
            </p>
            <p className="mt-2 text-3xl font-black italic text-emerald-200">
              {course.recordedLessonCount}
            </p>
          </div>

          <div className="bg-[#09090B] p-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
              In production
            </p>
            <p className="mt-2 text-3xl font-black italic text-amber-100">
              {course.inProductionLessonCount}
            </p>
          </div>

          <div className="bg-[#09090B] p-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
              Knowledge checks
            </p>
            <p className="mt-2 text-3xl font-black italic text-blue-200">
              {course.quizCount}
            </p>
          </div>

          <div className="bg-[#09090B] p-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
              Suggested pace
            </p>
            <p className="mt-2 text-3xl font-black italic text-cyan-200">
              {totalHours}h
            </p>
          </div>
        </div>
      </section>

      {/* COURSE-SPECIFIC OVERVIEW */}
			<section className="bg-[#131722] py-16 sm:py-24">
				<div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
					<div className="max-w-4xl">
						<p
							className="font-mono text-[10px] font-medium uppercase tracking-[0.25em]"
							style={{ color: course.accent.primary }}
						>
							Course mission
						</p>

						<h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
							What you&apos;ll learn and build.
						</h2>

						<p className="mt-6 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
							{course.subtitle} This six-lesson course is built for practical
							learning: understand the core ideas, use them in real exercises, and
							finish with work that demonstrates what you can do next.
						</p>
					</div>

					<div className="mt-12 grid gap-5 lg:grid-cols-3">
						{course.learningFocus.map((focus: any, index: number) => {
							const iconMap = {
								sparkles: Sparkles,
								shield: BadgeCheck,
								target: CheckCircle2,
								palette: Sparkles,
								layers: Layers3,
								store: BookOpen,
								users: Users,
								chart: Award,
							};

							const Icon =
								iconMap[focus.icon as keyof typeof iconMap] || Sparkles;

							const colorMap = {
								cyan: {
									border: 'border-cyan-400/25',
									surface: 'bg-cyan-400/[0.08]',
									text: 'text-cyan-200',
									line: 'bg-[#22D3EE]',
								},
								blue: {
									border: 'border-blue-400/25',
									surface: 'bg-blue-500/[0.08]',
									text: 'text-blue-200',
									line: 'bg-[#2563EB]',
								},
								emerald: {
									border: 'border-emerald-400/25',
									surface: 'bg-emerald-400/[0.08]',
									text: 'text-emerald-200',
									line: 'bg-[#34D399]',
								},
							};

							const theme =
								colorMap[focus.color as keyof typeof colorMap] || colorMap.cyan;

							return (
								<article
									key={focus.title}
									className={`relative min-h-[270px] overflow-hidden border bg-[#09090B] p-6 shadow-xl shadow-black/20 ${theme.border}`}
								>
									<div className={`absolute inset-x-0 top-0 h-1 ${theme.line}`} />

									<span
										className={`flex h-12 w-12 items-center justify-center rounded-lg ${theme.surface} ${theme.text}`}
									>
										<Icon className="h-6 w-6" />
									</span>

									<p className={`mt-6 font-mono text-[10px] uppercase tracking-[0.22em] ${theme.text}`}>
										Step {String(index + 1).padStart(2, '0')} // {focus.label}
									</p>

									<h3 className="mt-3 text-2xl font-black italic uppercase leading-none tracking-[-0.04em] text-slate-50">
										{focus.title}
									</h3>

									<p className="mt-4 text-sm leading-7 text-slate-300">
										{focus.description}
									</p>
								</article>
							);
						})}
					</div>

					<div className="mt-8 border border-white/10 bg-[#09090B] p-6 shadow-xl shadow-black/20">
						<div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
							<div className="max-w-3xl">
								<p
									className="font-mono text-[10px] font-medium uppercase tracking-[0.22em]"
									style={{ color: course.accent.primary }}
								>
									By the end of this course
								</p>

								<h3 className="mt-3 text-2xl font-black italic uppercase tracking-[-0.04em] text-slate-50">
									You&apos;ll leave with practical work.
								</h3>

								<p className="mt-3 text-sm leading-7 text-slate-400">
									The course is designed to create visible progress—not simply watch
									time. Learners complete activities, exercises, knowledge checks,
									and a practical unit project.
								</p>
							</div>

							<span
								className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
								style={{
									backgroundColor: `${course.accent.primary}18`,
									color: course.accent.primary,
								}}
							>
								<Award className="h-6 w-6" />
							</span>
						</div>

						<div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
							{course.whatYouBuild.map((item: string, index: number) => (
								<div
									key={item}
									className="border-l-2 bg-white/[0.025] p-4"
									style={{ borderLeftColor: course.accent.primary }}
								>
									<p
										className="font-mono text-[9px] uppercase tracking-[0.18em]"
										style={{ color: course.accent.primary }}
									>
										Outcome {String(index + 1).padStart(2, '0')}
									</p>

									<p className="mt-3 text-sm leading-6 text-slate-200">{item}</p>
								</div>
							))}
						</div>
					</div>

					<div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
						<article className="border border-white/10 bg-[#09090B] p-6 shadow-xl shadow-black/20">
							<div className="flex items-start gap-4">
								<span
									className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
									style={{
										backgroundColor: `${course.accent.primary}18`,
										color: course.accent.primary,
									}}
								>
									<BadgeCheck className="h-5 w-5" />
								</span>

								<div>
									<p
										className="font-mono text-[10px] font-medium uppercase tracking-[0.22em]"
										style={{ color: course.accent.primary }}
									>
										Recommended starting point
									</p>

									<p className="mt-3 text-sm leading-7 text-slate-300">
										{course.prerequisiteNote}
									</p>
								</div>
							</div>
						</article>

						<article className="border border-cyan-400/20 bg-[#09090B] p-6 shadow-xl shadow-black/20">
							<div className="flex items-start gap-4">
								<span
									className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
									style={{
										backgroundColor: `${course.accent.primary}18`,
										color: course.accent.primary,
									}}
								>
									<GraduationCap className="h-5 w-5" />
								</span>

								<div>
									<p
										className="font-mono text-[10px] font-medium uppercase tracking-[0.22em]"
										style={{ color: course.accent.primary }}
									>
										Classroom package
									</p>

									<p className="mt-3 text-sm leading-7 text-slate-300">
										Includes a Student Book, Teacher Guide, Activity Book, lesson
										reinforcement quizzes, a final assessment, and a practical unit
										project.
									</p>
								</div>
							</div>
						</article>
					</div>
				</div>
			</section>

      {/* UNIT MAP */}
      <section className="border-y border-cyan-400/10 bg-[#09090B] py-16 sm:py-24">
        <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
          <div className="max-w-4xl">
            <p
              className="font-mono text-[10px] font-medium uppercase tracking-[0.25em]"
              style={{ color: course.accent.primary }}
            >
              Course map
            </p>

            <h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
              Three units. One build path.
            </h2>

            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-400">
              Each unit builds on the last. Recorded lessons can be watched now;
              upcoming Unit 3 lessons are displayed as in production so the
              program map remains accurate as content is released.
            </p>
          </div>

          <div className="mt-10 space-y-8">
            {course.units.map((unit: any) => {
              const unitComplete =
                unit.recordedLessonCount === unit.lessonCount;
              const unitColor =
                unit.order === 1
                  ? '#22D3EE'
                  : unit.order === 2
                    ? '#2563EB'
                    : '#34D399';

              return (
                <article
                  key={unit.id}
                  className="relative overflow-hidden border border-white/10 bg-[#131722] shadow-xl shadow-black/20"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-1.5"
                    style={{
                      background: `linear-gradient(90deg, ${unitColor}, ${course.accent.secondary})`,
                    }}
                  />

                  <div className="p-6 sm:p-8">
                    <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
                      <div className="max-w-3xl">
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className="flex h-11 w-11 items-center justify-center rounded-md font-mono text-sm font-black"
                            style={{
                              backgroundColor: `${unitColor}18`,
                              color: unitColor,
                            }}
                          >
                            {String(unit.order).padStart(2, '0')}
                          </span>

                          <span
                            className="font-mono text-[10px] font-medium uppercase tracking-[0.22em]"
                            style={{ color: unitColor }}
                          >
                            Unit {unit.order} // {unit.tagline}
                          </span>

                          {unitComplete ? (
                            <span className="inline-flex items-center gap-1.5 border border-emerald-400/25 bg-emerald-400/[0.08] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-200">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              All lessons recorded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 border border-[#FBBF24]/30 bg-[#FBBF24]/[0.08] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-100">
                              <Clock3 className="h-3.5 w-3.5" />
                              In production
                            </span>
                          )}
                        </div>

                        <h3 className="mt-6 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-4xl">
                          {unit.title}
                        </h3>

                        <p className="mt-4 text-base leading-7 text-slate-300">
                          {unit.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 border border-white/10 bg-[#09090B] text-center xl:min-w-[360px]">
                        <div className="p-4">
                          <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">
                            Lessons
                          </p>
                          <p
                            className="mt-2 text-2xl font-black italic"
                            style={{ color: unitColor }}
                          >
                            {unit.lessonCount}
                          </p>
                        </div>

                        <div className="border-x border-white/10 p-4">
                          <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">
                            Recorded
                          </p>
                          <p className="mt-2 text-2xl font-black italic text-emerald-200">
                            {unit.recordedLessonCount}
                          </p>
                        </div>

                        <div className="p-4">
                          <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">
                            Quizzes
                          </p>
                          <p className="mt-2 text-2xl font-black italic text-blue-200">
                            {unit.quizCount}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 grid gap-3 lg:grid-cols-2">
                      {unit.lessons.map((lesson: any) => {
                        const isRecorded = lesson.status === 'recorded';

                        return (
                          <article
                            key={lesson.slug}
                            className={`relative overflow-hidden border p-5 ${
                              isRecorded
                                ? 'border-white/10 bg-[#09090B]'
                                : 'border-[#FBBF24]/20 bg-[#FBBF24]/[0.035]'
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <span
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md font-mono text-xs font-black"
                                style={{
                                  backgroundColor: `${unitColor}18`,
                                  color: unitColor,
                                }}
                              >
                                {String(lesson.order).padStart(2, '0')}
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p
                                    className="font-mono text-[9px] font-medium uppercase tracking-[0.18em]"
                                    style={{ color: unitColor }}
                                  >
                                    Lesson {String(lesson.order).padStart(2, '0')}
                                  </p>

                                  {isRecorded ? (
                                    <span className="inline-flex items-center gap-1 border border-emerald-400/25 bg-emerald-400/[0.08] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-emerald-200">
                                      <Video className="h-3 w-3" />
                                      Video ready
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 border border-[#FBBF24]/25 bg-[#FBBF24]/[0.08] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-amber-100">
                                      <Clock3 className="h-3 w-3" />
                                      In production
                                    </span>
                                  )}
                                </div>

                                <h4 className="mt-2 text-lg font-black italic uppercase leading-[0.98] tracking-[-0.03em] text-slate-50">
                                  {lesson.title}
                                </h4>

                                <p className="mt-3 text-sm leading-6 text-slate-400">
                                  {lesson.description}
                                </p>

                                <div className="mt-4 flex flex-wrap gap-2">
                                  {lesson.quizIncluded && (
                                    <span className="inline-flex items-center gap-1.5 border border-blue-400/20 bg-blue-500/[0.07] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-blue-200">
                                      <ClipboardCheck className="h-3 w-3" />
                                      Quiz
                                    </span>
                                  )}

                                  {lesson.homeworkIncluded && (
                                    <span className="inline-flex items-center gap-1.5 border border-cyan-400/20 bg-cyan-400/[0.07] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-cyan-200">
                                      <FileText className="h-3 w-3" />
                                      Activity
                                    </span>
                                  )}

                                  {lesson.projectIncluded && (
                                    <span className="inline-flex items-center gap-1.5 border border-emerald-400/20 bg-emerald-400/[0.07] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-emerald-200">
                                      <Award className="h-3 w-3" />
                                      Unit project
                                    </span>
                                  )}
                                </div>

                                {isRecorded && lesson.youtubeId ? (
                                  <div className="mt-5 overflow-hidden border border-cyan-400/20 bg-[#131722]">
                                    <div className="relative aspect-video">
                                      <iframe
                                        className="absolute inset-0 h-full w-full"
                                        src={`https://www.youtube-nocookie.com/embed/${lesson.youtubeId}?rel=0&modestbranding=1&playsinline=1`}
                                        title={`${unit.title}: ${lesson.title}`}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-5 flex items-center gap-3 border border-[#FBBF24]/20 bg-[#131722] p-4">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#FBBF24]/10 text-[#FBBF24]">
                                      <Clock3 className="h-4 w-4" />
                                    </span>

                                    <div>
                                      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber-100">
                                        Recording in progress
                                      </p>
                                      <p className="mt-1 text-xs leading-5 text-slate-400">
                                        This lesson will appear here as soon as
                                        its course video is ready.
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {lesson.activities?.length > 0 && (
                                  <div className="mt-5 border-t border-white/10 pt-4">
                                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
                                      Classroom activities
                                    </p>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {lesson.activities.map((activity: string) => (
                                        <span
                                          key={activity}
                                          className="bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-300"
                                        >
                                          {activity}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    <div
                      className="mt-6 flex flex-col gap-4 border p-5 sm:flex-row sm:items-center sm:justify-between"
                      style={{
                        borderColor: `${unitColor}44`,
                        backgroundColor: `${unitColor}0D`,
                      }}
                    >
                      <div>
                        <p
                          className="font-mono text-[9px] font-medium uppercase tracking-[0.2em]"
                          style={{ color: unitColor }}
                        >
                          Unit project
                        </p>

                        <p className="mt-2 text-lg font-black italic uppercase tracking-[-0.03em] text-slate-50">
                          {unit.projectTitle}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {unit.resources.teacherGuide && (
                          <span className="inline-flex items-center gap-1.5 border border-white/10 bg-[#09090B]/70 px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-300">
                            <GraduationCap className="h-3.5 w-3.5" />
                            Teacher guide
                          </span>
                        )}

                        {unit.resources.studentBook && (
                          <span className="inline-flex items-center gap-1.5 border border-white/10 bg-[#09090B]/70 px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-300">
                            <BookOpen className="h-3.5 w-3.5" />
                            Student book
                          </span>
                        )}

                        {unit.resources.activityBook && (
                          <span className="inline-flex items-center gap-1.5 border border-white/10 bg-[#09090B]/70 px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-300">
                            <FileText className="h-3.5 w-3.5" />
                            Activity book
                          </span>
                        )}

                        {unit.finalTestIncluded && (
                          <span className="inline-flex items-center gap-1.5 border border-white/10 bg-[#09090B]/70 px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-300">
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            Final test
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* COURSE RESOURCES */}
			<section className="bg-[#131722] py-16 sm:py-24">
				<div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 2xl:px-12">
					<div className="max-w-4xl">
						<p
							className="font-mono text-[10px] font-medium uppercase tracking-[0.25em]"
							style={{ color: course.accent.primary }}
						>
							Course resources
						</p>

						<h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
							Everything needed to run this course.
						</h2>

						<p className="mt-5 max-w-3xl text-base leading-7 text-slate-400">
							This six-lesson course includes learner materials, educator guidance,
							hands-on activities, knowledge checks, a final assessment, and a
							practical project. It can run as a standalone experience or as one
							part of the larger MetaManufacturing pathway.
						</p>
					</div>

					<div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
						<article className="relative overflow-hidden border border-cyan-400/20 bg-[#09090B] p-6 shadow-xl shadow-black/20">
							<div
								className="absolute inset-x-0 top-0 h-1"
								style={{
									background: `linear-gradient(90deg, ${course.accent.primary}, ${course.accent.secondary})`,
								}}
							/>

							<span
								className="flex h-12 w-12 items-center justify-center rounded-lg"
								style={{
									backgroundColor: `${course.accent.primary}18`,
									color: course.accent.primary,
								}}
							>
								<BookOpen className="h-6 w-6" />
							</span>

							<p
								className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em]"
								style={{ color: course.accent.primary }}
							>
								Learner materials
							</p>

							<h3 className="mt-3 text-2xl font-black italic uppercase tracking-[-0.04em] text-slate-50">
								Student Book
							</h3>

							<p className="mt-4 text-sm leading-7 text-slate-300">
								Lesson objectives, key concepts, practical examples, learning
								activities, reinforcement questions, and take-home work for this
								six-lesson course.
							</p>

							<p className="mt-6 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
								Included with course access
							</p>
						</article>

						<article className="relative overflow-hidden border border-blue-400/20 bg-[#09090B] p-6 shadow-xl shadow-black/20">
							<div className="absolute inset-x-0 top-0 h-1 bg-[#2563EB]" />

							<span className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10 text-blue-200">
								<GraduationCap className="h-6 w-6" />
							</span>

							<p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-blue-300">
								Educator support
							</p>

							<h3 className="mt-3 text-2xl font-black italic uppercase tracking-[-0.04em] text-slate-50">
								Teacher Guide
							</h3>

							<p className="mt-4 text-sm leading-7 text-slate-300">
								Lesson plans, instructional guidance, activity facilitation notes,
								assessment support, differentiation ideas, and implementation
								considerations for educators.
							</p>

							<p className="mt-6 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
								Built for instructors and advisors
							</p>
						</article>

						<article className="relative overflow-hidden border border-emerald-400/20 bg-[#09090B] p-6 shadow-xl shadow-black/20">
							<div className="absolute inset-x-0 top-0 h-1 bg-[#34D399]" />

							<span className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-200">
								<FileText className="h-6 w-6" />
							</span>

							<p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">
								Applied learning
							</p>

							<h3 className="mt-3 text-2xl font-black italic uppercase tracking-[-0.04em] text-slate-50">
								Activity Book
							</h3>

							<p className="mt-4 text-sm leading-7 text-slate-300">
								Worksheets, practical exercises, simulations, planning tools,
								reflection prompts, and course-specific activities that turn lessons
								into visible learner work.
							</p>

							<p className="mt-6 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
								Hands-on and classroom-ready
							</p>
						</article>

						<article className="relative overflow-hidden border border-amber-400/20 bg-[#09090B] p-6 shadow-xl shadow-black/20">
							<div className="absolute inset-x-0 top-0 h-1 bg-[#FBBF24]" />

							<span className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-400/10 text-amber-100">
								<ClipboardCheck className="h-6 w-6" />
							</span>

							<p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-amber-100">
								Assessment + output
							</p>

							<h3 className="mt-3 text-2xl font-black italic uppercase tracking-[-0.04em] text-slate-50">
								Checks + Project
							</h3>

							<p className="mt-4 text-sm leading-7 text-slate-300">
								Six lesson reinforcement quizzes, a final assessment, and a
								practical project that gives learners a concrete way to show what
								they understand and can do.
							</p>

							<p className="mt-6 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
								{course.quizCount} quizzes · {course.finalTestCount} final test
							</p>
						</article>
					</div>

					<div
						className="mt-8 border p-6 shadow-xl shadow-black/20"
						style={{
							borderColor: `${course.accent.primary}44`,
							backgroundColor: `${course.accent.primary}0D`,
						}}
					>
						<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
							<div className="max-w-3xl">
								<p
									className="font-mono text-[10px] font-medium uppercase tracking-[0.22em]"
									style={{ color: course.accent.primary }}
								>
									Flexible delivery
								</p>

								<h3 className="mt-3 text-2xl font-black italic uppercase tracking-[-0.04em] text-slate-50">
									Run this course on its own or build toward the full pathway.
								</h3>

								<p className="mt-3 text-sm leading-7 text-slate-300">
									A cohort can complete this course as a focused six-session
									experience. Schools and partners can also combine it with other
									MetaManufacturing courses to build a longer Create. Build. Earn.
									sequence.
								</p>
							</div>

							<Link
								href="/academy/programs"
								className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-3.5 text-sm font-extrabold italic uppercase tracking-wide text-white transition hover:-translate-y-0.5 hover:bg-blue-500"
							>
								Plan your program
								<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
							</Link>
						</div>
					</div>
				</div>
			</section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-cyan-400/15 bg-[#09090B] py-16 sm:py-24">
        <div className="absolute inset-0 -z-10 opacity-[0.12] [background-image:linear-gradient(rgba(34,211,238,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.18)_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="mx-auto w-full max-w-4xl px-5 text-center sm:px-8 lg:px-10">
          <span
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg shadow-xl shadow-black/30"
            style={{
              background: `linear-gradient(135deg, ${course.accent.primary}, ${course.accent.secondary})`,
              color: '#09090B',
            }}
          >
            <GraduationCap className="h-7 w-7" />
          </span>

          <p
            className="mt-6 font-mono text-[10px] font-medium uppercase tracking-[0.25em]"
            style={{ color: course.accent.primary }}
          >
            MetaWork Academy // MetaManufacturing
          </p>

          <h2 className="mt-4 text-3xl font-black italic uppercase tracking-[-0.05em] text-slate-50 sm:text-5xl">
            Bring Create. Build. Earn. to your program.
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400">
            Start with a program conversation to discuss your learners, course
            schedule, educator resources, workshop needs, and how
            MetaManufacturing can fit your school, CTE, DECA, or community
            program.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/academy/programs"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-3.5 text-sm font-extrabold italic uppercase tracking-wide text-white transition hover:-translate-y-0.5 hover:bg-blue-500"
            >
              Explore program options
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href="/academy/library"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/[0.06] px-5 py-3.5 text-sm font-extrabold italic uppercase tracking-wide text-cyan-100 transition hover:border-cyan-300/55 hover:bg-cyan-400/15"
            >
              Explore free videos
              <Play className="h-4 w-4 fill-current" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}