import { Button } from '@/components/ui/button';
import {
  ChevronRight, Store, Shirt, ShoppingBag,
  Users, Archive, ArrowRight, CheckCircle2,
  AlertCircle, Lightbulb, Wallet, Star
} from 'lucide-react';
import Link from 'next/link';

export default function HowItWorksFightersPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">

      {/* HEADER */}
      <section className="px-8 pt-12 pb-16 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mb-6">
          <Link href="/industries/fighters" className="hover:text-amber-500 transition-colors">
            Fighters
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-600 dark:text-zinc-400">How It Works</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Your name. Your merch.<br />
          <span className="text-amber-500">Your money.</span>
        </h1>
        <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
          Here's exactly how MetaWork works for fighters — from setting up your
          aisle to getting paid. No promotion required to start. No inventory.
          No guesswork.
        </p>
      </section>

      {/* DIVIDER */}
      <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />

      {/* STEPS */}
      <section className="px-8 py-16 max-w-4xl mx-auto w-full">

        {/* STEP 1 — FIGHTER AISLE */}
        <div className="flex gap-6 md:gap-10">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
              1
            </div>
            <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 mt-3" />
          </div>
          <div className="pb-16 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Store className="h-5 w-5 text-amber-500" />
              <h2 className="text-2xl font-bold tracking-tight">Your Fighter Aisle is created</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              You get your own permanent storefront on MetaWork. Your name, your image,
              your brand — not a gym logo, not a promotion's color scheme. Shirts,
              hoodies, hats, bags. Products that represent you.
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              Your aisle lives at its own URL. Drop it in your Instagram bio, your
              TikTok, a text to your crew. It's open year-round — between fights,
              after fights, whenever. You don't need to be on a card for people to
              buy from you.
            </p>
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-4 flex gap-3">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Your aisle is yours — independent of any promotion, any gym, any
                manager. Whether you're on a card next weekend or between fights,
                it's always open. We set it up with you directly, 1-on-1.
                You don't need a designer, a developer, or anything technical.
              </p>
            </div>
          </div>
        </div>

        {/* STEP 2 — EVENT BUNDLES */}
        <div className="flex gap-6 md:gap-10">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
              2
            </div>
            <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 mt-3" />
          </div>
          <div className="pb-16 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Shirt className="h-5 w-5 text-amber-500" />
              <h2 className="text-2xl font-bold tracking-tight">Your event bundle is built</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              Every time you fight, you get an event-specific bundle — your name,
              your opponent, the date, printed on whatever products you want to
              put your name on. This lives inside your aisle as a dedicated
              event section, separate from your year-round gear.
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-white dark:bg-zinc-900">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Fighting on a MetaWork promotion?
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Your bundle gets built as part of their event setup. We coordinate
                  directly with you on design and preferences — the promotion handles
                  their side, you handle yours.
                </p>
              </div>
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-white dark:bg-zinc-900">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Fighting independently?
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No problem. You can build an event bundle for any fight, on any
                  card, with or without a promotion involved. You control what
                  gets built and when.
                </p>
              </div>
            </div>

            <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex gap-3">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Bundle turnaround is 72 hours once we have your image and product
                preferences. We'll walk you through everything on your onboarding call.
              </p>
            </div>
          </div>
        </div>

        {/* STEP 3 — SELLING */}
        <div className="flex gap-6 md:gap-10">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
              3
            </div>
            <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 mt-3" />
          </div>
          <div className="pb-16 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <ShoppingBag className="h-5 w-5 text-amber-500" />
              <h2 className="text-2xl font-bold tracking-tight">You sell your bundle</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              You get a shareable link — your personal bundle page. Ticket to your
              fight plus your merch, one price, one purchase. Post it on fight week,
              drop it in your story, text it to family. Anyone who clicks can buy
              both in one shot.
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              You're already asking people to come out. This just makes that ask
              worth more — for them and for you.
            </p>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 mb-4">
              <div className="bg-zinc-100 dark:bg-zinc-800/60 px-5 py-3 border-b border-zinc-200 dark:border-zinc-700">
                <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">HOW YOUR CUT WORKS</p>
              </div>
              <div className="px-5 py-4 space-y-3 text-sm text-zinc-500 dark:text-zinc-400">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p><strong className="text-zinc-900 dark:text-zinc-100">On a MetaWork promotion:</strong> Your cut is set by the promotion and tracked automatically. It's in your account when sales close — no chasing, no waiting.</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p><strong className="text-zinc-900 dark:text-zinc-100">Cash orders through a coordinator:</strong> Your cut comes from the promotion directly — MetaWork handles the bundle fulfillment, they handle the split with you.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Star className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p><strong className="text-zinc-900 dark:text-zinc-100">Selling independently:</strong> Supplier cost comes off the top. Everything above that is yours. Full stop.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 4 — FULFILLMENT */}
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
              <h2 className="text-2xl font-bold tracking-tight">Orders ship to your buyers</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              No inventory. Nothing lands at your door. Your buyer purchases,
              we print, we ship directly to them. You never touch a box.
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              Collecting cash from people at your gym or training camp? We give
              you a simple pre-order form — it captures name, size, and product
              so you or your coordinator can place a clean batch order before
              the deadline. Everything still ships direct to each buyer from there.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                <CheckCircle2 className="h-3 w-3" /> No inventory to manage
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                <CheckCircle2 className="h-3 w-3" /> Ships direct to every buyer
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                <CheckCircle2 className="h-3 w-3" /> Cash and online orders both supported
              </span>
            </div>
          </div>
        </div>

        {/* STEP 5 — AFTER THE FIGHT */}
        <div className="flex gap-6 md:gap-10">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
              5
            </div>
            <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 mt-3" />
          </div>
          <div className="pb-16 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Archive className="h-5 w-5 text-amber-500" />
              <h2 className="text-2xl font-bold tracking-tight">After the fight</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
              Your event section stays live. Fans who found your highlight clip
              after the fact, people who heard about you through a friend —
              they can still order your fight night bundle. That section becomes
              a permanent chapter in your aisle catalog.
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
              Every fight you take adds to what you're building. Over time your
              aisle becomes a record of your career — and a revenue stream that
              earns between fights, not just around them. Fans who've followed
              you from the beginning can buy from your first card. New fans can
              find you through your most recent one.
            </p>
            <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex gap-3">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Fighters who fight often build the most. Every event section is
                another entry point for new fans to find you — and another reason
                for existing fans to come back.
              </p>
            </div>
          </div>
        </div>

        {/* STEP 6 — GETTING PAID */}
        <div className="flex gap-6 md:gap-10">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
              6
            </div>
          </div>
          <div className="pb-4 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Wallet className="h-5 w-5 text-amber-500" />
              <h2 className="text-2xl font-bold tracking-tight">Getting paid</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              When a sale is made, your revenue is tracked automatically.
              You access it through your MetaWork account — we walk you through
              setup when you onboard. No spreadsheets, no waiting on someone
              to cut you a check, no wondering what you're owed.
            </p>

            <div className="border-2 border-amber-400 dark:border-amber-500 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-md shadow-amber-500/10 mb-4">
              <div className="bg-amber-500 px-5 py-3 flex items-center gap-3">
                <p className="font-semibold text-sm text-black">Prefer to hand it off?</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                  We offer a managed payout service — we handle the account,
                  the tracking, and the disbursements, and send you the money
                  directly. There's a service fee for that on top of the standard
                  platform cost. It's not a hidden charge — it's the cost of having
                  someone else run the backend for you.
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Most fighters find the standard setup straightforward after a
                  short onboarding. But the option is there if you want it.{' '}
                  <Link
                    href="mailto:scott.holbrook@metawork.tools?subject=Managed%20Payouts%20Inquiry"
                    className="text-amber-500 hover:text-amber-400 underline underline-offset-2 transition-colors"
                  >
                    Ask us about managed payouts →
                  </Link>
                </p>
              </div>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 mt-2">
              <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
                <span className="text-amber-500 font-semibold">Platform fee:</span>{' '}
                $0.25 per product. One time. A 4-product fight bundle costs $1. 
                That's the entire platform cost — everything else you keep.
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
              Ready to own your merch?
            </h2>
            <p className="text-zinc-400 leading-relaxed">
              We'll build your aisle, set up your first event bundle, and have you
              ready to sell before your next fight. Tell us about yourself and
              we'll take it from there.
            </p>
          </div>
          <div className="flex flex-col gap-3 shrink-0">
            <Link href="/register">
              <Button size="lg" className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-none h-12 px-8">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/industries/fighters">
              <Button size="lg" variant="outline" className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-none h-12 px-8">
                Back to Fighters
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}