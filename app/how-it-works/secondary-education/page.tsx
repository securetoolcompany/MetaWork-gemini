import { Button } from '@/components/ui/button';
import {
  ChevronRight, Store, Shirt, Ticket,
  Users, Archive, ArrowRight, CheckCircle2,
  AlertCircle, Lightbulb, Coins, GraduationCap,
  Building2, Sparkles
} from 'lucide-react';
import Link from 'next/link';

export default function HowItWorksSecondaryEducationPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">

      {/* HEADER */}
      <section className="px-8 pt-12 pb-16 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mb-6">
          <Link href="/industries/education/secondary-education" className="hover:text-amber-500 transition-colors">
            Secondary Education
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-600 dark:text-zinc-400">How It Works</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Running MetaWork in your schools,<br />
          <span className="text-amber-500">step by step.</span>
        </h1>
        <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
          From setting up a district-ready school aisle to launching Spirit Cards,
          student-designed merch, and program fundraising — here’s exactly how
          MetaWork works in secondary education.
        </p>
      </section>

      {/* DIVIDER */}
      <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />

      {/* STEPS */}
      <section className="px-8 py-16 max-w-4xl mx-auto w-full">

        {/* STEP 1 */}
        <div className="flex gap-6 md:gap-10">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
              1
            </div>
            <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 mt-3" />
          </div>
          <div className="pb-16 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="h-5 w-5 text-amber-500" />
              <h2 className="text-2xl font-bold tracking-tight">Your district or school aisle is created</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              We set up a branded MetaWork aisle for your school or district — your
              name, your mascots, your colors, your approved identity system. This
              becomes the hub for Spirit Cards, official school merch, club and team
              stores, academic recognition artifacts, and student-created products.
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              If you&apos;re a district, each middle or high school can have its own
              section within the larger framework. If you&apos;re launching one campus
              first, that school can start independently and expand later. The point
              is simple: one system, flexible enough for one building or fourteen.
            </p>
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-4 flex gap-3">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                We build this with you. You provide logos, colors, mascots, and any
                brand or usage policies. MetaWork does not replace your website,
                SIS, or gradebook — it layers on top of them.
              </p>
            </div>
          </div>
        </div>

        {/* STEP 2 */}
        <div className="flex gap-6 md:gap-10">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
              2
            </div>
            <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 mt-3" />
          </div>
          <div className="pb-16 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Ticket className="h-5 w-5 text-amber-500" />
              <h2 className="text-2xl font-bold tracking-tight">Event sections and Spirit Cards are set up</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              For each major event — games, homecoming, concerts, theater, showcases,
              award nights, community events — we create an event section. That event
              can have a Spirit Card that functions as admission, a collectible,
              or both.
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-white dark:bg-zinc-900">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Option A — Spirit Card as ticket
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Families buy the Spirit Card as their admission pass. It grants
                  entry, tracks attendance, and becomes a keepsake tied to that night.
                </p>
              </div>
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-white dark:bg-zinc-900">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Option B — Spirit Card as collectible add-on
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Keep your current ticketing process and use Spirit Cards as optional
                  add-ons for milestone events, class years, or school traditions.
                </p>
              </div>
            </div>

            <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex gap-3">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Spirit Cards work for far more than sports. Think concerts, dance
                performances, senior nights, robotics showcases, debate tournaments,
                and graduation-related events.
              </p>
            </div>
          </div>
        </div>

        {/* STEP 3 */}
        <div className="flex gap-6 md:gap-10">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
              3
            </div>
            <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 mt-3" />
          </div>
          <div className="pb-16 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Shirt className="h-5 w-5 text-amber-500" />
              <h2 className="text-2xl font-bold tracking-tight">Programs launch official merch and fundraising</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              Once the aisle is live, individual programs can launch their own
              approved merch: athletics, band, choir, theater, journalism, robotics,
              student council, grade levels, clubs, and after-school initiatives.
              Every store runs under your school or district identity framework.
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              This is where fundraising becomes sustainable. Instead of relying on
              a single car wash or seasonal product sale, programs can run year-round
              drops, campaign windows, or permanent online stores. Families, alumni,
              and community supporters can buy from anywhere.
            </p>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
              <div className="bg-zinc-100 dark:bg-zinc-800/60 px-5 py-3 border-b border-zinc-200 dark:border-zinc-700">
                <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">FUNDRAISING FLOWS</p>
              </div>
              <div className="px-5 py-4 space-y-3 text-sm text-zinc-500 dark:text-zinc-400">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p><strong className="text-zinc-900 dark:text-zinc-100">Program-specific support:</strong> A design or product line can route its margin directly to the club, team, or activity it belongs to.</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p><strong className="text-zinc-900 dark:text-zinc-100">School-wide support:</strong> Homecoming, spirit weeks, and general school campaigns can support student activities as a whole.</p>
                </div>
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p><strong className="text-zinc-900 dark:text-zinc-100">Approval stays with you:</strong> No product or design goes live without school or district approval.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 4 */}
        <div className="flex gap-6 md:gap-10">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
              4
            </div>
            <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 mt-3" />
          </div>
          <div className="pb-16 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Users className="h-5 w-5 text-amber-500" />
              <h2 className="text-2xl font-bold tracking-tight">Students can create, not just consume</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              MetaWork can also function as a student opportunity layer. Design
              students can help create spirit wear. Business and entrepreneurship
              students can learn pricing, margins, and campaign planning. Media
              students can create launch content. Club officers can help manage
              their own fundraising efforts under supervision.
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              In other words, the platform doesn&apos;t just sell products. It gives
              schools a real-world environment for creativity, leadership, and
              entrepreneurial learning — with outputs that actually support the school.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                <CheckCircle2 className="h-3 w-3" /> Student design opportunities
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                <CheckCircle2 className="h-3 w-3" /> Entrepreneurship learning
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                <CheckCircle2 className="h-3 w-3" /> Real campaigns, real outcomes
              </span>
            </div>
          </div>
        </div>

        {/* STEP 5 */}
        <div className="flex gap-6 md:gap-10">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
              5
            </div>
            <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 mt-3" />
          </div>
          <div className="pb-16 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <GraduationCap className="h-5 w-5 text-amber-500" />
              <h2 className="text-2xl font-bold tracking-tight">Academic and student milestones can be recognized</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
              Beyond spirit and fundraising, schools can issue verified digital
              artifacts for academic and student milestones — honor roll, pathway
              completion, special awards, senior achievements, and program recognition.
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
              These don&apos;t replace your official records. They complement them.
              They give students something portable, memorable, and school-issued
              that reflects what they accomplished while they were with you.
            </p>
            <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex gap-3">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                This is especially powerful for academies, career pathways, capstone
                programs, student leadership tracks, and other recognition systems
                schools want to make more visible.
              </p>
            </div>
          </div>
        </div>

        {/* STEP 6 */}
        <div className="flex gap-6 md:gap-10">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
              6
            </div>
            <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 mt-3" />
          </div>
          <div className="pb-16 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Store className="h-5 w-5 text-amber-500" />
              <h2 className="text-2xl font-bold tracking-tight">Orders are fulfilled and shipped directly</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              Families, students, staff, alumni, and supporters buy online. Orders
              are printed and shipped directly to the buyer. No inventory sits in
              the office, the choir room, or the coach’s classroom.
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              If a group still wants to collect some cash in person, that’s fine.
              They can use a simple pre-order form to capture names, sizes, and
              products. A designated coordinator can place those orders by card
              in batches. Online and cash-supported flows can run side by side.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                <CheckCircle2 className="h-3 w-3" /> No inventory at school
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                <CheckCircle2 className="h-3 w-3" /> Direct shipping to buyers
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                <CheckCircle2 className="h-3 w-3" /> Online and cash-supported options
              </span>
            </div>
          </div>
        </div>

        {/* STEP 7 */}
        <div className="flex gap-6 md:gap-10">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
              7
            </div>
          </div>
          <div className="pb-4 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Coins className="h-5 w-5 text-amber-500" />
              <h2 className="text-2xl font-bold tracking-tight">Revenue is tracked and routed where you decide</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              Every sale is tracked automatically. You determine which products,
              Spirit Cards, and stores support which programs — athletics, arts,
              specific clubs, general student activities, or broader district goals.
              MetaWork keeps the accounting straight.
            </p>

            <div className="border-2 border-amber-400 dark:border-amber-500 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-md shadow-amber-500/10 mb-4">
              <div className="bg-amber-500 px-5 py-3 flex items-center gap-3">
                <p className="font-semibold text-sm text-black">Managed support available</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                  Prefer us to manage more of the backend? We can help with revenue
                  management, payout coordination, and platform operations as a service.
                  That&apos;s a service fee on top of the standard platform cost —
                  not a hidden charge.
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Most schools can run the standard setup once it&apos;s configured,
                  but the option is there if you want lighter internal lift.{' '}
                  <Link
                    href="mailto:your@email.com?subject=Managed%20School%20Program%20Inquiry"
                    className="text-amber-500 hover:text-amber-400 underline underline-offset-2 transition-colors"
                  >
                    Ask us about managed support →
                  </Link>
                </p>
              </div>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 mt-2">
              <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
                <span className="text-amber-500 font-semibold">Platform fee:</span>{' '}
                $0.25 per product + $0.25 per Spirit Card or ticket sold, one time each.
                A 4-product merch line for a club costs $1 to mint. Spirit Cards are
                $0.25 per sale. That&apos;s the platform cost — the rest is support
                routed where your school or district decides.
              </p>
            </div>
          </div>
        </div>

      </section>

      {/* DIVIDER */}
      <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />

      {/* CTA */}
      <section className="px-8 py-16 max-w-4xl mx-auto w-full">
        <div className="bg-zinc-900 dark:bg-zinc-900 border border-zinc-800 rounded-xl p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center gap-8">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-3">
              Ready to bring MetaWork into your schools?
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              We&apos;ll help you set up your school or district aisle, define your
              Spirit Card strategy, and launch approved fundraising and student
              opportunity flows without adding operational chaos.
            </p>
          </div>
          <div className="flex flex-col gap-3 shrink-0">
            <Link href="/register">
              <Button size="lg" className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-none h-12 px-8">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/industries/education/secondary-education">
              <Button size="lg" variant="outline" className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-none h-12 px-8">
                Back to Secondary Education
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}