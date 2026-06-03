import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Terminal, ArrowRight, ShieldCheck, ChevronRight, Trophy, Target, 
  CheckCircle2, AlertTriangle, Swords, Fingerprint, 
  DollarSign, Shirt, Star, Users, Camera, BarChart2, Package
} from 'lucide-react';
import Link from 'next/link';

export default function FightersPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-red-500/30">
      
      {/* ============================================================
          HERO SECTION
          ============================================================ */}
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-red-500/6 blur-[120px] rounded-full pointer-events-none" />
        
        {/* TWO COLUMN GRID */}
        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">

          {/* Left: Copy */}
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
              <Link href="/industries" className="hover:text-red-400 transition-colors">INDUSTRIES</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-red-400">FIGHTER_DEPLOYMENT_MODULE</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
              Built for fighters.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-500">
                Not for promoters.
              </span>
            </h1>

            <p className="text-xl text-zinc-400 leading-relaxed font-light mb-4 max-w-2xl">
              You train twice a day. You cut weight. You take the fights nobody else will take.
              And at the end of the night, someone else walks away with most of the money.
            </p>

            <p className="text-xl text-zinc-200 leading-relaxed font-semibold mb-8 max-w-2xl">
              MetaWork changes that. Sell your merch. Own your highlights.
              Pay your whole team on fight night — automatically.
              Build a fanbase that pays you between fights.
              <span className="text-red-400"> No promoter required.</span>
            </p>

            <div className="flex gap-4">
              <Link href="/register">
                <Button size="lg" className="h-12 px-8 bg-red-600 hover:bg-red-700 text-white rounded-none font-mono shadow-[0_0_20px_rgba(220,38,38,0.2)]">
                  <Terminal className="mr-2 h-4 w-4" /> Initialize Fighter Aisle
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: Hero Image */}
          <div className="relative hidden lg:flex items-center justify-center">
            <div className="absolute -inset-4 bg-red-500/10 blur-3xl rounded-full pointer-events-none" />
            <img
              src="/images/fighter-hero.png"
              alt="Fighter in the octagon"
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
          THE PARADIGM SHIFT — Fighter IP Exploitation
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-5xl mx-auto relative z-10 border border-zinc-800 bg-zinc-900/40 p-10 md:p-16 shadow-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono mb-8">
            <AlertTriangle className="h-3.5 w-3.5" />
            SYSTEM_WARNING: FIGHTER_EXPLOITATION
          </div>
          
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
            You take the punches. You own the asset.
          </h2>
          
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6 text-zinc-400 leading-relaxed font-light">
              <p>
                The fight industry has always been stacked against the athlete. Promoters capture 
                the gate. Sponsors own the placement. Social platforms sell ads against your 
                knockouts. A training video you filmed on your phone generates thousands of views 
                — but someone else is monetizing your sacrifice.
              </p>
              <p>
                Your walkout music, your logo, your highlight reel, your training techniques — 
                these are intellectual property. Right now, they&apos;re scattered across platforms 
                that don&apos;t pay you. <strong className="text-zinc-200">That ends here.</strong>
              </p>
            </div>
            <div className="space-y-6 text-zinc-400 leading-relaxed font-light">
              <p>
                <strong className="text-red-400">MetaWork puts you in control.</strong> Mint your 
                fight photos, training videos, original walkout music, and logos as on-chain IP 
                assets. Every use, every license, every sale routes revenue directly to your wallet 
                — automatically, trustlessly, forever.
              </p>
              <p>
                Your purse hits the blockchain and the smart contract distributes to every coach, 
                trainer, and corner man in seconds. No awkward conversations. No delayed checks. 
                No confusion. <strong className="text-zinc-200">Everyone who built your win gets 
                paid when you win.</strong>
              </p>
            </div>
          </div>
          
          <div className="mt-10 pt-8 border-t border-zinc-800 flex items-center gap-4">
            <Swords className="h-8 w-8 text-red-500 opacity-50" />
            <Fingerprint className="h-8 w-8 text-orange-500 opacity-50" />
            <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest ml-4">
              &gt; Your legacy is an asset. Secure it.
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================
          FLAGSHIP FEATURE: FIGHTER CARD NFT
          (Breaks from the track grid — full editorial treatment)
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/4 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono mb-6 rounded">
            <Star className="h-3 w-3" />
            FLAGSHIP_PRODUCT
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">
            
            {/* Left: Editorial copy */}
            <div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
                The Fighter Card.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-red-400">
                  Your Brand. Alive.
                </span>
              </h2>
              <p className="text-zinc-400 leading-relaxed font-light mb-6 text-lg">
                The Fighter Card NFT is the ultimate engagement, monetization, and branding tool 
                for any competitor. It&apos;s not a digital collectible that sits in a wallet — 
                it&apos;s a living, updatable asset that grows with your career.
              </p>
              <p className="text-zinc-400 leading-relaxed font-light mb-8">
                Fans who hold your Fighter Card get exclusive access to fight dates and results, 
                behind-the-scenes training content, diet and recovery protocols, backstage 
                experiences, and early merch drops. The more you win and grow, the more valuable 
                your card becomes — for you and everyone who bet on your future.
              </p>
              <div className="space-y-3 mb-10">
                {[
                  { icon: BarChart2, label: 'Live fight record, schedule & stats — always current' },
                  { icon: Users,     label: 'Fan engagement dashboard — see who holds your card' },
                  { icon: Camera,    label: 'Exclusive content drops — training, diet, backstage' },
                  { icon: DollarSign,label: 'Holder-only merch unlocks & fight week drops' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 px-4 py-3 bg-zinc-900/50 border border-zinc-800">
                    <Icon className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-sm text-zinc-400">{label}</span>
                  </div>
                ))}
              </div>
              <Link href="/register">
                <Button size="lg" className="h-12 px-8 bg-amber-600 hover:bg-amber-700 text-white rounded-none font-mono shadow-[0_0_20px_rgba(217,119,6,0.2)]">
                  <Trophy className="mr-2 h-4 w-4" /> Mint Your Fighter Card
                </Button>
              </Link>
            </div>

            {/* Right: Animated Trading Card Mock */}
            <div className="relative mx-auto w-[300px] select-none">
            {/* Ambient glow */}
            <div className="absolute -inset-6 bg-amber-500/15 blur-3xl rounded-full pointer-events-none animate-pulse" />

            {/* The Card */}
            <div className="relative border-2 border-amber-500/60 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[0_0_60px_rgba(217,119,6,0.25)] overflow-hidden">

                {/* Card Header Bar */}
                <div className="bg-gradient-to-r from-red-900/80 to-zinc-900 px-4 py-2 flex justify-between items-center border-b border-amber-500/30">
                <span className="text-[10px] font-mono text-amber-400 tracking-widest">METAWORK /// FIGHTER</span>
                <span className="text-[10px] font-mono text-zinc-500">#001 / 500</span>
                </div>

                {/* Animated Fighter Stage */}
                <div className="relative bg-gradient-to-b from-zinc-900 via-red-950/20 to-zinc-950 overflow-hidden" style={{ height: '260px' }}>

                {/* Spotlight */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-full pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.07) 0%, transparent 70%)' }} />

                {/* Fighter GIF */}
                <img
                    src="https://media4.giphy.com/media/aUXaMAOw65wd0qHPJL/giphy.gif"
                    alt="Fighter shadowboxing"
                    width={260}
                    height={260}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                    style={{ mixBlendMode: 'lighten' }}
                />

                {/* Bottom fade into card body */}
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />

                {/* Name Overlay */}
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                    <p className="text-lg font-black tracking-tight text-white leading-none">ALEX "THE APEX"</p>
                    <p className="text-sm font-bold text-red-400 tracking-widest">RIVERA · LIGHTWEIGHT</p>
                </div>

                </div>

                {/* W / L / D Record Bar */}
                <div className="grid grid-cols-3 border-t border-amber-500/30">
                {[
                    { label: 'WIN',  value: '14', color: 'text-emerald-400' },
                    { label: 'LOSS', value: '2',  color: 'text-red-400' },
                    { label: 'DRAW', value: '1',  color: 'text-zinc-400' },
                ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center py-3 border-r border-zinc-800 last:border-0">
                    <span className={`text-2xl font-black ${color}`}>{value}</span>
                    <span className="text-[9px] font-mono text-zinc-500 tracking-widest">{label}</span>
                    </div>
                ))}
                </div>

                {/* Fight Stats — game card style */}
                <div className="px-4 py-3 space-y-2.5 border-t border-zinc-800">

                {/* Stat bars */}
                {[
                    { label: 'STRIKING ACC.',   value: 78, display: '78%',  color: '#f59e0b' },
                    { label: 'TAKEDOWN DEF.',   value: 91, display: '91%',  color: '#10b981' },
                    { label: 'KO / TKO',        value: 57, display: '8',    color: '#ef4444' },
                    { label: 'SUBMISSIONS',     value: 28, display: '4',    color: '#a78bfa' },
                    { label: 'AVG. FIGHT TIME', value: 62, display: '2:47', color: '#60a5fa' },
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

                {/* Card Footer */}
                <div className="bg-gradient-to-r from-red-900/40 to-zinc-900/60 px-4 py-2 flex justify-between items-center border-t border-amber-500/20">
                <span className="text-[9px] font-mono text-amber-500/70 tracking-widest">GOLD TIER</span>
                <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                    <div key={i} className={`h-1.5 w-1.5 rounded-full ${i < 4 ? 'bg-amber-400' : 'bg-zinc-700'}`} />
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
          Order: Merch → IP Tokenization → Purse Distribution → Fight Kits
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Fighter Deployment Tracks
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
              Four turn-key pipelines built for the individual competitor — amateur or pro, 
              any discipline, any weight class.
            </p>
          </div>

          <div className="space-y-12">

            {/* ── TRACK 01: MERCH SALES ── */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-red-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Package className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-red-500/10 px-2 py-1 text-xs font-mono text-red-400 mb-4 border border-red-500/20">
                    TRACK_01: MERCH_SALES
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Sell Merch. Zero Inventory.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Create products with your IP — fight photos, logos, walkout art — directly 
                    in MetaWork. List them in your personal Aisle. When a fan orders, we 
                    manufacture and ship it. You collect payment in USDC. No warehouse. No box 
                    of unsold shirts. No upfront risk.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-red-400" /> Fighter Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-red-400 mr-2">-</span> Monetize your fanbase between fights.</li>
                      <li className="flex items-start"><span className="text-red-400 mr-2">-</span> Launch fight week drops without touching inventory.</li>
                      <li className="flex items-start"><span className="text-red-400 mr-2">-</span> Get paid in USDC — stable, fast, no bank delay.</li>
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

            {/* ── TRACK 02: IP TOKENIZATION ── */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-red-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Fingerprint className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-red-500/10 px-2 py-1 text-xs font-mono text-red-400 mb-4 border border-red-500/20">
                    TRACK_02: IP_TOKENIZATION
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Own Your Highlights Forever</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Fight photos, training videos, walkout music, logos — mint them as on-chain 
                    IP assets. When anyone uses your likeness or creative work, your smart contract 
                    collects the royalty automatically. Your career creates compounding value 
                    that outlives the sport.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-red-400" /> Fighter Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-red-400 mr-2">-</span> Stop platforms from profiting on your content for free.</li>
                      <li className="flex items-start"><span className="text-red-400 mr-2">-</span> Establish a verifiable, immutable ownership record.</li>
                      <li className="flex items-start"><span className="text-red-400 mr-2">-</span> License your image and IP to sponsors on your terms.</li>
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

            {/* ── TRACK 03: PRIZE PURSE DISTRIBUTION ── */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-red-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <DollarSign className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-red-500/10 px-2 py-1 text-xs font-mono text-red-400 mb-4 border border-red-500/20">
                    TRACK_03: PURSE_DISTRIBUTION
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Pay Your Whole Team Instantly</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    A fighter&apos;s purse isn&apos;t just theirs — coaches, corner men, trainers, 
                    nutritionists, and designers all have a cut. Set your split once in a MetaWork 
                    smart contract. When the purse hits, every person on your team gets paid 
                    automatically in USDC, in seconds.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-red-400" /> Fighter Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-red-400 mr-2">-</span> Eliminate awkward manual payouts to your team.</li>
                      <li className="flex items-start"><span className="text-red-400 mr-2">-</span> Build trust with coaches — they see the split on-chain.</li>
                      <li className="flex items-start"><span className="text-red-400 mr-2">-</span> Settle purse distributions in seconds, not weeks.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Custom revenue-split smart contracts per fight.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Multi-wallet payout — unlimited recipients.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Full on-chain transparency — every team member can verify.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* ── TRACK 04: FIGHT KITS ── */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-red-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Shirt className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-red-500/10 px-2 py-1 text-xs font-mono text-red-400 mb-4 border border-red-500/20">
                    TRACK_04: FIGHT_KITS
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Fight Kits in Minutes. Not Weeks.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Drag sponsor logos onto your shorts. Drop your corner team&apos;s patch onto 
                    your hoodie. Add your own IP to the chest. No back-and-forth with a designer. 
                    No waiting on proofs. Drag, drop, done — and your kit is production-ready.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-red-400" /> Fighter Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-red-400 mr-2">-</span> Stop losing fight weeks to slow kit approval processes.</li>
                      <li className="flex items-start"><span className="text-red-400 mr-2">-</span> Look professional from your debut to your title fight.</li>
                      <li className="flex items-start"><span className="text-red-400 mr-2">-</span> Attract better sponsors with a clean, branded look.</li>
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
            <span className="text-[10px] font-mono text-red-400">/fighter-terminal/live-telemetry</span>
          </div>
          <div className="p-8 font-mono text-sm space-y-4">
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>ACTIVE_FIGHTER:</span>
              <span className="text-zinc-300">"APEX_RIVERA" | PRO | -155lbs</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>FIGHTER_CARD_HOLDERS:</span>
              <span className="text-amber-400">487 fans (GOLD tier)</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>MERCH_REVENUE_MTD:</span>
              <span className="text-emerald-400">$3,240.00 USDC</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>FIGHT_PURSE_RECEIVED:</span>
              <span className="text-red-400">$18,000.00 USDC</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>PURSE_STATUS:</span>
              <span className="text-emerald-400">DISTRIBUTED (5 recipients, &lt;3 seconds)</span>
            </div>
            <div className="mt-4 text-xs text-zinc-400 pt-4">
              <p className="text-red-400 mb-2">SMART_CONTRACT_LOG &gt;</p>
              <p>&gt; IP asset "APEX_KNOCKOUT_REEL_003" licensed by SportsBrand Inc.</p>
              <p>&gt; Royalty: $240.00 USDC routed to fighter wallet automatically.</p>
              <p>&gt; Fight Kit v4 submitted — sponsor logos verified, production queued.</p>
              <p className="text-emerald-400">&gt; Fighter Card exclusive drop live — 487 holders notified.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FOOTER CTA
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-900/30 border-t border-zinc-800/50 text-center relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <Swords className="w-[800px] h-[800px]" />
        </div>
        <div className="max-w-2xl mx-auto relative z-10">
          <h2 className="text-3xl font-bold tracking-tight mb-6">
            Your next fight is your next revenue event.
          </h2>
          <p className="text-zinc-400 mb-10">
            Set up your Fighter Aisle in minutes. Mint your IP. Launch your Fighter Card. 
            Pay your team trustlessly. Every fight, your brand gets stronger.
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