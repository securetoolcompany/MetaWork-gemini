import { Button } from '@/components/ui/button';
import {
  Terminal, ChevronRight, Star, Target,
  CheckCircle2, AlertTriangle, Ticket,
  Users, GraduationCap, Shirt, Coins
} from 'lucide-react';
import Link from 'next/link';

export default function SecondaryEducationPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-amber-500/30">

      {/* HERO */}
      <section className="relative px-8 pt-4 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-amber-500/6 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
            <Link href="/industries/education" className="hover:text-amber-400 transition-colors">
              EDUCATION
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-amber-400">SECONDARY_EDUCATION_MODULE</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            Turn secondary schools into<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              student opportunity engines.
            </span>
          </h1>

          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-4 max-w-3xl">
            MetaWork gives middle and high schools a district-ready platform for spirit,
            fundraising, entrepreneurship, and academic recognition. One system that
            supports every program — without replacing your SIS, gradebook, or website.
          </p>

          <p className="text-xl text-zinc-200 leading-relaxed font-semibold mb-8 max-w-3xl">
            Spirit Cards for events. Student-designed merch. Real entrepreneurship
            experiences. Year-round fundraising that doesn&apos;t depend on weather
            or weekends.
            <span className="text-amber-400"> All under your IP and policy.</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/register">
              <Button
                size="lg"
                className="h-12 px-8 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-none font-mono shadow-[0_0_20px_rgba(217,119,6,0.25)]"
              >
                <Terminal className="mr-2 h-4 w-4" /> Initialize Secondary Program
              </Button>
            </Link>
            <Link href="/how-it-works/secondary-education">
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-none font-mono"
              >
                See How It Works <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* THE PROBLEM */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-5xl mx-auto border border-zinc-800 bg-zinc-900/40 p-10 md:p-16 shadow-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono mb-8">
            <AlertTriangle className="h-3.5 w-3.5" />
            SYSTEM_WARNING: SUPPORT_GAP_DETECTED
          </div>

          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
            Car washes, candy sales, and one-off fundraisers can&apos;t carry everything you&apos;re trying to do.
          </h2>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6 text-zinc-400 leading-relaxed font-light">
              <p>
                Every program at your secondary schools needs resources — sports,
                band, theater, robotics, journalism, clubs, after-school initiatives.
                The default answer is another fundraiser: car wash, bake sale,
                catalog, door-to-door. It works, but it&apos;s fragile. It depends
                on weather, weekends, volunteer bandwidth, and parent tolerance.
              </p>
              <p>
                At the same time, your districts&apos; brands — the school names, mascots,
                colors, and stories — are powerful assets in your communities.
                Right now they mostly live on a handful of shirts and a banner in
                the gym.{' '}
                <strong className="text-zinc-200">
                  There&apos;s more they can be doing for your students.
                </strong>
              </p>
            </div>
            <div className="space-y-6 text-zinc-400 leading-relaxed font-light">
              <p>
                <strong className="text-amber-400">
                  MetaWork plugs in as a spirit and opportunity layer.
                </strong>{' '}
                It gives every middle and high school a unified way to issue Spirit Cards
                for events, run student-designed merch for clubs and teams, teach
                entrepreneurship through real projects, and route support where you
                decide — all without asking you to change how you handle grades,
                schedules, or compliance.
              </p>
              <p>
                You don&apos;t adopt a new SIS. You don&apos;t rebuild your website.
                You keep running schools exactly as you do today —{' '}
                <strong className="text-zinc-200">
                  MetaWork layers sustainable support and student opportunity on top.
                </strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FLAGSHIP: SPIRIT CARD */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono mb-6 rounded">
            <Star className="h-3 w-3" />
            FLAGSHIP_PRODUCT: SPIRIT_CARD
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Copy */}
            <div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
                The Spirit Card.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                  Every school night, captured.
                </span>
              </h2>
              <p className="text-zinc-400 leading-relaxed font-light mb-6 text-lg">
                Every major event at your schools — homecoming, rivalry games,
                concerts, theater productions, award nights, showcases — can be
                tied to a Spirit Card. It can function as admission, a collectible,
                or both. Families buy a Spirit Card instead of a plain ticket,
                raising your average order value immediately.
              </p>
              <p className="text-zinc-400 leading-relaxed font-light mb-8">
                Students and alumni collect Spirit Cards over time as a verified
                record of the events they cared about. Years later, they can still
                prove they were in the building for the championship game or the
                performance that changed their life.{' '}
                <strong className="text-zinc-200">
                  Every purchase can route support to the programs you choose —
                  general activities or specific teams and clubs.
                </strong>
              </p>

              <div className="space-y-3 mb-10">
                {[
                  {
                    icon: Ticket,
                    label:
                      'Bundle admission with school-branded digital artifacts for games, concerts, and showcases.',
                  },
                  {
                    icon: Shirt,
                    label:
                      'Tie Spirit Cards to merch drops — hoodie + pass, shirt + pass, spirit bundle for key nights.',
                  },
                  {
                    icon: GraduationCap,
                    label:
                      'Capture academic and milestone events (honor nights, graduation) as verified, school-issued artifacts.',
                  },
                  {
                    icon: Coins,
                    label:
                      'Delegate a portion of each sale to athletics, arts, clubs, or general student support — by campus or district.',
                  },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 px-4 py-3 bg-zinc-900/50 border border-zinc-800"
                  >
                    <Icon className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-sm text-zinc-400">{label}</span>
                  </div>
                ))}
              </div>

              <Link href="/register">
                <Button
                  size="lg"
                  className="h-12 px-8 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-none font-mono"
                >
                  Launch Spirit Card Program
                </Button>
              </Link>
            </div>

            {/* Spirit Card Mock */}
            <div className="relative mx-auto w-[300px] select-none">
              <div className="absolute -inset-6 bg-amber-500/15 blur-3xl rounded-full pointer-events-none animate-pulse" />
              <div className="relative border-2 border-amber-500/60 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[0_0_60px_rgba(217,119,6,0.25)] overflow-hidden">
                <div className="bg-gradient-to-r from-amber-900/80 to-zinc-900 px-4 py-2 flex justify-between items-center border-b border-amber-500/30">
                  <span className="text-[10px] font-mono text-amber-400 tracking-widest">
                    METAWORK /// SPIRIT_CARD
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">#014 / 500</span>
                </div>
                <div className="bg-gradient-to-b from-zinc-900 via-amber-950/20 to-zinc-950 px-4 pt-6 pb-4">
                  <p className="text-lg font-black tracking-tight text-white leading-none">
                    CENTRAL DISTRICT
                  </p>
                  <p className="text-[11px] font-bold text-amber-400 tracking-widest mt-1">
                    HOMECOMING · OCT 18
                  </p>
                </div>
                <div className="grid grid-cols-3 border-t border-amber-500/30">
                  {[
                    { label: 'ADMIT', value: '1', color: 'text-emerald-400' },
                    { label: 'SCHOOL', value: 'RIDGE', color: 'text-amber-400' },
                    { label: 'SUPPORT', value: 'BAND', color: 'text-orange-400' },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="flex flex-col items-center py-3 border-r border-zinc-800 last:border-0"
                    >
                      <span className={`text-xl font-black ${color}`}>{value}</span>
                      <span className="text-[9px] font-mono text-zinc-500 tracking-widest">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-zinc-800 space-y-2">
                  <p className="text-[9px] font-mono text-zinc-500 tracking-widest mb-2">
                    PROGRAM_SUPPORT
                  </p>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-mono text-zinc-400">MARCHING_BAND</span>
                    <span className="font-mono text-emerald-400">$7.50</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-mono text-zinc-400">GENERAL_ACTIVITIES</span>
                    <span className="font-mono text-emerald-400">$2.50</span>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-amber-900/40 to-zinc-900/60 px-4 py-2 flex justify-between items-center border-t border-amber-500/20">
                  <span className="text-[9px] font-mono text-amber-500/70 tracking-widest">
                    STUDENT_SUPPORT_LAYER
                  </span>
                  <span className="text-[9px] font-mono text-zinc-500">METAWORK.IO</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DISTRICT-READY SECTION */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono mb-6">
              DISTRICT_READY
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
              This is bigger than a single school store.
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed">
              MetaWork is built for districts. You can roll out one operating model
              across all of your middle and high schools — with district-level rules
              for IP and policy, and school-level control for how each campus uses
              it to support its students.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'One IP and policy framework',
                body: 'District administrators keep mascots, logos, and identity under a single set of rules. All designs and uses flow through that lens.',
              },
              {
                title: 'Repeatable launch model',
                body: 'Once the first school is live, the next 13 use the same blueprint. Same playbook, different colors and programs.',
              },
              {
                title: 'Support across all programs',
                body: 'Athletics, fine arts, clubs, activities, academies, and after-school initiatives can all run on the same platform.',
              },
              {
                title: 'Local control at each campus',
                body: 'Principals, ADs, and activities directors decide how their campus uses MetaWork, within the district framework.',
              },
              {
                title: 'Transparent revenue flows',
                body: 'Every sale is tagged to its destination. You can see how much each program, campus, and initiative has earned.',
              },
              {
                title: 'No replacement projects',
                body: 'MetaWork doesn’t ask you to move SIS, ticketing, or websites. It plugs into what you already have and makes it more effective.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="border border-zinc-800 bg-zinc-900/30 p-6 hover:border-amber-500/30 transition-all"
              >
                <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STUDENT OPPORTUNITY TRACKS */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Students don&apos;t just wear the system. They learn through it.
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed">
              MetaWork can become a live learning environment for your students:
              design, business, marketing, media, and leadership. They don&apos;t
              just see products appear — they help create and launch them under
              your guidance.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Student creator track',
                body: 'Students design school-approved spirit wear and graphics using official IP. They learn design, branding, and collaboration.',
              },
              {
                title: 'Student entrepreneur track',
                body: 'Business and marketing students plan drops, set prices, calculate margins, and learn digital commerce through real projects.',
              },
              {
                title: 'Student media & storytelling',
                body: 'Media, journalism, and AV students create launch content — photos, reels, copy — and see how narrative drives support.',
              },
              {
                title: 'Leadership & club management',
                body: 'Club officers learn how to manage campaigns, set goals, communicate with advisors, and steward funds.',
              },
              {
                title: 'After-school innovation',
                body: 'After-school programs use MetaWork to turn ideas into fundable projects tied to school identity and community support.',
              },
              {
                title: 'Academic and pathway recognition',
                body: 'Students collect verified artifacts for honor roll, pathway completion, and program achievements they can carry forward.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="border border-zinc-800 bg-zinc-900/30 p-6 hover:border-amber-500/30 transition-all"
              >
                <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MONEY & FUNDRAISING */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              How MetaWork makes the school money — without burning everyone out.
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Merch-based fundraising and Spirit Cards give every program in your
              secondary schools a sustainable way to generate support. Online
              flows work year-round. Cash flows are still supported when you
              need them. You decide where the margin goes.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="border border-zinc-800 bg-zinc-900/40 p-6">
              <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-400" /> Program-level support
              </h3>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li className="flex items-start">
                  <span className="text-amber-400 mr-2">-</span>
                  A band hoodie drop supports travel and instruments.
                </li>
                <li className="flex items-start">
                  <span className="text-amber-400 mr-2">-</span>
                  A robotics shirt supports competition fees and equipment.
                </li>
                <li className="flex items-start">
                  <span className="text-amber-400 mr-2">-</span>
                  A Spirit Card bundle for homecoming supports general student activities.
                </li>
                <li className="flex items-start">
                  <span className="text-amber-400 mr-2">-</span>
                  You set the percentages. MetaWork keeps the accounting straight.
                </li>
              </ul>
            </div>

            <div className="border border-zinc-800 bg-zinc-900/40 p-6">
              <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-400" /> Families and alumni can support from anywhere
              </h3>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li className="flex items-start">
                  <span className="text-amber-400 mr-2">-</span>
                  Online stores mean relatives, alumni, and community members can buy without being on campus.
                </li>
                <li className="flex items-start">
                  <span className="text-amber-400 mr-2">-</span>
                  No order forms stuffed in backpacks, no boxes in the front office, no storage in classrooms.
                </li>
                <li className="flex items-start">
                  <span className="text-amber-400 mr-2">-</span>
                  Cash collection is still supported through simple pre-order forms and coordinator flows.
                </li>
                <li className="flex items-start">
                  <span className="text-amber-400 mr-2">-</span>
                  Transparent reporting shows how much each initiative has earned — by campus and by program.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-400" /> Platform economics, kept simple
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                MetaWork&apos;s platform fee is straightforward: $0.25 per product minted,
                one time, plus $0.25 per Spirit Card or ticket sold. The rest of the margin
                is support you&apos;ve directed — to programs, campuses, or general student funds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="px-8 py-24 bg-zinc-900/30 border-t border-zinc-800/50 text-center relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <GraduationCap className="w-[800px] h-[800px]" />
        </div>
        <div className="max-w-2xl mx-auto relative z-10">
          <h2 className="text-3xl font-bold tracking-tight mb-6">
            Your next school year can be the most supported one you&apos;ve ever run.
          </h2>
          <p className="text-zinc-400 mb-10 text-lg">
            Plug MetaWork into your secondary schools before your next season of
            games, concerts, and showcases. No new SIS. No new gradebook.
            Just more spirit, more student opportunity, and more support routed
            exactly where you want it.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/register">
              <Button
                size="lg"
                className="w-full sm:w-auto h-14 px-8 bg-white text-black hover:bg-zinc-200 rounded-none font-bold tracking-wide"
              >
                Set Up Secondary Program
              </Button>
            </Link>
            <Link href="/how-it-works/secondary-education">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto h-14 px-8 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-none font-mono"
              >
                See How It Works <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}