import { Button } from '@/components/ui/button';
import {
  Terminal, ChevronRight, Star, Target,
  CheckCircle2, AlertTriangle, Fingerprint,
  DollarSign, Shirt, Users, Camera, BarChart2, Package,
  Sparkles, Palette, ShoppingBag, PieChart, Droplets, FlaskConical
} from 'lucide-react';
import Link from 'next/link';

export default function BeautyPersonalCarePage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-fuchsia-500/30">

      {/* ============================================================
          HERO SECTION
          ============================================================ */}
      <section className="relative px-8 pt-4 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-fuchsia-500/6 blur-[120px] rounded-full pointer-events-none" />

        {/* TWO COLUMN GRID */}
        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">

          {/* Left: Copy */}
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
              <Link href="/industries" className="hover:text-fuchsia-400 transition-colors">INDUSTRIES</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-fuchsia-400">BEAUTY_DEPLOYMENT_MODULE</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
              Your formula.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-rose-400">
                Your empire.
              </span>
            </h1>

            <p className="text-xl text-zinc-400 leading-relaxed font-light mb-4 max-w-2xl">
              You developed the formula. You built the following. You created the demand.
              And at the end of the day, a retailer, a distributor, or a platform
              takes the margin while you take the risk.
            </p>

            <p className="text-xl text-zinc-200 leading-relaxed font-semibold mb-8 max-w-2xl">
              MetaWork changes that. Sell your products. Own your formulas.
              Pay every collaborator automatically — every drop, every batch.
              Build a community that buys from you directly.
              <span className="text-fuchsia-400"> Your brand. Your terms.</span>
            </p>

            <div className="flex gap-4">
              <Link href="/register">
                <Button size="lg" className="h-12 px-8 bg-fuchsia-700 hover:bg-fuchsia-600 text-white rounded-none font-mono shadow-[0_0_20px_rgba(192,38,211,0.2)]">
                  <Terminal className="mr-2 h-4 w-4" /> Initialize Brand Aisle
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: Hero Image */}
          <div className="relative hidden lg:flex items-center justify-center">
            <div className="absolute -inset-4 bg-fuchsia-500/10 blur-3xl rounded-full pointer-events-none" />
            <img
              src="/images/beauty-hero.jpg"
              alt="Beauty founder at work"
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
          THE PARADIGM SHIFT
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fuchsia-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10 border border-zinc-800 bg-zinc-900/40 p-10 md:p-16 shadow-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-xs font-mono mb-8">
            <AlertTriangle className="h-3.5 w-3.5" />
            SYSTEM_WARNING: RETAIL_EXPLOITATION
          </div>

          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
            You built the brand. You own the asset.
          </h2>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6 text-zinc-400 leading-relaxed font-light">
              <p>
                The beauty industry has always been engineered to extract value from the people
                who create it. Retailers take 50–60% margin. Distributors charge slotting fees
                before a single unit sells. Platforms monetize your tutorials and reviews while
                paying you fractions. A formula you developed over years ends up licensed by a
                conglomerate for a one-time check — and they keep the royalties forever.
              </p>
              <p>
                Your formulas, your branding, your tutorials, your name, your likeness — these
                are intellectual property. Right now they're scattered across platforms and
                agreements that don't pay you what they're worth.{' '}
                <strong className="text-zinc-200">That ends here.</strong>
              </p>
            </div>
            <div className="space-y-6 text-zinc-400 leading-relaxed font-light">
              <p>
                <strong className="text-fuchsia-400">MetaWork puts you in control.</strong> Mint
                your formulas, branding, packaging art, and likeness as on-chain IP assets. Every
                license, every product run, every brand deal routes revenue directly to your
                wallet — automatically, trustlessly, forever.
              </p>
              <p>
                Your community funds your next drop. Your smart contract distributes to every
                formulator, collaborator, and backer in seconds. No waiting on 90-day retail
                payout cycles. No middlemen skimming margin. No confusion.{' '}
                <strong className="text-zinc-200">
                  Everyone who built your brand gets paid when your brand pays.
                </strong>
              </p>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-zinc-800 flex items-center gap-4">
            <Sparkles className="h-8 w-8 text-fuchsia-500 opacity-50" />
            <Fingerprint className="h-8 w-8 text-rose-500 opacity-50" />
            <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest ml-4">
              &gt; Your formula is an asset. Secure it.
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================
          FLAGSHIP FEATURE: BRAND CARD
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-fuchsia-500/4 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">

          <div className="inline-flex items-center gap-2 px-3 py-1 bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400 text-xs font-mono mb-6 rounded">
            <Star className="h-3 w-3" />
            FLAGSHIP_PRODUCT
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">

            {/* Left: Editorial copy */}
            <div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
                The Brand Card.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-rose-400">
                  Your Community. Invested.
                </span>
              </h2>
              <p className="text-zinc-400 leading-relaxed font-light mb-6 text-lg">
                The Brand Card is the ultimate fan-ownership, monetization, and loyalty tool
                for indie beauty founders. It's not a discount program or a loyalty punch card —
                it's a living asset that grows with your product line, your community, and your
                revenue.
              </p>
              <p className="text-zinc-400 leading-relaxed font-light mb-8">
                Community members who hold your Brand Card get exclusive early access to new
                drops, behind-the-scenes formula development content, founder Q&As, limited
                edition product unlocks, and a share of revenue pools. Hit a sales milestone?
                Unlock a new card tier that rewards your earliest believers. Launch a new line?
                Card holders get first access — before anyone else, before any retailer.
              </p>
              <div className="space-y-3 mb-10">
                {[
                  { icon: BarChart2,    label: 'Live product catalog, drop schedule & sales stats — always current' },
                  { icon: Users,        label: 'Community dashboard — see who holds your card and their spend' },
                  { icon: Camera,       label: 'Exclusive drops — formula reveals, behind-the-scenes, founder sessions' },
                  { icon: DollarSign,   label: 'Holder-only product unlocks & early access windows' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 px-4 py-3 bg-zinc-900/50 border border-zinc-800">
                    <Icon className="h-4 w-4 text-fuchsia-400 shrink-0" />
                    <span className="text-sm text-zinc-400">{label}</span>
                  </div>
                ))}
              </div>
              <Link href="/register">
                <Button size="lg" className="h-12 px-8 bg-fuchsia-700 hover:bg-fuchsia-600 text-white rounded-none font-mono shadow-[0_0_20px_rgba(192,38,211,0.2)]">
                  <Sparkles className="mr-2 h-4 w-4" /> Mint Your Brand Card
                </Button>
              </Link>
            </div>

            {/* Right: Animated Brand Card Mock */}
            <div className="relative mx-auto w-[300px] select-none">
              {/* Ambient glow */}
              <div className="absolute -inset-6 bg-fuchsia-500/15 blur-3xl rounded-full pointer-events-none animate-pulse" />

              {/* The Card */}
              <div className="relative border-2 border-fuchsia-500/60 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[0_0_60px_rgba(192,38,211,0.25)] overflow-hidden">

                {/* Card Header Bar */}
                <div className="bg-gradient-to-r from-fuchsia-900/80 to-zinc-900 px-4 py-2 flex justify-between items-center border-b border-fuchsia-500/30">
                  <span className="text-[10px] font-mono text-fuchsia-400 tracking-widest">METAWORK /// BEAUTY</span>
                  <span className="text-[10px] font-mono text-zinc-500">#001 / 500</span>
                </div>

                {/* Brand Visual Stage */}
                <div className="relative bg-gradient-to-b from-zinc-900 via-fuchsia-950/20 to-zinc-950 overflow-hidden" style={{ height: '260px' }}>

                  {/* Spotlight */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-full pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(192,38,211,0.09) 0%, transparent 70%)' }} />

                  {/* Product GIF */}
                  <img
                    src="https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ZWFzMW16czExYmg1NWcxNm1hNXBoamZtb293bzNmczBuMWRrZWU3eSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xUOrwe1NLS1gDVcLPq/giphy.gif"
                    alt="Beauty product drop"
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
                    <p className="text-lg font-black tracking-tight text-white leading-none">LUMIÈRE LAB</p>
                    <p className="text-sm font-bold text-fuchsia-400 tracking-widest">INDIE FOUNDER · SKINCARE</p>
                  </div>
                </div>

                {/* Product Stats Bar */}
                <div className="grid grid-cols-3 border-t border-fuchsia-500/30">
                  {[
                    { label: 'PRODUCTS', value: '12',   color: 'text-fuchsia-400' },
                    { label: 'DROPS',    value: '8',    color: 'text-rose-400' },
                    { label: 'SOLD',     value: '24K',  color: 'text-zinc-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center py-3 border-r border-zinc-800 last:border-0">
                      <span className={`text-2xl font-black ${color}`}>{value}</span>
                      <span className="text-[9px] font-mono text-zinc-500 tracking-widest">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Brand Stats */}
                <div className="px-4 py-3 space-y-2.5 border-t border-zinc-800">
                  {[
                    { label: 'COMMUNITY SIZE',    value: 88, display: '14.2K',  color: '#e879f9' },
                    { label: 'AVG. ORDER VALUE',  value: 72, display: '$68',    color: '#fb7185' },
                    { label: 'REPEAT BUYERS',     value: 65, display: '65%',    color: '#f59e0b' },
                    { label: 'ROYALTY YIELD',     value: 54, display: '$9.2K',  color: '#34d399' },
                    { label: 'CARD HOLDERS',      value: 42, display: '847',    color: '#60a5fa' },
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

                {/* Next Drop */}
                <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/40">
                  <p className="text-[9px] font-mono text-zinc-500 tracking-widest mb-2">NEXT_DROP</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-300 font-semibold">Peptide Serum Vol. III</span>
                    <span className="text-[10px] font-mono text-fuchsia-400">SEP 02</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Card holders get 48hr early access</p>
                </div>

                {/* Card Footer */}
                <div className="bg-gradient-to-r from-fuchsia-900/40 to-zinc-900/60 px-4 py-2 flex justify-between items-center border-t border-fuchsia-500/20">
                  <span className="text-[9px] font-mono text-fuchsia-500/70 tracking-widest">PLATINUM TIER</span>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`h-1.5 w-1.5 rounded-full ${i < 5 ? 'bg-fuchsia-400' : 'bg-zinc-700'}`} />
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
              Beauty Deployment Tracks
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
              Four turn-key pipelines built for the indie beauty founder — solo formulator to
              multi-line brand, any category, any stage of growth.
            </p>
          </div>

          <div className="space-y-12">

            {/* ── TRACK 01: PRODUCT DROPS ── */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-fuchsia-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <ShoppingBag className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-fuchsia-500/10 px-2 py-1 text-xs font-mono text-fuchsia-400 mb-4 border border-fuchsia-500/20">
                    TRACK_01: PRODUCT_DROPS
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Drop Products. Zero Inventory Risk.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Create products with your brand IP — packaging art, logos, formula branding —
                    directly in MetaWork. List them in your personal Aisle. When a customer orders,
                    we manufacture and ship it. You collect in USDC. No warehouse. No unsold
                    inventory sitting in a garage. No upfront manufacturing minimums.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-fuchsia-400" /> Founder Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Test demand before committing to a production run.</li>
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Launch new SKUs in days, not months.</li>
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Get paid in USDC — stable, fast, no net-90 retail cycles.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-fuchsia-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Drag-and-drop product designer with your minted IP.</li>
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Global print-on-demand manufacturing and fulfillment.</li>
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> USDC payout — direct to your wallet, no middlemen.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* ── TRACK 02: FORMULA IP VAULTS ── */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-fuchsia-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <FlaskConical className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-fuchsia-500/10 px-2 py-1 text-xs font-mono text-fuchsia-400 mb-4 border border-fuchsia-500/20">
                    TRACK_02: FORMULA_IP_VAULTS
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Own Your Formulas. License on Your Terms.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Formulas, scent profiles, ingredient ratios, packaging designs, brand names,
                    and your likeness — mint them as on-chain IP assets with a cryptographic
                    timestamp that proves ownership forever. When any brand licenses your formula
                    or uses your IP, your smart contract collects the royalty automatically.
                    Your expertise creates compounding value that no conglomerate can acquire
                    without your permission.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-fuchsia-400" /> Founder Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Stop conglomerates from acquiring your IP for pennies.</li>
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Establish a verifiable, immutable ownership record.</li>
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> License formulas to other brands and collect ongoing royalties.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-fuchsia-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> One-click IP minting on Algorand.</li>
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Automated royalty routing on every downstream use.</li>
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Cryptographic timestamp — your ownership, proven forever.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* ── TRACK 03: REVENUE POOLS ── */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-fuchsia-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <DollarSign className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-fuchsia-500/10 px-2 py-1 text-xs font-mono text-fuchsia-400 mb-4 border border-fuchsia-500/20">
                    TRACK_03: REVENUE_POOLS
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Fund Your Next Drop. From Your Community.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Tokenize the future revenue of a new product line. Raise R&D capital directly
                    from your fans in exchange for a smart-contracted percentage of gross sales.
                    Your community becomes co-investors — not just customers. Set your splits once.
                    When the revenue hits, every backer, collaborator, and formulator gets paid
                    automatically in USDC. No cap table meetings. No term sheets. No drama.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-fuchsia-400" /> Founder Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Fund new lines without debt or giving up equity to VCs.</li>
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Turn your most loyal fans into brand evangelists with skin in the game.</li>
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Eliminate awkward manual payouts to co-formulators and backers.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-fuchsia-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Custom revenue-pool smart contracts per product line.</li>
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Multi-wallet payout — unlimited recipients, instant settlement.</li>
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Full on-chain transparency — every backer can verify their yield.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* ── TRACK 04: BRAND KITS & SPONSOR PLACEMENT ── */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-fuchsia-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Palette className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-fuchsia-500/10 px-2 py-1 text-xs font-mono text-fuchsia-400 mb-4 border border-fuchsia-500/20">
                    TRACK_04: BRAND_KITS
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Brand Kits in Minutes. Launch-Ready.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Drag your partner logos onto product packaging. Drop your formula branding
                    onto custom kits. Add your own minted IP to every piece. No back-and-forth
                    with designers. No waiting on proofs. Our catalog is deep enough that your
                    sponsors never step on each other — skincare partners, fragrance partners,
                    and lifestyle brands each get their dedicated product canvas, conflict-free.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-fuchsia-400" /> Founder Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Make brand partners happier with fast, clean placements.</li>
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Launch collab kits without losing weeks to design cycles.</li>
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Keep your catalog deep enough that no two partners conflict.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-fuchsia-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Visual drag-and-drop kit builder — no design skills needed.</li>
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Partner logo placement with instant live preview.</li>
                      <li className="flex items-start"><span className="text-fuchsia-400 mr-2">-</span> Production-ready output — prints exactly as you see it.</li>
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
            <span className="text-[10px] font-mono text-fuchsia-400">/beauty-terminal/live-telemetry</span>
          </div>
          <div className="p-8 font-mono text-sm space-y-4">
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>ACTIVE_BRAND:</span>
              <span className="text-zinc-300">"LUMIÈRE_LAB" | INDIE | SKINCARE</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>BRAND_CARD_HOLDERS:</span>
              <span className="text-fuchsia-400">847 community members (PLATINUM tier)</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>PRODUCT_REVENUE_MTD:</span>
              <span className="text-fuchsia-400">$24,340.00 USDC</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>FORMULA_LICENSE_RECEIVED:</span>
              <span className="text-rose-400">$4,800.00 USDC (BrandCo licensing deal)</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>REVENUE_POOL_STATUS:</span>
              <span className="text-fuchsia-400">DISTRIBUTED (12 backers, &lt;3 seconds)</span>
            </div>
            <div className="mt-4 text-xs text-zinc-400 pt-4">
              <p className="text-fuchsia-400 mb-2">SMART_CONTRACT_LOG &gt;</p>
              <p>&gt; IP asset "PEPTIDE_SERUM_FORMULA_V3" licensed — royalty auto-routed to vault.</p>
              <p>&gt; Partner logo (GlowBrand Co.) placed on collab kit — no catalog conflict detected.</p>
              <p>&gt; Peptide Serum Vol. III drop live — 847 card holders notified, 48hr early access open.</p>
              <p className="text-fuchsia-400">&gt; Revenue pool settled — 12 community backers paid in 2.4 seconds.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FOOTER CTA
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-900/30 border-t border-zinc-800/50 text-center relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <Sparkles className="w-[800px] h-[800px]" />
        </div>
        <div className="max-w-2xl mx-auto relative z-10">
          <h2 className="text-3xl font-bold tracking-tight mb-6">
            Your next drop is your next revenue event.
          </h2>
          <p className="text-zinc-400 mb-10">
            Set up your Brand Aisle in minutes. Mint your formulas. Launch your Brand Card.
            Pay your community trustlessly. Every drop, every launch — your brand gets stronger.
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