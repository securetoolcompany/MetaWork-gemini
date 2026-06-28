import { Button } from '@/components/ui/button';
import {
  Terminal, ChevronRight, Star, Target,
  CheckCircle2, AlertTriangle, DollarSign,
  Ticket, Users, Megaphone, Trophy, TrendingUp,
  BarChart2, Coins
} from 'lucide-react';
import Link from 'next/link';

export default function PromotionsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-amber-500/30">

      {/* HERO */}
      <section className="relative px-8 pt-4 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-amber-500/6 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
            <Link href="/industries" className="hover:text-amber-400 transition-colors">INDUSTRIES</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-amber-400">PROMOTION_DEPLOYMENT_MODULE</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            More revenue.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              Every event.
            </span>
          </h1>

          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-4 max-w-2xl">
            You handle the venue, the fight card, the sanctioning, the production.
            That&apos;s already a full-time job. MetaWork doesn&apos;t add to it —
            it plugs into the event you&apos;re already running and makes it generate more.
          </p>

          <p className="text-xl text-zinc-200 leading-relaxed font-semibold mb-8 max-w-2xl">
            More per ticket. Happier fighters. Sponsors with reach they can prove.
            Revenue that keeps coming in after the final bell.
            <span className="text-amber-400"> Zero new overhead.</span>
          </p>

          <Link href="/register">
            <Button size="lg" className="h-12 px-8 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-none font-mono shadow-[0_0_20px_rgba(217,119,6,0.25)]">
              <Terminal className="mr-2 h-4 w-4" /> Initialize Promotion Aisle
            </Button>
          </Link>
        </div>
      </section>

      {/* THE PROBLEM */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-5xl mx-auto border border-zinc-800 bg-zinc-900/40 p-10 md:p-16 shadow-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono mb-8">
            <AlertTriangle className="h-3.5 w-3.5" />
            SYSTEM_WARNING: REVENUE_LEAK_DETECTED
          </div>

          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
            Every ticket sold is leaving money on the table.
          </h2>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6 text-zinc-400 leading-relaxed font-light">
              <p>
                A ticket gets a fan through the door. That&apos;s it. No bundle.
                No collectible. No reason to buy early, share the event, or come back
                next time. Fighters sell tickets because you ask them to — but once
                the event is over, that revenue is over too. And when the arena goes
                dark, your sponsors&apos; banners go with it.
              </p>
              <p>
                You&apos;re leaving money on the table at every single event —
                not because you&apos;re running it wrong, but because the tools
                haven&apos;t existed to capture it.{' '}
                <strong className="text-zinc-200">Until now.</strong>
              </p>
            </div>
            <div className="space-y-6 text-zinc-400 leading-relaxed font-light">
              <p>
                <strong className="text-amber-400">MetaWork plugs in as a revenue layer.</strong>{' '}
                Tickets become bundles. Fighters become retention assets. Your sponsors&apos;
                brands travel with every fighter card and event collectible — long past fight
                night. And every event you run generates passive royalty income that keeps
                earning while you&apos;re already planning the next one.
              </p>
              <p>
                You don&apos;t integrate a new system. You don&apos;t retrain your staff.
                You run your event exactly as you do today —{' '}
                <strong className="text-zinc-200">
                  MetaWork layers revenue on top of what you&apos;re already doing.
                </strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FLAGSHIP: EVENT CARD */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono mb-6 rounded">
            <Star className="h-3 w-3" />
            FLAGSHIP_PRODUCT
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">

            {/* Copy */}
            <div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
                The Event Card.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                  Your Night. Immortalized.
                </span>
              </h2>
              <p className="text-zinc-400 leading-relaxed font-light mb-6 text-lg">
                Every event you run gets its own tokenized Event Card — a permanent
                collectible that captures the full fight card, results, KO of the night,
                and attendance. Sold bundled with tickets, it increases your average order
                value immediately.
              </p>
              <p className="text-zinc-400 leading-relaxed font-light mb-8">
                Early buyers get presale priority on your next event — creating urgency
                to buy before the fight card is even announced. After fight night, the card
                becomes a verified historical artifact fans collect and trade. Every time it
                changes hands,{' '}
                <strong className="text-zinc-200">
                  your promotion earns a royalty automatically.
                </strong>{' '}
                Revenue after the lights go off. No additional work required.
              </p>

              <div className="space-y-3 mb-10">
                {[
                  { icon: Ticket,     label: 'Bundled with tickets — average order value up from day one' },
                  { icon: BarChart2,  label: 'Full fight card, results & KO of the night — auto-updated live' },
                  { icon: Users,      label: 'Early holders get next-event presale priority — drives advance sales' },
                  { icon: DollarSign, label: 'Secondary market royalties — passive income long after fight night' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 px-4 py-3 bg-zinc-900/50 border border-zinc-800">
                    <Icon className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-sm text-zinc-400">{label}</span>
                  </div>
                ))}
              </div>

              <Link href="/register">
                <Button size="lg" className="h-12 px-8 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-none font-mono">
                  <Trophy className="mr-2 h-4 w-4" /> Mint Your Event Card
                </Button>
              </Link>
            </div>

            {/* Event Card Mock */}
            <div className="relative mx-auto w-[300px] select-none">
              <div className="absolute -inset-6 bg-amber-500/15 blur-3xl rounded-full pointer-events-none animate-pulse" />
              <div className="relative border-2 border-amber-500/60 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[0_0_60px_rgba(217,119,6,0.25)] overflow-hidden">

                <div className="bg-gradient-to-r from-amber-900/80 to-zinc-900 px-4 py-2 flex justify-between items-center border-b border-amber-500/30">
                  <span className="text-[10px] font-mono text-amber-400 tracking-widest">METAWORK /// EVENT</span>
                  <span className="text-[10px] font-mono text-zinc-500">#042 / 1000</span>
                </div>

                <div className="bg-gradient-to-b from-zinc-900 via-amber-950/20 to-zinc-950 px-4 pt-6 pb-4">
                  <p className="text-lg font-black tracking-tight text-white leading-none">IRON SUMMIT XII</p>
                  <p className="text-[11px] font-bold text-amber-400 tracking-widest mt-1">MAIN CARD · OCT 18</p>
                </div>

                <div className="grid grid-cols-3 border-t border-amber-500/30">
                  {[
                    { label: 'BOUTS',    value: '10',   color: 'text-amber-400' },
                    { label: 'CAPACITY', value: '4.2K', color: 'text-orange-400' },
                    { label: 'SOLD OUT', value: '98%',  color: 'text-emerald-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center py-3 border-r border-zinc-800 last:border-0">
                      <span className={`text-xl font-black ${color}`}>{value}</span>
                      <span className="text-[9px] font-mono text-zinc-500 tracking-widest">{label}</span>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3 border-t border-zinc-800 space-y-2">
                  <p className="text-[9px] font-mono text-zinc-500 tracking-widest mb-2">FIGHT_CARD</p>
                  {[
                    { bout: 'MAIN EVENT', fighters: 'Rivera vs. Okafor',   result: 'KO R2',  color: 'text-amber-400' },
                    { bout: 'CO-MAIN',    fighters: 'Park vs. Reyes',      result: 'DEC',    color: 'text-zinc-400' },
                    { bout: 'MAIN CARD',  fighters: 'Torres vs. Williams', result: 'SUB R3', color: 'text-zinc-400' },
                  ].map(({ bout, fighters, result, color }) => (
                    <div key={bout} className="flex justify-between items-center text-[10px]">
                      <div>
                        <span className={`font-mono ${color}`}>{bout}</span>
                        <p className="text-zinc-400">{fighters}</p>
                      </div>
                      <span className="font-mono text-zinc-500">{result}</span>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3 space-y-2 border-t border-zinc-800">
                  {[
                    { label: 'TICKET + BUNDLE REV.', value: 86, display: '$312K', color: '#f59e0b' },
                    { label: 'SPONSOR REACH',         value: 74, display: '1.2M',  color: '#fb923c' },
                    { label: 'POST-EVENT ROYALTIES',  value: 38, display: '$8.4K', color: '#34d399' },
                    { label: 'FIGHTER RETENTION',     value: 92, display: '11/12', color: '#60a5fa' },
                  ].map(({ label, value, display, color }) => (
                    <div key={label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-mono text-zinc-500 tracking-widest">{label}</span>
                        <span className="text-[11px] font-black" style={{ color }}>{display}</span>
                      </div>
                      <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color, boxShadow: `0 0 6px ${color}` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-gradient-to-r from-amber-900/40 to-zinc-900/60 px-4 py-2 flex justify-between items-center border-t border-amber-500/20">
                  <span className="text-[9px] font-mono text-amber-500/70 tracking-widest">PLATINUM EVENT</span>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    ))}
                  </div>
                  <span className="text-[9px] font-mono text-zinc-500">METAWORK.IO</span>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* DEPLOYMENT TRACKS */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Promotion Deployment Tracks
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
              Four revenue channels that run alongside your event — not instead of anything you already do.
            </p>
          </div>

          <div className="space-y-12">

            {/* TRACK 01 */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-amber-500/30 transition-all group">
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-amber-500/10 px-2 py-1 text-xs font-mono text-amber-400 mb-4 border border-amber-500/20">
                    TRACK_01: FIGHTER_MERCH_BUNDLES
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Your Fighters Are Already Selling. Give Them More to Sell.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Every fighter on your card is already texting family, friends, and
                    their hometown crew asking them to come out. Those people are going
                    to buy a ticket regardless — but with MetaWork, they can buy a ticket
                    <em> plus</em> a shirt with their fighter's name and face on it.
                    That's a real purchase with personal meaning. The fighter pushes it
                    harder because it's <em>their</em> brand. The fan buys it because
                    it's someone they actually know. You capture the upside on both.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-amber-400" /> Promotion Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Turn every fighter's personal network into a higher-value sale.</li>
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Give fighters a reason to sell harder — it's their name and likeness on the product.</li>
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Capture merch margin with zero inventory risk or fulfillment work.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Per-fighter merch — shirts, hoodies, bags with their name, image, and fight date.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Shareable fighter bundle links — ready to drop in a text or Instagram story.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Print-on-demand fulfillment — fans order, we ship, you collect the margin.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 02 */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-amber-500/30 transition-all group">
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-amber-500/10 px-2 py-1 text-xs font-mono text-amber-400 mb-4 border border-amber-500/20">
                    TRACK_02: FIGHTER_RETENTION
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Fighters Come Back Because You Give Them More</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    A fighter who can sell merch, protect their IP, and grow a fanbase
                    through your promotion has a reason to sign with you again. MetaWork
                    makes your promotion the place where fighters build their brand —
                    not just collect a purse.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-amber-400" /> Promotion Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Retain top fighters without outbidding competitors on purse alone.</li>
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Attract rising talent that values brand-building, not just money.</li>
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Build a roster with genuine loyalty to your platform.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Fighter merch Aisles — zero-inventory, zero management for the promotion.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Fighter Card NFTs — fighters build fanbases between your events.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> IP tokenization — fighters protect and monetize their brand on your platform.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 03 */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-amber-500/30 transition-all group">
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-amber-500/10 px-2 py-1 text-xs font-mono text-amber-400 mb-4 border border-amber-500/20">
                    TRACK_03: SPONSOR_DISTRIBUTION
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Your Sponsors Are on Every Card in the Building</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    When a sponsor signs with your promotion, their brand doesn&apos;t just go
                    on a banner — it gets minted onto every Fighter Card, every Event Card,
                    and every ticket bundle that goes out. Your 4,000 attendees become 4,000
                    placements. The fighters&apos; card holder communities carry that brand
                    between events. It travels with the content, not just the venue.
                    That&apos;s a product worth charging a premium for.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-amber-400" /> Promotion Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Charge more for sponsorships — digital placement outlasts the event.</li>
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Offer tiered packages: arena, card, network — each with verified reach.</li>
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Retain sponsors long-term because they can prove their ROI.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Sponsor logo minted onto Fighter Cards, Event Cards, and bundles.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> On-chain impression count — auditable by the sponsor directly.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Post-event sponsor report auto-generated — your debrief, done.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 04 */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-amber-500/30 transition-all group">
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-amber-500/10 px-2 py-1 text-xs font-mono text-amber-400 mb-4 border border-amber-500/20">
                    TRACK_04: POST_EVENT_REVENUE
                  </div>
                  <h3 className="text-2xl font-bold mb-4">The Event Keeps Earning After It&apos;s Over</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Most promotions earn until the final bell. With MetaWork, that&apos;s
                    just the beginning. Every Event Card trade on the secondary market
                    triggers an automatic royalty back to your promotion. Highlight clips
                    licensed through the network pay you. Fighter IP usage from press and
                    broadcast routes revenue to the source. You&apos;re already moving on
                    to the next event — this one is still paying you.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-amber-400" /> Promotion Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Generate income from events you&apos;ve already produced — zero extra work.</li>
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Build a revenue catalog that compounds with every event you run.</li>
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Turn your archive of past events into ongoing royalty-generating assets.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Automatic royalty routing on every Event Card secondary sale.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Highlight and content licensing — usage fees paid to the promotion.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Revenue dashboard — see exactly what each past event is still earning.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* TERMINAL MOCKUP */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
          <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between items-center">
            <div className="flex gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500/20" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/20" />
              <div className="h-3 w-3 rounded-full bg-green-500/20" />
            </div>
            <span className="text-[10px] font-mono text-amber-400">/promotion/iron-summit-xii/settlement</span>
            <div className="w-4" />
          </div>
          <div className="p-8 font-mono text-sm space-y-4">
            <div className="text-amber-400 mb-4 tracking-tighter uppercase font-bold text-xs">
              EVENT: IRON_SUMMIT_XII · OCT 18 · SETTLED
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 text-zinc-400 text-xs">
              <div>
                <div className="text-[10px] text-zinc-600 mb-1">TICKETS_SOLD</div>
                <div className="text-zinc-100 text-lg font-bold">4,118</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-600 mb-1">BUNDLE_UPLIFT</div>
                <div className="text-amber-400 text-lg font-bold">+$38,200</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-600 mb-1">SPONSOR_REACH</div>
                <div className="text-orange-400 text-lg font-bold">847K</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-600 mb-1">POST-EVENT_YIELD</div>
                <div className="text-emerald-400 text-lg font-bold">$4,210</div>
              </div>
            </div>
            <div className="text-zinc-600 text-[10px] space-y-1.5 border-t border-zinc-800 pt-4">
              <div className="text-amber-500/60 mb-2">SMART_CONTRACT_LOG &gt;</div>
              <div className="flex gap-4">
                <span className="text-zinc-700">[18:04:12]</span>
                <span>4,118 Event Card bundles delivered at point of ticket purchase.</span>
              </div>
              <div className="flex gap-4">
                <span className="text-zinc-700">[18:04:44]</span>
                <span>TitanGear logo minted onto 4,118 Event Cards + 12 Fighter Cards — 847,200 verified placements logged.</span>
              </div>
              <div className="flex gap-4">
                <span className="text-zinc-700">[21:38:03]</span>
                <span className="text-emerald-400/70">Fighter purse distribution triggered — 12 recipients settled in 4 seconds.</span>
              </div>
              <div className="flex gap-4">
                <span className="text-zinc-700">[Oct 19 · 09:14]</span>
                <span className="text-amber-400/70">Event Card secondary trades: 38 · Royalties to promotion: $420.00 — no action required.</span>
              </div>
              <div className="flex gap-4">
                <span className="text-zinc-700">[Oct 22 · 11:02]</span>
                <span className="text-amber-400/70">Highlight clip licensed by ESPN Digital — $3,790.00 routed to promotion wallet.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="px-8 py-24 bg-zinc-900/30 border-t border-zinc-800/50 text-center relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <Trophy className="w-[800px] h-[800px]" />
        </div>
        <div className="max-w-2xl mx-auto relative z-10">
          <h2 className="text-3xl font-bold tracking-tight mb-6">
            Your next event is your next revenue record.
          </h2>
          <p className="text-zinc-400 mb-10 text-lg">
            Plug MetaWork in before your next fight night. No new staff. No new systems.
            Just more revenue from the event you were already going to run — and passive
            income from every event after that.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 bg-white text-black hover:bg-zinc-200 rounded-none font-bold tracking-wide">
                Set Up Your Promotion Aisle
              </Button>
            </Link>
            <Link href="/how-it-works/promotions">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-none font-mono">
                See How It Works <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}