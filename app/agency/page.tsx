'use client';

import { motion, type Transition } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Lock, Fingerprint, ShieldCheck, Stamp, ChevronRight,
  Handshake, Sparkles, Trophy, Star, BarChart3, Camera,
  Target, CheckCircle2, Zap, UserCog, Palette, Cpu
} from 'lucide-react';
import Link from 'next/link';

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 24 } as const,
    whileInView: { opacity: 1, y: 0 } as const,
    viewport: { once: true, margin: '-60px' } as const,
    transition: { duration: 0.7, delay, ease: 'easeOut' } satisfies Transition,
  };
}

export default function AgencyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-zinc-50 selection:bg-amber-500/30 overflow-x-hidden">

      {/* ============================================================
          HERO — CASE FILE FOCUS
          ============================================================ */}
      <section className="relative px-8 pt-4 pb-24 max-w-7xl mx-auto w-full border-b border-zinc-900 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-amber-500/6 blur-[140px] rounded-full pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(245,158,11,0.5) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center pt-8">
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-6 tracking-widest"
            >
              <Link href="/industries" className="hover:text-amber-400 transition-colors">INDUSTRIES</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-amber-500">AGENCY_DOSSIER // EYES ONLY</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1, type: 'spring', stiffness: 140 }}
              className="inline-flex items-center gap-2 border border-amber-500/40 rounded-full px-4 py-1.5 text-xs font-mono text-amber-400 mb-8 tracking-widest"
            >
              <Lock className="h-3 w-3" /> ACCESS GRANTED — DOSSIER UNSEALED
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="font-serif text-5xl md:text-6xl lg:text-7xl font-medium tracking-tight leading-[1.05] mb-6"
            >
              You were not found.<br />
              <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-600">
                You were sought.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="text-xl text-zinc-400 leading-relaxed font-light mb-4 max-w-2xl"
            >
              There is no application for this. No form. No waiting room. If
              we&apos;ve reached out to you, it&apos;s because we see something
              worth building.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="text-xl text-zinc-200 leading-relaxed font-semibold mb-8 max-w-2xl"
            >
              The next era of talent commercialization pairs elite creative work with
             automated payouts — merch, design, and revenue routing, built
              around the moments that matter most.
              <span className="text-amber-400"> Your talent. Your terms. Our tools.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.65 }}
              className="flex gap-4"
            >
              <Link href="#mandate">
                <Button size="lg" className="h-12 px-8 bg-amber-500 hover:bg-amber-400 text-black rounded-none font-mono tracking-wide shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                  Read the Mandate <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </div>

          {/* Right: Case File Card */}
          <motion.div
            initial={{ opacity: 0, x: 30, rotate: 3 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.3, type: 'spring', stiffness: 90 }}
            className="relative hidden lg:flex items-center justify-center"
          >
            <div className="absolute -inset-6 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />

            <div className="relative z-10 w-full max-w-sm border border-amber-500/30 bg-zinc-950 shadow-[0_0_60px_rgba(245,158,11,0.15)]">
              <div className="flex items-center justify-between px-5 py-3 border-b border-amber-500/20 bg-zinc-900/60">
                <span className="font-mono text-[10px] text-amber-500 tracking-[0.25em]">CASE_FILE // PRIVATE</span>
                <span className="font-mono text-[10px] text-zinc-500">CLASS: VIP</span>
              </div>

              <div className="p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full border border-amber-500/40 flex items-center justify-center bg-black">
                    <Fingerprint className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">Subject: Verified Profile</p>
                    <p className="text-[11px] font-mono text-zinc-500">STATUS: UNDER REVIEW</p>
                  </div>
                </div>

                <div className="space-y-3 font-mono text-[11px]">
                  {[
                    ['BRAND POTENTIAL', 'HIGH'],
                    ['EVENT WINDOW', 'ACTIVE'],
                    ['MERCH READINESS', 'PENDING SETUP'],
                    ['PAYOUT ROUTE', 'DIRECT-TO-WALLET'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-zinc-900 pb-2">
                      <span className="text-zinc-500 tracking-widest">{k}</span>
                      <span className="text-amber-400">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-zinc-900">
                  <p className="text-[11px] font-mono text-zinc-600 tracking-widest">
                    &gt; Recommendation: <span className="text-emerald-400">APPROACH DIRECTLY</span>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============================================================
          BRIEF 01 — WHY YOU (tone pass: plain language, no jargon)
          ============================================================ */}
      <section className="relative px-8 py-24 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[280px_1fr] gap-16">
          <div className="space-y-8 lg:border-r lg:border-zinc-900 lg:pr-10">
            <p className="font-mono text-xs text-amber-500 tracking-[0.3em] uppercase">
              Brief 01 // Why You
            </p>

            <div className="space-y-6">
              {[
                { icon: Target, label: 'No open casting calls', sub: 'We scout, not screen' },
                { icon: Zap, label: 'No manual accounting', sub: 'Revenue routes automatically' },
                { icon: ShieldCheck, label: 'No upfront cost', sub: 'We earn only when you do' },
              ].map(({ icon: Icon, label, sub }) => (
                <motion.div key={label} {...fadeUp(0)} className="flex items-start gap-3">
                  <Icon className="h-4 w-4 text-amber-500 mt-1 shrink-0" />
                  <div>
                    <p className="text-sm text-zinc-200 font-medium">{label}</p>
                    <p className="text-xs text-zinc-500">{sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <motion.p {...fadeUp(0)} className="text-zinc-400 leading-relaxed font-light text-lg">
              MetaWork runs a selective VIP agency arm that works directly with
              fighters, athletes, musicians, and creators to coordinate merchandise,
              brand development, and product strategy around their careers and key
              moments.
            </motion.p>
            <motion.p {...fadeUp(0.15)} className="text-zinc-400 leading-relaxed font-light text-lg">
              Traditional merchandising and licensing deals are slow, opaque, and
              expensive to set up — and most talent never see clean, timely
              accounting from any of it. <span className="text-amber-400">We built
              around that problem.</span> We identify talent whose brand has real
              commercial potential, and we come to you.
            </motion.p>
            <motion.p {...fadeUp(0.3)} className="text-zinc-400 leading-relaxed font-light text-lg">
              This page exists for exactly one purpose: to explain, plainly, what
              happens if you say yes.
            </motion.p>
          </div>
        </div>
      </section>

      {/* ============================================================
          THE MANDATE (tone pass: intro simplified)
          ============================================================ */}
      <section id="mandate" className="relative px-8 py-24 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto">
          <p className="font-mono text-xs text-amber-500 tracking-[0.3em] uppercase mb-4">
            Brief 02 // The Mandate
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-medium mb-6 max-w-2xl">
            Three things we do. Nothing else.
          </h2>
          <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl mb-16">
            We don&apos;t just connect you to a platform. We work with you actively
            — here&apos;s what that looks like in practice.
          </p>

          <div className="space-y-px bg-zinc-900">

            {/* MANDATE 01 */}
            <motion.div {...fadeUp(0)} className="bg-black p-10 md:p-12 grid lg:grid-cols-[auto_1fr] gap-8 group hover:bg-zinc-950 transition-colors">
              <div className="flex items-start gap-6">
                <span className="font-mono text-6xl text-zinc-800 group-hover:text-amber-500/20 transition-colors leading-none">01</span>
                <Sparkles className="h-6 w-6 text-amber-500 mt-2" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3">We Time It — Merch Coordination</h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-6 max-w-2xl">
                  Fight week. Album drop. Competition day. Viral moment. These are your
                  highest-leverage commercial events — and most talent leave money on
                  the table because the merch isn&apos;t ready when the moment is. We
                  coordinate product development and launch timing so your merchandise
                  drops when your audience is paying attention. We handle the product
                  sourcing, the fulfillment, the storefront setup, and the campaign
                  calendar. You focus on your performance. We focus on making it pay.
                </p>
                <div className="grid sm:grid-cols-2 gap-6">
                  <ul className="space-y-2 text-xs text-zinc-400">
                    <li className="flex items-start"><Target className="h-3.5 w-3.5 text-amber-400 mr-2 mt-0.5 shrink-0" /> Fight-week drops timed to promotion and event cycles</li>
                    <li className="flex items-start"><Target className="h-3.5 w-3.5 text-amber-400 mr-2 mt-0.5 shrink-0" /> Album and tour merch coordinated with your release calendar</li>
                  </ul>
                  <ul className="space-y-2 text-xs text-zinc-400">
                    <li className="flex items-start"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mr-2 mt-0.5 shrink-0" /> Competition and event-week product activations</li>
                    <li className="flex items-start"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mr-2 mt-0.5 shrink-0" /> Ongoing between-event drops to keep revenue consistent</li>
                  </ul>
                </div>
              </div>
            </motion.div>

            {/* MANDATE 02 */}
            <motion.div {...fadeUp(0.1)} className="bg-black p-10 md:p-12 grid lg:grid-cols-[auto_1fr] gap-8 group hover:bg-zinc-950 transition-colors">
              <div className="flex items-start gap-6">
                <span className="font-mono text-6xl text-zinc-800 group-hover:text-amber-500/20 transition-colors leading-none">02</span>
                <Handshake className="h-6 w-6 text-amber-500 mt-2" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3">We Match It — Design Coordination</h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-6 max-w-2xl">
                  Not every product fits every talent. We work to match you with the
                  right merchandise — apparel, accessories, kits, collectibles — that
                  actually represents who you are. We coordinate with designers,
                  whether in-house or third-party, to make sure every piece looks like
                  it came from you. You have final say on everything that goes out
                  under your name.
                </p>
                <div className="grid sm:grid-cols-2 gap-6">
                  <ul className="space-y-2 text-xs text-zinc-400">
                    <li className="flex items-start"><Target className="h-3.5 w-3.5 text-amber-400 mr-2 mt-0.5 shrink-0" /> Dedicated design support for merch artwork and fight kits</li>
                    <li className="flex items-start"><Target className="h-3.5 w-3.5 text-amber-400 mr-2 mt-0.5 shrink-0" /> Sponsor logo coordination and product placement</li>
                  </ul>
                  <ul className="space-y-2 text-xs text-zinc-400">
                    <li className="flex items-start"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mr-2 mt-0.5 shrink-0" /> Campaign graphics and visual brand materials</li>
                    <li className="flex items-start"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mr-2 mt-0.5 shrink-0" /> Your approval required before anything goes live</li>
                  </ul>
                </div>
              </div>
            </motion.div>

            {/* MANDATE 03 */}
            <motion.div {...fadeUp(0.2)} className="bg-black p-10 md:p-12 grid lg:grid-cols-[auto_1fr] gap-8 group hover:bg-zinc-950 transition-colors">
              <div className="flex items-start gap-6">
                <span className="font-mono text-6xl text-zinc-800 group-hover:text-amber-500/20 transition-colors leading-none">03</span>
                <Zap className="h-6 w-6 text-amber-500 mt-2" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3">We Protect It — And Pay It Out Automatically</h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-6 max-w-2xl">
                  Your brand — your name, your face, your footage, your logos — is
                  the asset. We establish verifiable ownership records for your
                  creative work, so every licensing use and downstream sale routes
                  revenue back to you automatically. No manual accounting, no
                  waiting on checks, no chasing down a split between you, your team,
                  and your designer — it just arrives. Nothing gets used without
                  your sign-off.
                </p>
                <div className="grid sm:grid-cols-2 gap-6">
                  <ul className="space-y-2 text-xs text-zinc-400">
                    <li className="flex items-start"><Target className="h-3.5 w-3.5 text-amber-400 mr-2 mt-0.5 shrink-0" /> Verifiable, provable ownership of your work</li>
                  </ul>
                  <ul className="space-y-2 text-xs text-zinc-400">
                    <li className="flex items-start"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mr-2 mt-0.5 shrink-0" /> Automatic payout — no manual accounting</li>
                  </ul>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ============================================================
          BRIEF 03 — THE EXTENDED TEAM
          ============================================================ */}
      <section className="px-8 py-24 border-t border-zinc-900 bg-zinc-950/40">
        <div className="max-w-6xl mx-auto">
          <p className="font-mono text-xs text-amber-500 tracking-[0.3em] uppercase mb-4">
            Brief 03 // The Extended Team
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-medium mb-6 max-w-2xl">
            You get a commercial division. Not a vendor.
          </h2>
          <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl mb-16">
            Three parties work behind every deal — you never have to manage the
            seams between them.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: UserCog,
                role: 'Your Manager',
                body: 'Handles strategic brand direction, opens conversations, and coordinates every opportunity so it fits your long-term plan — not just the next drop.',
              },
              {
                icon: Palette,
                role: 'Your Designer',
                body: 'Produces the merch artwork, fight kits, and campaign assets directly with you — negotiating scope, style, and deadlines one-on-one.',
              },
              {
                icon: Cpu,
                role: 'The MetaWork Platform',
                body: 'Runs the operational backbone — fulfillment, storefronts, and payouts — so revenue reaches everyone on the team automatically, the moment it comes in.',
              },
            ].map(({ icon: Icon, role, body }, i) => (
              <motion.div key={role} {...fadeUp(i * 0.1)}>
                <Card className="bg-black border-zinc-800 hover:border-amber-500/30 transition-all h-full">
                  <CardHeader>
                    <Icon className="h-6 w-6 text-amber-400 mb-3" />
                    <CardTitle className="text-white text-lg">{role}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-zinc-400 leading-relaxed">
                    {body}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          BRIEF 04 — THE PATH (4-phase workflow)
          ============================================================ */}
      <section className="relative px-8 py-24 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono text-xs text-amber-500 tracking-[0.3em] uppercase mb-4">
            Brief 04 // The Path
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-medium mb-14">
            What actually happens, in order.
          </h2>

          <div className="relative border-l border-zinc-800 ml-3 space-y-14">
            {[
              { phase: 'Phase 1', title: 'Intake & Briefing', body: 'You share brand assets, likeness approvals, and style references. We confirm scope in writing before anything begins.' },
              { phase: 'Phase 2', title: 'Calendar Integration', body: 'Your upcoming fights, releases, or events get mapped against a merch and campaign calendar built around your career, not ours.' },
              { phase: 'Phase 3', title: 'Design & Approval', body: 'Concepts and proofs come back for your review. Nothing launches without your final sign-off.' },
              { phase: 'Phase 4', title: 'Launch & Payout', body: 'Product goes live, sales route through fulfillment automatically, and revenue reaches you and your team without a manual step in between.' },
            ].map(({ phase, title, body }, i) => (
              <motion.div key={phase} {...fadeUp(i * 0.1)} className="relative pl-10">
                <div className="absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]" />
                <p className="font-mono text-xs text-amber-500 tracking-widest mb-2">{phase}</p>
                <h3 className="text-xl font-bold mb-2">{title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed max-w-xl">{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          BRIEF 05 — THE TERMS (jargon cut, SERVICE SPLITS row removed)
          ============================================================ */}
      <section className="relative px-8 py-24 border-t border-zinc-900 bg-zinc-950/40">
        <div className="max-w-3xl mx-auto">
          <p className="font-mono text-xs text-amber-500 tracking-[0.3em] uppercase mb-4">
            Brief 05 // The Terms
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-medium mb-6">
            How the relationship works.
          </h2>
          <p className="text-zinc-400 leading-relaxed font-light text-lg mb-10 max-w-2xl">
            The agency operates on a profit-share model — we earn a percentage of
            gross profit from the initiatives we develop and manage for you. There
            are no large upfront fees, no retainers. We have skin in the game
            because our income depends on your success. The agency acts as a
            non-exclusive commercial representative — you keep ownership of your
            IP, you keep your existing relationships. We extend your team; we
            don&apos;t replace it.
          </p>

          <motion.div {...fadeUp(0)} className="border border-zinc-800 divide-y divide-zinc-800 font-mono text-sm">
            {[
              ['RELATIONSHIP', 'Non-exclusive commercial representation. You keep your existing sponsors, promoters, and partners.'],
              ['REVENUE MODEL', 'Percentage of gross revenue we generate together — set per relationship, confirmed in writing'],
              ['UPFRONT COST', 'None. No retainers, no signing fees'],
              ['IP OWNERSHIP', 'Remains yours. Always'],
              ['APPROVAL RIGHTS', 'Nothing launches without your written sign-off'],
              ['GOVERNING LAW', 'State of Arizona · Venue: Tucson'],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8 px-6 py-5">
                <span className="text-zinc-500 tracking-widest w-48 shrink-0">{label}</span>
                <span className="text-zinc-200">{value}</span>
              </div>
            ))}
          </motion.div>
          <p className="text-xs text-zinc-600 mt-6 font-mono">
            * Full terms delivered in a formal written agreement before anything is signed.
          </p>
        </div>
      </section>

      {/* ============================================================
          BRIEF 06 — THE ROSTER
          ============================================================ */}
      <section className="relative px-8 py-24 border-t border-zinc-900">
        <div className="max-w-7xl mx-auto">
          <p className="font-mono text-xs text-amber-500 tracking-[0.3em] uppercase mb-4">
            Brief 06 // The Roster
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-medium mb-4">
            Who we work with.
          </h2>
          <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl mb-12">
            Four core talent categories, each with their own commercial timing and
            product strategy.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Trophy, label: 'Fighters', moments: 'Fight weeks, title shots, career milestones', products: 'Fight kits, apparel, collectibles' },
              { icon: Star, label: 'Musicians', moments: 'Album drops, tours, sync placements', products: 'Tour merch, apparel, limited drops' },
              { icon: BarChart3, label: 'Extreme Athletes', moments: 'Competition season, sponsor campaigns', products: 'Gear, apparel, sponsor collabs' },
              { icon: Camera, label: 'Creators & IP', moments: 'Content launches, IP licensing, brand events', products: 'Licensed merch, apparel, collectibles' },
            ].map(({ icon: Icon, label, moments, products }, i) => (
              <motion.div key={label} {...fadeUp(i * 0.08)}>
                <Card className="bg-black border-zinc-800 hover:border-amber-500/30 transition-all h-full">
                  <CardHeader>
                    <Icon className="h-6 w-6 text-amber-400 mb-3" />
                    <CardTitle className="text-white text-lg">{label}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-zinc-400 space-y-3">
                    <p><span className="text-zinc-500 font-mono">MOMENTS:</span> {moments}</p>
                    <p><span className="text-zinc-500 font-mono">PRODUCTS:</span> {products}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          CLOSING (restored to direct, plain copy)
          ============================================================ */}
      <section className="relative px-8 py-32 border-t border-zinc-900 text-center overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none">
          <Lock className="w-[700px] h-[700px]" />
        </div>

        <div className="max-w-2xl mx-auto relative z-10">
          <motion.div
            initial={{ scale: 2, opacity: 0, rotate: -20 }}
            whileInView={{ scale: 1, opacity: 1, rotate: -8 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 120, damping: 10 }}
            className="inline-flex items-center gap-2 border-[3px] border-amber-500 text-amber-500 px-6 py-2 font-mono text-sm tracking-[0.3em] uppercase select-none mb-10"
          >
            <Stamp className="h-4 w-4" /> Invitation Only
          </motion.div>

          <motion.h2 {...fadeUp(0.1)} className="font-serif text-3xl md:text-4xl font-medium mb-6">
            You were approached for a reason.
          </motion.h2>
          <motion.p {...fadeUp(0.2)} className="text-zinc-400 leading-relaxed mb-4">
            We don&apos;t chase volume. The agency takes on talent we believe in —
            because our model only works if yours does. If you&apos;re reading this,
            we&apos;ve already identified your brand as one worth developing.
          </motion.p>
          <motion.p {...fadeUp(0.3)} className="text-zinc-400 leading-relaxed mb-12">
            This dossier doesn&apos;t end with a form — it ends with the conversation
            that&apos;s already started. Reply to the person who reached out to you,
            or use the meeting link included in that outreach, to pick up where you
            left off. No pressure. No commitment.
          </motion.p>

          <motion.p {...fadeUp(0.4)} className="text-xs text-zinc-600 font-mono tracking-widest">
            [ Check the message that brought you here for your point of contact ]
          </motion.p>

          <p className="text-xs text-amber-500 font-mono tracking-widest mt-10">
            Your talent. Your terms. Our tools.
          </p>
        </div>
      </section>

    </div>
  );
}