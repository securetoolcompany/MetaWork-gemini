import { Button } from '@/components/ui/button';
import {
  ChevronRight, Store, Shirt, Ticket, ShoppingBag,
  Users, QrCode, Archive, ArrowRight, CheckCircle2,
  AlertCircle, Lightbulb, SplitSquareHorizontal
} from 'lucide-react';
import Link from 'next/link';

export default function HowItWorksPromotionsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">

      {/* HEADER */}
      <section className="px-8 pt-12 pb-16 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mb-6">
          <Link href="/industries/promotions" className="hover:text-amber-500 transition-colors">
            Promotions
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-600 dark:text-zinc-400">How It Works</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Running a MetaWork promotion,<br />
          <span className="text-amber-500">step by step.</span>
        </h1>
        <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
          From setting up your aisle to scanning tickets at the door —
          here's exactly what happens, in the order it happens.
          No ambiguity, no surprises.
        </p>
      </section>

      {/* DIVIDER */}
      <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />

      {/* STEP 1 — PROMOTION AISLE */}
      <section className="px-8 py-16 max-w-4xl mx-auto w-full">
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
              <h2 className="text-2xl font-bold tracking-tight">Your Promotion Aisle is created</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              Your promotion gets its own permanent storefront on MetaWork — your brand,
              your logo, your gear. Branded hoodies, tees, hats, bags. Fans who follow
              your promotion can shop here any time, not just around an event.
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              Each event you run gets its own <strong className="text-zinc-900 dark:text-zinc-100">section</strong> within
              your aisle — scoped to that fight card, with its own merch line and fighter bundles.
              After the event, the section archives automatically. Your aisle stays live.
              Fans can still order from past events — the night their favorite fighter headlined,
              the card they attended with their crew. Your back catalog becomes a permanent revenue stream.
            </p>
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-4 flex gap-3">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                We set this up with you. Send us your logo, brand colors, and any existing
                merch designs — we'll have your aisle ready before your next event.
              </p>
            </div>
          </div>
        </div>

        {/* STEP 2 — FIGHTER ONBOARDING */}
        <div className="flex gap-6 md:gap-10">
        <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
            2
            </div>
            <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 mt-3" />
        </div>
        <div className="pb-16 flex-1">
            <div className="flex items-center gap-3 mb-4">
            <Users className="h-5 w-5 text-amber-500" />
            <h2 className="text-2xl font-bold tracking-tight">Fighter bundles are built</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
            Each fighter on your card gets their own event bundle — their name, image,
            fight date, printed on whatever fits the card: Hoodies, posters, action figures.
            These products live inside your event section and are what fighters
            sell to their personal network. Orders ship directly to each customer —
            no inventory, no boxes in your gym, no handling on your end.
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-white dark:bg-zinc-900">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Option A — Fighter contacts us
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Share our Talent Director's contact with your fighters. They reach out
                directly, we handle everything from there — kit design, preferences,
                their personal aisle setup.
                </p>
            </div>
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-white dark:bg-zinc-900">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Option B — We contact them
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Share their contact info and our Talent Director will reach out.
                Same result — kits built, aisle set up, fighter ready to sell.
                </p>
            </div>
            </div>

            <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex gap-3">
            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                <strong className="text-zinc-900 dark:text-zinc-100">We respect your relationships.</strong>{' '}
                If you'd prefer to keep us out of their inbox entirely, just send us
                the kit details yourself — fighter name, image, product preferences —
                and we'll build everything without ever contacting them directly.
                Your call, always.
            </p>
            </div>
        </div>
        </div>

        {/* STEP 3 — BUNDLES GO ON SALE */}
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
              <h2 className="text-2xl font-bold tracking-tight">Fighters sell their bundles</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              Each fighter gets an order form and a shareable link — their personal bundle page inside your
              event section, or your website's shop. They drop it in a text, post it to their Instagram story,
              send it to family. One link, one price, one purchase: ticket + their merch,
              done.
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              You decide what the fighter earns per bundle. You set the split,
              we handle the math. The cost of goods (supplier cost) comes off the top —
              everything above that is yours to allocate however you've agreed with each fighter.
            </p>
            <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex gap-3">
              <SplitSquareHorizontal className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                <strong className="text-zinc-900 dark:text-zinc-100">Revenue splits</strong> can be
                automated for purchases via your MetaWork Aisle. Cash payments and payments via your website shop are handled
                separately — see the fulfillment paths below.
              </p>
            </div>
          </div>
        </div>

        {/* STEP 4 — FULFILLMENT DECISION */}
        <div className="flex gap-6 md:gap-10">
        <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
            4
            </div>
            <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 mt-3" />
        </div>
        <div className="pb-16 flex-1">
            <div className="flex items-center gap-3 mb-4">
            <Shirt className="h-5 w-5 text-amber-500" />
            <h2 className="text-2xl font-bold tracking-tight">Choose your fulfillment path</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-3">
            How you collect payment determines how orders get placed. In all cases,
            orders ship <strong className="text-zinc-900 dark:text-zinc-100">directly to each customer</strong> —
            no inventory, nothing lands on your doorstep.
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-8">
            Most promotions run a mix — some buyers pay online, some hand cash
            to the fighter at the gym. Pick the paths that fit your situation.
            They can run in parallel.
            </p>

            <div className="space-y-4">

            {/* PATH A */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                <div className="bg-zinc-100 dark:bg-zinc-800/60 px-5 py-3 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-700">
                <div className="h-6 w-6 rounded-full bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-xs font-bold">A</div>
                <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Hard cut-off — one batch order</p>
                <span className="ml-auto text-xs text-zinc-400 font-mono">BEST FOR CASH</span>
                </div>
                <div className="px-5 py-4 space-y-3">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Set a pre-order deadline — typically 2 weeks before the event.
                    Fighters collect orders and cash from their network using a simple
                    pre-order form we provide — name, size, product. Once the deadline hits,
                    your designated merch coordinator places one batch order on behalf
                    of all fighters, paid by card. Everything ships direct to customers.
                </p>
                <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                    <CheckCircle2 className="h-3 w-3" /> Lowest friction for cash-heavy promotions
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                    <CheckCircle2 className="h-3 w-3" /> One order, one fulfillment run
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 rounded px-2 py-1">
                    <AlertCircle className="h-3 w-3" /> Requires a coordinator to place the batch
                    </span>
                </div>
                </div>
            </div>

            {/* PATH B */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                <div className="bg-zinc-100 dark:bg-zinc-800/60 px-5 py-3 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-700">
                <div className="h-6 w-6 rounded-full bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-xs font-bold">B</div>
                <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Rolling orders — place as cash comes in</p>
                <span className="ml-auto text-xs text-zinc-400 font-mono">FLEXIBLE</span>
                </div>
                <div className="px-5 py-4 space-y-3">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No hard deadline. As fighters collect cash, your merch coordinator
                    places orders on their behalf throughout the pre-event window.
                    Each order ships directly to that customer as it's placed.
                    More coordinator touchpoints, but works well for longer lead times.
                </p>
                <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                    <CheckCircle2 className="h-3 w-3" /> No deadline pressure on fighters
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 rounded px-2 py-1">
                    <AlertCircle className="h-3 w-3" /> More coordinator touchpoints
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 rounded px-2 py-1">
                    <AlertCircle className="h-3 w-3" /> Shipping windows vary per order
                    </span>
                </div>
                </div>
            </div>

            {/* PATH C — ONLINE GATEWAY */}
            <div className="border-2 border-amber-400 dark:border-amber-500 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-md shadow-amber-500/10">
                <div className="bg-amber-500 px-5 py-3 flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-black/20 text-white flex items-center justify-center text-xs font-bold">C</div>
                <p className="font-semibold text-sm text-black">MetaWork Aisle — fully automated</p>
                <span className="ml-auto text-xs text-black/60 font-mono">RECOMMENDED</span>
                </div>
                <div className="px-5 py-4 space-y-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Fans buy the bundle online — card payment through your MetaWork
                    event section, or directly through the fighter's own website if
                    they've embedded their store. Payment clears, order places automatically,
                    merch ships directly to the customer. No coordinator, no cash handling,
                    no batch management.
                </p>
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-4 flex gap-3">
                    <QrCode className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">QR ticket scanning included</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Every bundle purchase generates a unique QR ticket. At the door,
                        your team scans it on any phone — validated and marked used in real time.
                        No app, no check-in list, no duplicates.
                    </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                    <CheckCircle2 className="h-3 w-3" /> Zero cash handling
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                    <CheckCircle2 className="h-3 w-3" /> Automatic order + fulfillment
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                    <CheckCircle2 className="h-3 w-3" /> QR door scanning included
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                    <CheckCircle2 className="h-3 w-3" /> Revenue splits automated
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                    <CheckCircle2 className="h-3 w-3" /> Works on fighter's own site too
                    </span>
                </div>
                <div className="border-t border-amber-200 dark:border-amber-500/20 pt-4 mt-2">
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
                        <span className="text-amber-500 font-semibold">Platform fee:</span>{' '}
                        $0.25 per product + $0.25 per ticket sold, one time each — covers sales tracking,
                        automation, and QR door scanning for the full event window. A 12-fighter card with
                        4 products each costs $12 to mint. Tickets are $0.25 per sale — sell 200 tickets,
                        pay $50. That's the entire platform cost.
                    </p>
                    </div>
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-2">
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
                        <span className="text-zinc-600 dark:text-zinc-300 font-semibold">How payouts work:</span>{' '}
                        Revenue tracking and splits run on-chain — meaning payouts are transparent,
                        automatic, and trustless. Your team will set up a wallet and claim revenue
                        directly from the pool. It's simpler than it sounds, and your merch coordinator
                        can manage it after a short onboarding with us.
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed mt-2">
                        Prefer to hand it off entirely? We offer a managed payout service — we handle
                        the wallet, the claims, and the disbursements on your behalf.
                        That's a separate service fee, not a platform cost.{' '}
                        <Link
                        href="mailto:scott.holbrook@metawork.tools?subject=Managed%20Payouts%20Inquiry"
                        className="text-amber-500 hover:text-amber-400 underline underline-offset-2 transition-colors"
                        >
                        Ask us about managed payouts →
                        </Link>
                    </p>
                    </div>
                </div>
            </div>

            {/* PATH D — BLENDED */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                <div className="bg-zinc-100 dark:bg-zinc-800/60 px-5 py-3 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-700">
                <div className="h-6 w-6 rounded-full bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-xs font-bold">D</div>
                <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Blended — online + cash, running together</p>
                <span className="ml-auto text-xs text-zinc-400 font-mono">MOST COMMON</span>
                </div>
                <div className="px-5 py-4 space-y-3">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Most promotions land here. Some buyers buy online through MetaWork
                    — those orders are automatic. Others pay the fighter in cash at the gym
                    — a coordinator places those manually as they come in, or batches them
                    before the deadline. Both streams run in parallel, all orders ship
                    direct to customers.
                </p>
                <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                    <CheckCircle2 className="h-3 w-3" /> Covers every buyer type
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1">
                    <CheckCircle2 className="h-3 w-3" /> Online orders fully automatic
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 rounded px-2 py-1">
                    <AlertCircle className="h-3 w-3" /> Cash orders still need a coordinator
                    </span>
                </div>
                </div>
            </div>

            </div>
        </div>
        </div>

        {/* STEP 5 — EVENT NIGHT */}
        <div className="flex gap-6 md:gap-10">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
              5
            </div>
            <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 mt-3" />
          </div>
          <div className="pb-16 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Ticket className="h-5 w-5 text-amber-500" />
              <h2 className="text-2xl font-bold tracking-tight">Fight night</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
              Merch has shipped. Fans are wearing their fighter's gear.
              If you're running Path C, your door team is scanning QR tickets
              on their phones — no special hardware, no check-in lists.
              The system handles everything. You run the show.
            </p>
          </div>
        </div>

        {/* STEP 6 — AFTER THE EVENT */}
        <div className="flex gap-6 md:gap-10">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
              6
            </div>
          </div>
          <div className="pb-4 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Archive className="h-5 w-5 text-amber-500" />
              <h2 className="text-2xl font-bold tracking-tight">After the event</h2>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
              The event section archives automatically — no manual action needed.
              But it doesn't disappear. Fans can still browse and order from past
              events indefinitely. The night someone's favorite fighter headlined,
              the card they attended with their crew — those sections stay live and
              keep earning.
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Your promotion aisle stays live. Start building your next event section
              whenever you're ready. Every event you run adds to a growing catalog
              that generates revenue long after the lights go out.
            </p>
          </div>
        </div>

      </section>

      {/* DIVIDER */}
      <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />

      {/* CTA */}
      <section className="px-8 py-16 max-w-4xl mx-auto w-full">
        <div className="bg-zinc-900 dark:bg-zinc-900 border border-zinc-800 rounded-xl p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center gap-8">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-3">Ready to set up your promotion?</h2>
            <p className="text-zinc-400 leading-relaxed">
              We'll build your aisle, onboard your fighters, and have everything
              ready before your next event. Tell us about your promotion and
              we'll take it from there.
            </p>
          </div>
          <div className="flex flex-col gap-3 shrink-0">
            <Link href="/register">
              <Button size="lg" className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-none h-12 px-8">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/industries/promotions">
              <Button size="lg" variant="outline" className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-none h-12 px-8">
                Back to Promotions
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}