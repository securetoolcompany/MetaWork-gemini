import { Button } from '@/components/ui/button';
import {
  Terminal, ShieldCheck, ChevronRight, Trophy, Target,
  CheckCircle2, Zap, Mountain, Fingerprint,
  DollarSign, Shirt, Star, Users, Camera, BarChart2, Package, Medal
} from 'lucide-react';
import Link from 'next/link';

export default function ExtremeAthletesPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-sky-500/30">

      {/* ============================================================
          HERO SECTION
          ============================================================ */}
      <section className="relative px-8 pt-4 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-sky-500/6 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">

          {/* Left: Copy */}
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
              <Link href="/industries" className="hover:text-sky-400 transition-colors">INDUSTRIES</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-sky-400">ATHLETE_DEPLOYMENT_MODULE</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
              Your sponsors<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
                love you more.
              </span>
            </h1>

            <p className="text-xl text-zinc-400 leading-relaxed font-light mb-4 max-w-2xl">
              You send it off cliffs, down mountains, through barrels, and into the unknown.
              Your sponsors believe in you — they put their logos on your back.
              But the tools to make those partnerships truly perform are scattered, slow, and behind the times.
            </p>

            <p className="text-xl text-zinc-200 leading-relaxed font-semibold mb-8 max-w-2xl">
              MetaWork is your co-pilot. Place sponsor logos on gear in minutes. Own your content outright.
              Give sponsors more visibility with less friction — and a deeper, more loyal fanbase to market to.
              <span className="text-sky-400"> Win together.</span>
            </p>

            <div className="flex gap-4">
              <Link href="/register">
                <Button size="lg" className="h-12 px-8 bg-sky-600 hover:bg-sky-700 text-white rounded-none font-mono shadow-[0_0_20px_rgba(14,165,233,0.2)]">
                  <Terminal className="mr-2 h-4 w-4" /> Initialize Athlete Aisle
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: Hero Image */}
          <div className="relative hidden lg:flex items-center justify-center">
            <div className="absolute -inset-4 bg-sky-500/10 blur-3xl rounded-full pointer-events-none" />
            <img
              src="/images/athlete-hero.jpg"
              alt="Extreme athlete in action"
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
          THE PARADIGM SHIFT — Sponsor Cooperation + IP Protection
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10 border border-zinc-800 bg-zinc-900/40 p-10 md:p-16 shadow-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-mono mb-8">
            <Zap className="h-3.5 w-3.5" />
            SYSTEM_INSIGHT: SPONSOR_ALIGNMENT
          </div>

          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
            Your sponsors are already on your side.<br />
            <span className="text-zinc-400">Give them better tools to prove it.</span>
          </h2>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6 text-zinc-400 leading-relaxed font-light">
              <p>
                Extreme sports sponsorships aren&apos;t transactional — they&apos;re partnerships built on
                shared risk, shared glory, and genuine belief. Your sponsors handed you a check because
                they see what you see. The problem isn&apos;t the relationship. It&apos;s the infrastructure.
              </p>
              <p>
                Getting their logos on your gear takes weeks of back-and-forth.
                Your content is scattered across platforms that don&apos;t protect your name or
                likeness. And the products you could be selling with their support? Still stuck
                in a spreadsheet somewhere. <strong className="text-zinc-200">That ends here.</strong>
              </p>
            </div>
            <div className="space-y-6 text-zinc-400 leading-relaxed font-light">
              <p>
                <strong className="text-sky-400">MetaWork amplifies your existing sponsor relationships.</strong> Our product
                catalog is deep enough that your sponsors can each live on different product lines —
                no brand conflicts, no stepping on anyone&apos;s toes. You bring the partnerships;
                we give them room to breathe and grow.
              </p>
              <p>
                Meanwhile, your name, image, likeness, and content are locked down on-chain.
                Your IP is yours — permanently, provably, automatically. Sponsors get legitimate access
                on terms you control. <strong className="text-zinc-200">Everyone wins. Especially you.</strong>
              </p>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-zinc-800 flex items-center gap-4">
            <Mountain className="h-8 w-8 text-sky-500 opacity-50" />
            <Fingerprint className="h-8 w-8 text-cyan-400 opacity-50" />
            <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest ml-4">
              &gt; Sponsors in. Conflicts out. Revenue on.
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================
          SPONSOR AMPLIFICATION — 3 core value props
          ============================================================ */}
      <section className="px-8 py-16 bg-zinc-900/10 border-b border-zinc-800/50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="mb-10">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
              How MetaWork makes your sponsors happier
            </h2>
            <p className="text-zinc-400 max-w-2xl">
              This isn&apos;t about replacing your sponsors or working around them — it&apos;s about
              making the partnership perform better for everyone at the table.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Shirt,
                color: 'text-sky-400',
                borderColor: 'hover:border-sky-500/30',
                label: 'AMPLIFY_01',
                title: 'Their logos, on products, in minutes.',
                body: 'You already have the sponsorship agreement. MetaWork lets you place sponsor logos directly onto products — gear, apparel, accessories — with a drag-and-drop designer. What used to take a design firm three weeks now takes an afternoon. Ship to fans globally with zero inventory risk.',
              },
              {
                icon: Package,
                color: 'text-cyan-400',
                borderColor: 'hover:border-cyan-500/30',
                label: 'AMPLIFY_02',
                title: 'Enough catalog that nobody steps on toes.',
                body: "MetaWork's product catalog is broad by design. Your energy drink sponsor lives on bottles and shakers. Your apparel sponsor owns the jersey line. Your gear sponsor goes on bags and cases. Each sponsor gets their own product territory — and each product becomes a revenue stream for you.",
              },
              {
                icon: ShieldCheck,
                color: 'text-emerald-400',
                borderColor: 'hover:border-emerald-500/30',
                label: 'AMPLIFY_03',
                title: 'Your IP is protected. Always.',
                body: "Your name, image, likeness, training content, and competition footage are on-chain IP assets. Sponsors can license them with your explicit permission. Nobody can use your face or footage without a traceable, enforced agreement. Your brand is safe — and sponsors know they're working with a professional.",
              },
            ].map(({ icon: Icon, color, borderColor, label, title, body }) => (
              <div key={label} className={`border border-zinc-800 bg-zinc-900/30 p-6 transition-all ${borderColor}`}>
                <div className="inline-flex items-center rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-400 mb-4 border border-zinc-700">
                  {label}
                </div>
                <Icon className={`h-6 w-6 ${color} mb-4`} />
                <h3 className="text-lg font-bold mb-3">{title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          FLAGSHIP FEATURE: ATHLETE CARD NFT
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-sky-500/4 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">

          <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-mono mb-6 rounded">
            <Star className="h-3 w-3" />
            FLAGSHIP_PRODUCT
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">

            {/* Left: Editorial copy */}
            <div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
                The Athlete Card.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
                  Your Legacy, Live.
                </span>
              </h2>
              <p className="text-zinc-400 leading-relaxed font-light mb-6 text-lg">
                The Athlete Card NFT is the ultimate engagement, monetization, and brand asset
                for any extreme sports competitor. It&apos;s not a static collectible —
                it&apos;s a living record of your career that updates in real time and rewards
                the fans who believed in you from the beginning.
              </p>
              <p className="text-zinc-400 leading-relaxed font-light mb-8">
                Card holders get exclusive access to your competition calendar, results as they
                happen, behind-the-scenes training segments, gear reviews, sponsor drops, and
                VIP experiences. When you podium, your card holders feel it too. The more you
                push limits, the more valuable your card becomes — for you and everyone holding it.
              </p>
              <div className="space-y-3 mb-10">
                {[
                  { icon: BarChart2,  label: 'Live competition calendar, results & discipline stats — always current' },
                  { icon: Users,      label: 'Fan engagement dashboard — see exactly who holds your card' },
                  { icon: Camera,     label: 'Exclusive content drops — training days, event prep, gear unboxing' },
                  { icon: Medal,      label: 'Podium unlocks — special rewards and drops when you place on the podium' },
                  { icon: DollarSign, label: 'Holder-only merch, sponsor collab drops & event-week exclusives' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 px-4 py-3 bg-zinc-900/50 border border-zinc-800">
                    <Icon className="h-4 w-4 text-sky-400 shrink-0" />
                    <span className="text-sm text-zinc-400">{label}</span>
                  </div>
                ))}
              </div>
              <Link href="/register">
                <Button size="lg" className="h-12 px-8 bg-sky-600 hover:bg-sky-700 text-white rounded-none font-mono shadow-[0_0_20px_rgba(14,165,233,0.2)]">
                  <Trophy className="mr-2 h-4 w-4" /> Mint Your Athlete Card
                </Button>
              </Link>
            </div>

            {/* Right: Animated Trading Card Mock */}
            <div className="relative mx-auto w-[300px] select-none">
              <div className="absolute -inset-6 bg-sky-500/15 blur-3xl rounded-full pointer-events-none animate-pulse" />

              <div className="relative border-2 border-sky-500/60 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[0_0_60px_rgba(14,165,233,0.25)] overflow-hidden">

                {/* Card Header */}
                <div className="bg-gradient-to-r from-sky-900/80 to-zinc-900 px-4 py-2 flex justify-between items-center border-b border-sky-500/30">
                  <span className="text-[10px] font-mono text-sky-400 tracking-widest">METAWORK /// ATHLETE</span>
                  <span className="text-[10px] font-mono text-zinc-500">#007 / 300</span>
                </div>

                {/* Athlete Stage */}
                <div className="relative bg-gradient-to-b from-zinc-900 via-sky-950/20 to-zinc-950 overflow-hidden" style={{ height: '260px' }}>
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-full pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.07) 0%, transparent 70%)' }}
                  />
                  <img
                    src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmJpYWp3YzU3ajltMmo2cmJjaG1lNXJqN3RrODlmYjdmaXZrdGU1aSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Wwq5EGUUZLq9i/giphy.gif"
                    alt="Extreme athlete in action"
                    width={260}
                    height={260}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                    style={{ mixBlendMode: 'lighten' }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
                  <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                    <p className="text-lg font-black tracking-tight text-white leading-none">JORDAN &quot;FREEFALL&quot;</p>
                    <p className="text-sm font-bold text-sky-400 tracking-widest">HAYES · FREERIDE / SKYDIVE</p>
                  </div>
                </div>

                {/* Medal Record */}
                <div className="grid grid-cols-3 border-t border-sky-500/30">
                  {[
                    { label: 'GOLD',   value: '11', color: 'text-amber-400' },
                    { label: 'SILVER', value: '4',  color: 'text-zinc-300' },
                    { label: 'BRONZE', value: '3',  color: 'text-orange-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center py-3 border-r border-zinc-800 last:border-0">
                      <span className={`text-2xl font-black ${color}`}>{value}</span>
                      <span className="text-[9px] font-mono text-zinc-500 tracking-widest">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Athlete Stats */}
                <div className="px-4 py-3 space-y-2.5 border-t border-zinc-800">
                  {[
                    { label: 'TRICK DIFFICULTY', value: 88, display: '8.8',     color: '#38bdf8' },
                    { label: 'CONSISTENCY',       value: 82, display: '82%',    color: '#34d399' },
                    { label: 'AIR TIME (AVG.)',   value: 74, display: '4.7s',   color: '#f59e0b' },
                    { label: 'SPEED (TOP)',        value: 95, display: '112mph', color: '#ef4444' },
                    { label: 'PODIUMS / SEASON',  value: 60, display: '9',      color: '#a78bfa' },
                  ].map(({ label, value, display, color }) => (
                    <div key={label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-mono text-zinc-500 tracking-widest">{label}</span>
                        <span className="text-[11px] font-black" style={{ color }}>{display}</span>
                      </div>
                      <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${value}%`, background: color, boxShadow: `0 0 6px ${color}` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Upcoming Events */}
                <div className="px-4 py-3 border-t border-zinc-800 space-y-1">
                  <p className="text-[9px] font-mono text-zinc-500 tracking-widest mb-1">NEXT_EVENTS</p>
                  {[
                    { name: 'Freeride World Tour · Verbier',    date: 'JAN 22' },
                    { name: 'IFSC World Cup · Salt Lake City',  date: 'MAR 05' },
                  ].map(({ name, date }) => (
                    <div key={name} className="flex justify-between">
                      <span className="text-[9px] text-zinc-400">{name}</span>
                      <span className="text-[9px] font-mono text-sky-400">{date}</span>
                    </div>
                  ))}
                </div>

                {/* Card Footer */}
                <div className="bg-gradient-to-r from-sky-900/40 to-zinc-900/60 px-4 py-2 flex justify-between items-center border-t border-sky-500/20">
                  <span className="text-[9px] font-mono text-sky-500/70 tracking-widest">PLATINUM TIER</span>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-1.5 w-1.5 rounded-full bg-sky-400" />
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
              Athlete Deployment Tracks
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
              Four turn-key pipelines built for the individual extreme sports competitor —
              amateur or pro, any discipline, any season.
            </p>
          </div>

          <div className="space-y-12">

            {/* TRACK 01: SPONSOR MERCH */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-sky-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Shirt className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-sky-500/10 px-2 py-1 text-xs font-mono text-sky-400 mb-4 border border-sky-500/20">
                    TRACK_01: SPONSOR_MERCH
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Sponsor Logos on Products. Instantly.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    You already have the deals. Now place sponsor logos directly onto products
                    using MetaWork&apos;s visual designer — no design firm, no back-and-forth, no delays.
                    Each sponsor gets dedicated product real estate in your Aisle. Fans order, we
                    ship globally, you earn in USDC. Your sponsors get visibility without any of the
                    logistics headache on their end.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-sky-400" /> Athlete Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-sky-400 mr-2">-</span> Deliver sponsor logo exposure beyond the event itself.</li>
                      <li className="flex items-start"><span className="text-sky-400 mr-2">-</span> Launch event-week drops with zero inventory risk.</li>
                      <li className="flex items-start"><span className="text-sky-400 mr-2">-</span> Turn sponsor relationships into ongoing revenue streams.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Drag-and-drop designer with sponsor logo zones per product.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Global print-on-demand manufacturing and fulfillment.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> USDC payout — direct to your wallet, no middlemen.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 02: IP PROTECTION */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-sky-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Fingerprint className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-sky-500/10 px-2 py-1 text-xs font-mono text-sky-400 mb-4 border border-sky-500/20">
                    TRACK_02: IP_PROTECTION
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Own Your Name, Face &amp; Footage. Forever.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Your name, image, and likeness are commercial assets. Your crash footage,
                    summit photos, and training videos generate views and advertising revenue every
                    day — but often for someone else. Mint your content as on-chain IP. Every
                    licensed use routes a royalty to your wallet automatically. Sponsors who want
                    to use your likeness do so on-chain, on your terms, with a verifiable trail.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-sky-400" /> Athlete Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-sky-400 mr-2">-</span> Stop platforms from monetizing your content without paying you.</li>
                      <li className="flex items-start"><span className="text-sky-400 mr-2">-</span> Establish an immutable, timestamped ownership record for all IP.</li>
                      <li className="flex items-start"><span className="text-sky-400 mr-2">-</span> License name and likeness to sponsors on transparent, auditable terms.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> One-click IP minting on Algorand — photos, video, logos, music.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Automated royalty routing on every downstream licensed use.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Cryptographic proof of ownership — your brand, protected forever.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 03: TEAM PAYOUTS */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-sky-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <DollarSign className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-sky-500/10 px-2 py-1 text-xs font-mono text-sky-400 mb-4 border border-sky-500/20">
                    TRACK_03: TEAM_PAYOUTS
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Pay Your Whole Team Instantly</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Your coach, your physio, your filmer, your manager — they all have a cut of
                    every competition payout, sponsorship check, and merch sale. Set your split
                    once in a MetaWork smart contract. When money hits, every person in your corner
                    gets paid automatically in USDC, in seconds. No manual transfers. No awkward
                    conversations. Total transparency on-chain.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-sky-400" /> Athlete Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-sky-400 mr-2">-</span> Eliminate manual payouts to coaches and support staff.</li>
                      <li className="flex items-start"><span className="text-sky-400 mr-2">-</span> Build trust with your team — they see the split on-chain.</li>
                      <li className="flex items-start"><span className="text-sky-400 mr-2">-</span> Settle competition distributions in seconds, not weeks.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Custom revenue-split smart contracts per payout source.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Multi-wallet payout — unlimited recipients.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Full on-chain transparency — every team member can verify their cut.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 04: COMPETITION KITS */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-sky-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Package className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-sky-500/10 px-2 py-1 text-xs font-mono text-sky-400 mb-4 border border-sky-500/20">
                    TRACK_04: COMP_KITS
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Competition Kits. Ready Before You Arrive.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Drag your sponsor logos onto your jersey. Drop your personal IP on the back.
                    Add your coach&apos;s brand on the sleeve. No designer required. No weeks of
                    approval cycles. Your kit is production-ready the same day you build it —
                    exactly as you see it on screen, printed and shipped to wherever you&apos;re competing next.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-sky-400" /> Athlete Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-sky-400 mr-2">-</span> Fulfill sponsor logo obligations on every competition piece.</li>
                      <li className="flex items-start"><span className="text-sky-400 mr-2">-</span> Look pro at every event — from local qualifiers to world titles.</li>
                      <li className="flex items-start"><span className="text-sky-400 mr-2">-</span> Attract higher-tier sponsors with a polished, branded presence.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Visual drag-and-drop kit builder — zero design skills required.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Sponsor logo placement with real-time live preview.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Production-ready output — printed exactly as you designed it.</li>
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
              <div className="h-3 w-3 rounded-full bg-sky-500/20" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/20" />
            </div>
            <span className="text-[10px] font-mono text-sky-400">/athlete-terminal/live-telemetry</span>
          </div>
          <div className="p-8 font-mono text-sm space-y-4">
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>ACTIVE_ATHLETE:</span>
              <span className="text-zinc-300">&quot;FREEFALL_HAYES&quot; | PRO | FREERIDE / SKYDIVE</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>ATHLETE_CARD_HOLDERS:</span>
              <span className="text-sky-400">312 fans (PLATINUM tier)</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>MERCH_REVENUE_MTD:</span>
              <span className="text-emerald-400">$4,810.00 USDC</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>ACTIVE_SPONSORS:</span>
              <span className="text-zinc-300">4 brands — no product conflicts detected</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>NEXT_COMPETITION:</span>
              <span className="text-amber-400">Freeride World Tour · Verbier — JAN 22</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>LAST_PAYOUT:</span>
              <span className="text-emerald-400">DISTRIBUTED (4 recipients, &lt;3 seconds)</span>
            </div>
            <div className="mt-4 text-xs text-zinc-400 pt-4">
              <p className="text-sky-400 mb-2">SMART_CONTRACT_LOG &gt;</p>
              <p>&gt; IP asset &quot;HAYES_SUMMIT_RUN_VERBIER_002&quot; licensed by OutdoorBrand Co.</p>
              <p>&gt; Royalty: $360.00 USDC routed to athlete wallet automatically.</p>
              <p>&gt; Sponsor logo (EnergyBrand Inc.) placed on jersey — kit queued for production.</p>
              <p className="text-emerald-400">&gt; Athlete Card podium drop live — 312 holders notified.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FOOTER CTA
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-900/30 border-t border-zinc-800/50 text-center relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <Mountain className="w-[800px] h-[800px]" />
        </div>
        <div className="max-w-2xl mx-auto relative z-10">
          <h2 className="text-3xl font-bold tracking-tight mb-6">
            Your next competition is your next revenue event.
          </h2>
          <p className="text-zinc-400 mb-10">
            Set up your Athlete Aisle in minutes. Mint your IP. Launch your Athlete Card.
            Get your sponsors on products. Pay your team automatically.
            Every event, your brand gets stronger — and so does theirs.
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