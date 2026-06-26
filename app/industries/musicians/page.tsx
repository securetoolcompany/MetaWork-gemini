import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Terminal, ArrowRight, ShieldCheck, ChevronRight, Trophy, Target,
  CheckCircle2, AlertTriangle, Fingerprint,
  DollarSign, Shirt, Star, Users, Camera, BarChart2, Package,
  Music, Mic2, Radio, Headphones, Disc3, TrendingUp
} from 'lucide-react';
import Link from 'next/link';

export default function MusicianPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-emerald-500/30">

      {/* ============================================================
          HERO SECTION
          ============================================================ */}
      <section className="relative px-8 pt-4 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-emerald-500/6 blur-[120px] rounded-full pointer-events-none" />

        {/* TWO COLUMN GRID */}
        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">

          {/* Left: Copy */}
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
              <Link href="/industries" className="hover:text-emerald-400 transition-colors">INDUSTRIES</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-emerald-400">ARTIST_DEPLOYMENT_MODULE</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
              Your music.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">
                Your money.
              </span>
            </h1>

            <p className="text-xl text-zinc-400 leading-relaxed font-light mb-4 max-w-2xl">
              You write the songs. You record the tracks. You build the fanbase from nothing.
              And at the end of the day, the label, the platform, and the promoter split the upside
              while you split the bill.
            </p>

            <p className="text-xl text-zinc-200 leading-relaxed font-semibold mb-8 max-w-2xl">
              MetaWork changes that. Sell your merch. Own your masters.
              Pay your whole band and team automatically — every release, every show.
              Build a fanbase that pays you between albums.
              <span className="text-emerald-400"> Your sound. Your terms.</span>
            </p>

            <div className="flex gap-4">
              <Link href="/register">
                <Button size="lg" className="h-12 px-8 bg-emerald-700 hover:bg-emerald-600 text-white rounded-none font-mono shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <Terminal className="mr-2 h-4 w-4" /> Initialize Artist Aisle
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: Hero Image */}
          <div className="relative hidden lg:flex items-center justify-center">
            <div className="absolute -inset-4 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
            <img
              src="/images/musicians-hero.jpg"
              alt="Artist in the studio"
              width={560}
              height={660}
              loading="eager"
              className="relative z-10 w-full h-full object-cover object-top"
              style={{
                maskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
              }}
            />
          </div>

        </div>
      </section>

      {/* ============================================================
          THE PARADIGM SHIFT — Artist IP Exploitation
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10 border border-zinc-800 bg-zinc-900/40 p-10 md:p-16 shadow-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-8">
            <AlertTriangle className="h-3.5 w-3.5" />
            SYSTEM_WARNING: ARTIST_EXPLOITATION
          </div>

          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
            You make the music. You own the asset.
          </h2>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6 text-zinc-400 leading-relaxed font-light">
              <p>
                The music industry has always been engineered to extract value from the people who
                create it. Labels capture your masters. Streaming platforms sell ads against your
                catalog for fractions of a cent. Sync licenses generate thousands in placement fees
                — most of which never reach the artist. A recording you made in your bedroom at 2am
                ends up in a commercial, and someone else cashes the check.
              </p>
              <p>
                Your voice, your lyrics, your cover art, your name, your likeness — these are
                intellectual property. Right now they live on platforms that profit from your
                creativity without proportional return.{' '}
                <strong className="text-zinc-200">That ends here.</strong>
              </p>
            </div>
            <div className="space-y-6 text-zinc-400 leading-relaxed font-light">
              <p>
                <strong className="text-emerald-400">MetaWork puts you in control.</strong> Mint
                your recordings, stems, cover art, lyrics, and likeness as on-chain IP assets.
                Every sync placement, every license, every downstream use routes royalties directly
                to your wallet — automatically, trustlessly, forever.
              </p>
              <p>
                Your show revenue hits the blockchain and the smart contract distributes to every
                band member, producer, manager, and session player in seconds. No awkward
                conversations. No delayed wire transfers. No confusion.{' '}
                <strong className="text-zinc-200">
                  Everyone who built your sound gets paid when your sound pays.
                </strong>
              </p>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-zinc-800 flex items-center gap-4">
            <Music className="h-8 w-8 text-emerald-500 opacity-50" />
            <Fingerprint className="h-8 w-8 text-teal-500 opacity-50" />
            <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest ml-4">
              &gt; Your catalog is an asset. Secure it.
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================
          FLAGSHIP FEATURE: ARTIST CARD
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/4 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">

          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono mb-6 rounded">
            <Star className="h-3 w-3" />
            FLAGSHIP_PRODUCT
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">

            {/* Left: Editorial copy */}
            <div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
                The Artist Card.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                  Your Brand. Alive.
                </span>
              </h2>
              <p className="text-zinc-400 leading-relaxed font-light mb-6 text-lg">
                The Artist Card is the ultimate fan engagement, monetization, and legacy tool for
                any musician. It's not a digital collectible sitting in a wallet — it's a living,
                updatable asset that grows with your career, your catalog, and your fanbase.
              </p>
              <p className="text-zinc-400 leading-relaxed font-light mb-8">
                Fans who hold your Artist Card get exclusive access to upcoming show dates and
                setlists, unreleased tracks and stems, studio session footage, early merch drops,
                and VIP listening parties. Hit a streaming milestone? Unlock a new card tier.
                Drop a new album? Trigger an automatic exclusive for every card holder.
                The more you create, the more valuable your card becomes — for you and everyone
                who believed in you early.
              </p>
              <div className="space-y-3 mb-10">
                {[
                  { icon: BarChart2,  label: 'Live discography, show schedule & streaming stats — always current' },
                  { icon: Users,      label: 'Fan engagement dashboard — see who holds your card' },
                  { icon: Headphones, label: 'Exclusive drops — unreleased tracks, stems, studio sessions' },
                  { icon: DollarSign, label: 'Holder-only merch unlocks & album release drops' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 px-4 py-3 bg-zinc-900/50 border border-zinc-800">
                    <Icon className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-sm text-zinc-400">{label}</span>
                  </div>
                ))}
              </div>
              <Link href="/register">
                <Button size="lg" className="h-12 px-8 bg-emerald-700 hover:bg-emerald-600 text-white rounded-none font-mono shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <Disc3 className="mr-2 h-4 w-4" /> Mint Your Artist Card
                </Button>
              </Link>
            </div>

            {/* Right: Animated Artist Card Mock */}
            <div className="relative mx-auto w-[300px] select-none">
              {/* Ambient glow */}
              <div className="absolute -inset-6 bg-emerald-500/15 blur-3xl rounded-full pointer-events-none animate-pulse" />

              {/* The Card */}
              <div className="relative border-2 border-emerald-500/60 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[0_0_60px_rgba(16,185,129,0.25)] overflow-hidden">

                {/* Card Header Bar */}
                <div className="bg-gradient-to-r from-emerald-900/80 to-zinc-900 px-4 py-2 flex justify-between items-center border-b border-emerald-500/30">
                  <span className="text-[10px] font-mono text-emerald-400 tracking-widest">METAWORK /// ARTIST</span>
                  <span className="text-[10px] font-mono text-zinc-500">#001 / 500</span>
                </div>

                {/* Animated Artist Stage */}
                <div className="relative bg-gradient-to-b from-zinc-900 via-emerald-950/20 to-zinc-950 overflow-hidden" style={{ height: '260px' }}>

                  {/* Spotlight */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-full pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.09) 0%, transparent 70%)' }} />

                  {/* Artist GIF */}
                  <img
                    src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExb2I0bG5xNzJ5Z3FhdG1uZjJ5eHFvd2E3bDE5Yzg4aXR6emw1Y3E2NyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/NoSpzLNlWGm8I7rHei/giphy.gif"
                    alt="Artist performing"
                    width={260}
                    height={260}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                    style={{ mixBlendMode: 'lighten' }}
                  />

                  {/* Bottom fade */}
                  <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />

                  {/* Name Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                    <p className="text-lg font-black tracking-tight text-white leading-none">NOVA CROSS</p>
                    <p className="text-sm font-bold text-emerald-400 tracking-widest">SINGER · SONGWRITER</p>
                  </div>
                </div>

                {/* Discography Stats Bar */}
                <div className="grid grid-cols-3 border-t border-emerald-500/30">
                  {[
                    { label: 'ALBUMS',  value: '3',   color: 'text-emerald-400' },
                    { label: 'SINGLES', value: '24',  color: 'text-teal-400' },
                    { label: 'PLAYS',   value: '14M', color: 'text-zinc-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center py-3 border-r border-zinc-800 last:border-0">
                      <span className={`text-2xl font-black ${color}`}>{value}</span>
                      <span className="text-[9px] font-mono text-zinc-500 tracking-widest">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Artist Stats — card style */}
                <div className="px-4 py-3 space-y-2.5 border-t border-zinc-800">
                  {[
                    { label: 'MONTHLY LISTENERS', value: 82, display: '820K',  color: '#10b981' },
                    { label: 'SYNC PLACEMENTS',   value: 65, display: '12',    color: '#14b8a6' },
                    { label: 'MERCH REVENUE',      value: 74, display: '$18K',  color: '#f59e0b' },
                    { label: 'SHOW SELL-THROUGH',  value: 91, display: '91%',   color: '#a78bfa' },
                    { label: 'CARD HOLDERS',        value: 58, display: '1,204', color: '#60a5fa' },
                  ].map(({ label, value, display, color }) => (
                    <div key={label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-mono text-zinc-500 tracking-widest">{label}</span>
                        <span className="text-[11px] font-black" style={{ color }}>{display}</span>
                      </div>
                      <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${value}%`,
                            background: color,
                            boxShadow: `0 0 6px ${color}`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Upcoming Show */}
                <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/40">
                  <p className="text-[9px] font-mono text-zinc-500 tracking-widest mb-2">NEXT_SHOW</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-300 font-semibold">Red Rocks Amphitheatre</span>
                    <span className="text-[10px] font-mono text-emerald-400">AUG 14</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Morrison, CO · Card holders get early access</p>
                </div>

                {/* Card Footer */}
                <div className="bg-gradient-to-r from-emerald-900/40 to-zinc-900/60 px-4 py-2 flex justify-between items-center border-t border-emerald-500/20">
                  <span className="text-[9px] font-mono text-emerald-500/70 tracking-widest">PLATINUM TIER</span>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`h-1.5 w-1.5 rounded-full ${i < 5 ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                    ))}
                  </div>
                  <span className="text-[9px] font-mono text-zinc-500">METAWORK.IO</span>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          DEPLOYMENT TRACKS
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Artist Deployment Tracks
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
              Four turn-key pipelines built for the independent artist — bedroom producer to
              arena headliner, any genre, any stage of career.
            </p>
          </div>

          <div className="space-y-12">

            {/* ── TRACK 01: MERCH DROPS ── */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-emerald-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Package className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-emerald-500/10 px-2 py-1 text-xs font-mono text-emerald-400 mb-4 border border-emerald-500/20">
                    TRACK_01: MERCH_DROPS
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Drop Merch. On Every Release.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Create products with your album art, tour photography, and original logos
                    directly in MetaWork. List them in your personal Aisle. Fans order, we
                    manufacture and ship globally. You collect in USDC. No warehouse. No box
                    of unsold tees. No upfront risk — just your art on products your fans
                    actually want.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-emerald-400" /> Artist Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Monetize your fanbase between albums and tours.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Launch album-release drops with zero lead time.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Get paid in USDC — stable, fast, no bank delay.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Drag-and-drop product designer with your minted IP.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Global print-on-demand manufacturing and fulfillment.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> USDC payout — direct to your wallet, no middlemen.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* ── TRACK 02: IP PROTECTION ── */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-emerald-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Fingerprint className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-emerald-500/10 px-2 py-1 text-xs font-mono text-emerald-400 mb-4 border border-emerald-500/20">
                    TRACK_02: IP_PROTECTION
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Own Your Masters. Forever.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Recordings, stems, lyrics, cover art, your name, your face — mint them
                    as on-chain IP assets with a cryptographic timestamp that proves ownership
                    forever. Every sync placement, brand deal, or downstream license triggers
                    an automatic royalty to your wallet. Your catalog creates compounding
                    value that outlives any record deal.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-emerald-400" /> Artist Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Stop platforms from profiting on your catalog for free.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Establish a verifiable, immutable ownership record.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> License your name, image, and sound to sponsors on your terms.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> One-click IP minting on Algorand.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Automated royalty routing on every downstream use.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Cryptographic timestamp — your ownership, proven forever.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* ── TRACK 03: REVENUE SPLITS ── */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-emerald-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <DollarSign className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-emerald-500/10 px-2 py-1 text-xs font-mono text-emerald-400 mb-4 border border-emerald-500/20">
                    TRACK_03: REVENUE_SPLITS
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Pay Your Whole Team. Instantly.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Show revenue, streaming royalties, sync fees — none of it belongs to just
                    one person. Your band, your producer, your manager, your session players
                    all have a cut. Set your splits once in a MetaWork smart contract. When
                    the money hits, every collaborator is paid in seconds — automatically,
                    on-chain, with full transparency.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-emerald-400" /> Artist Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Eliminate awkward manual payouts after every show.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Build trust with your band — they see the split on-chain.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Handle producer points and session fees without drama.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Custom revenue-split smart contracts per project or tour.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Multi-wallet payout — unlimited recipients.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Full on-chain transparency — every collaborator can verify.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* ── TRACK 04: STAGE KITS & SPONSOR PLACEMENT ── */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-emerald-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Shirt className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-emerald-500/10 px-2 py-1 text-xs font-mono text-emerald-400 mb-4 border border-emerald-500/20">
                    TRACK_04: STAGE_KITS
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Tour Kits in Minutes. Not Months.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Drag your sponsor logos onto tour tees, hoodies, and stage gear. Drop your
                    album art on the chest. Add your own minted IP anywhere on the product.
                    No back-and-forth with designers. No waiting on proofs. Drag, drop, done —
                    and your merch is production-ready before the tour starts. Your sponsors
                    get the placement they paid for. You get a catalog with zero conflicts.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-emerald-400" /> Artist Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Stop losing tour launch windows to slow kit processes.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Make sponsors happier — logo placements delivered fast.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Keep your catalog deep enough that no two sponsors conflict.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Visual drag-and-drop kit builder — no design skills needed.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Sponsor logo placement with instant live preview.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Production-ready output — prints exactly as you see it.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ============================================================
          LIVE TERMINAL MOCKUP
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
          <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between">
            <div className="flex gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500/20" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/20" />
            </div>
            <span className="text-[10px] font-mono text-emerald-400">/artist-terminal/live-telemetry</span>
          </div>
          <div className="p-8 font-mono text-sm space-y-4">
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>ACTIVE_ARTIST:</span>
              <span className="text-zinc-300">"NOVA_CROSS" | INDIE | SINGER-SONGWRITER</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>ARTIST_CARD_HOLDERS:</span>
              <span className="text-emerald-400">1,204 fans (PLATINUM tier)</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>MERCH_REVENUE_MTD:</span>
              <span className="text-emerald-400">$6,880.00 USDC</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>SYNC_LICENSE_RECEIVED:</span>
              <span className="text-teal-400">$3,200.00 USDC (Netflix placement)</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>BAND_SPLIT_STATUS:</span>
              <span className="text-emerald-400">DISTRIBUTED (4 recipients, &lt;3 seconds)</span>
            </div>
            <div className="mt-4 text-xs text-zinc-400 pt-4">
              <p className="text-emerald-400 mb-2">SMART_CONTRACT_LOG &gt;</p>
              <p>&gt; IP asset "NOVA_CROSS_SINGLE_DRIFT" licensed — sync fee auto-routed to wallet.</p>
              <p>&gt; Sponsor logo (AudioBrand Co.) placed on tour hoodie — no catalog conflict detected.</p>
              <p>&gt; Album drop merch live — 1,204 card holders notified, early access window open.</p>
              <p className="text-emerald-400">&gt; Red Rocks show revenue settled — band split complete in 2.8 seconds.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FOOTER CTA
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-900/30 border-t border-zinc-800/50 text-center relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <Music className="w-[800px] h-[800px]" />
        </div>
        <div className="max-w-2xl mx-auto relative z-10">
          <h2 className="text-3xl font-bold tracking-tight mb-6">
            Your next release is your next revenue event.
          </h2>
          <p className="text-zinc-400 mb-10">
            Set up your Artist Aisle in minutes. Mint your catalog. Launch your Artist Card.
            Pay your team trustlessly. Every release, every show — your brand gets stronger.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 bg-white text-black hover:bg-zinc-200 rounded-none font-bold tracking-wide">
                Start Building Your Brand
              </Button>
            </Link>
            <Link href="/showroom">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-none font-mono">
                View Active Aisles <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}