import { Button } from '@/components/ui/button';
import {
  Terminal, ShieldCheck, ChevronRight, Target,
  CheckCircle2, Zap, Fingerprint,
  DollarSign, Shirt, Star, Users, Camera, BarChart2,
  Package, Sparkles, TrendingUp, Link2, Bell
} from 'lucide-react';
import Link from 'next/link';

export default function InfluencersPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-violet-500/30">

      {/* ============================================================
          HERO SECTION
          ============================================================ */}
      <section className="relative px-8 pt-4 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-violet-500/6 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">

          {/* Left: Copy */}
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
              <Link href="/industries" className="hover:text-violet-400 transition-colors">INDUSTRIES</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-violet-400">INFLUENCER_DEPLOYMENT_MODULE</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
              You built the<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
                audience.
              </span>
            </h1>

            <p className="text-xl text-zinc-400 leading-relaxed font-light mb-4 max-w-2xl">
              You post every day. You build trust with hundreds of thousands of people. 
              And somewhere between the brand deals, the content calendar, and the platform 
              algorithm, the money still doesn&apos;t match the work.
            </p>

            <p className="text-xl text-zinc-200 leading-relaxed font-semibold mb-8 max-w-2xl">
              MetaWork gives you a second engine. Keep every sponsor you have — 
              and open new revenue lanes that don&apos;t step on anyone&apos;s toes.
              Own your content. Launch your store. Get paid for your influence
              <span className="text-violet-400"> on your terms.</span>
            </p>

            <div className="flex gap-4">
              <Link href="/register">
                <Button size="lg" className="h-12 px-8 bg-violet-600 hover:bg-violet-700 text-white rounded-none font-mono shadow-[0_0_20px_rgba(139,92,246,0.2)]">
                  <Terminal className="mr-2 h-4 w-4" /> Initialize Creator Aisle
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: Hero Image */}
          <div className="relative hidden lg:flex items-center justify-center">
            <div className="absolute -inset-4 bg-violet-500/10 blur-3xl rounded-full pointer-events-none" />
            <img
              src="/images/influencer-hero.jpg"
              alt="Content creator influencer"
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
          THE PARADIGM SHIFT — Sponsor Cooperation + New Revenue Lanes
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10 border border-zinc-800 bg-zinc-900/40 p-10 md:p-16 shadow-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-mono mb-8">
            <Zap className="h-3.5 w-3.5" />
            SYSTEM_INSIGHT: REVENUE_ARCHITECTURE
          </div>

          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
            Your sponsors are partners.<br />
            <span className="text-zinc-400">MetaWork finds the white space between them.</span>
          </h2>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6 text-zinc-400 leading-relaxed font-light">
              <p>
                Brand deals are great — until the exclusivity clauses kick in. You can&apos;t 
                sell coffee if you&apos;re signed to a tea brand. You can&apos;t push another 
                clothing line if you&apos;re locked to a fashion label. Your existing sponsorships 
                define your lanes — and that&apos;s a problem when half your potential revenue 
                is sitting in unclaimed territory.
              </p>
              <p>
                MetaWork&apos;s product catalog is broad by design. Your fitness sponsor lives on 
                supplements. Your apparel sponsor owns the hoodie. There&apos;s still room for 
                your branded water bottle, your pet line, your phone accessories, your art prints.
                <strong className="text-zinc-200"> We find the gaps.</strong>
              </p>
            </div>
            <div className="space-y-6 text-zinc-400 leading-relaxed font-light">
              <p>
                <strong className="text-violet-400">And for the sponsors you already have?</strong> MetaWork 
                makes you more valuable to them. Drop their logo on exclusive merch. 
                Create limited-edition collab products for your audience. Give them more 
                reach — on physical products fans actually own — beyond a 48-hour Instagram window.
              </p>
              <p>
                Meanwhile, your face, your name, your content, and your brand identity are 
                locked down as on-chain IP. Every licensed use of your likeness routes a 
                royalty back to your wallet. You created this. 
                <strong className="text-zinc-200"> You should be paid every time it earns.</strong>
              </p>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-zinc-800 flex items-center gap-4">
            <Sparkles className="h-8 w-8 text-violet-500 opacity-50" />
            <Fingerprint className="h-8 w-8 text-fuchsia-400 opacity-50" />
            <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest ml-4">
              &gt; More sponsors happy. More lanes open. More revenue yours.
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
              Why MetaWork makes your sponsors renew early
            </h2>
            <p className="text-zinc-400 max-w-2xl">
              This isn&apos;t about going around your brand partners — it&apos;s about being 
              the most productive, most organized, most professional version of yourself 
              that any sponsor has ever worked with.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Shirt,
                color: 'text-violet-400',
                borderColor: 'hover:border-violet-500/30',
                label: 'AMPLIFY_01',
                title: 'Their logos on products your audience actually buys.',
                body: "A post disappears in 24 hours. A hoodie sits in someone's closet for three years. MetaWork lets you place sponsor logos directly onto physical products — apparel, accessories, lifestyle goods — and sell them to your audience. Your sponsors get tangible, lasting brand presence. You get a revenue stream on every sale.",
              },
              {
                icon: Package,
                color: 'text-fuchsia-400',
                borderColor: 'hover:border-fuchsia-500/30',
                label: 'AMPLIFY_02',
                title: "A catalog deep enough that sponsors never conflict.",
                body: "Your beauty sponsor lives on skincare sets. Your tech sponsor goes on phone cases and desk accessories. Your fashion sponsor owns the apparel line. MetaWork's product catalog is intentionally wide so each sponsor has their own territory — and you have room to grow without a single awkward conversation.",
              },
              {
                icon: ShieldCheck,
                color: 'text-emerald-400',
                borderColor: 'hover:border-emerald-500/30',
                label: 'AMPLIFY_03',
                title: 'Your name and face are yours. Always.',
                body: "Your image, likeness, content, and brand identity are on-chain IP assets that you own completely. Sponsors can license them with your explicit permission — through a verifiable, auditable agreement. Nobody scrapes your content and monetizes it without a royalty back to you. Professional. Protected. Permanent.",
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
          FLAGSHIP FEATURE: CREATOR CARD NFT
          ============================================================ */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-500/4 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">

          <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-500/10 border border-violet-500/30 text-violet-400 text-xs font-mono mb-6 rounded">
            <Star className="h-3 w-3" />
            FLAGSHIP_PRODUCT
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">

            {/* Left: Editorial copy */}
            <div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
                The Creator Card.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
                  Your Brand. On-Chain.
                </span>
              </h2>
              <p className="text-zinc-400 leading-relaxed font-light mb-6 text-lg">
                The Creator Card NFT is the deepest fan relationship tool ever built for 
                an influencer. It turns your most loyal followers into a VIP community — 
                one that gets closer access, earlier drops, and exclusive experiences 
                the algorithm can never touch or throttle.
              </p>
              <p className="text-zinc-400 leading-relaxed font-light mb-8">
                Card holders get access to your upcoming content calendar, behind-the-scenes 
                production clips, creator collab announcements, exclusive sponsor drops, 
                and VIP pricing on every product in your Aisle. The more your audience grows, 
                the more valuable your card becomes — for you and everyone who holds it.
              </p>
              <div className="space-y-3 mb-10">
                {[
                  { icon: BarChart2,  label: 'Live content calendar, milestones & platform stats — always current' },
                  { icon: Users,      label: 'VIP fan dashboard — know exactly who your most loyal community is' },
                  { icon: Camera,     label: 'Exclusive content drops — BTS, collabs, raw cuts, early access' },
                  { icon: Bell,  label: 'Sponsor collab reveals — card holders hear first, every time' },
                  { icon: DollarSign, label: 'Holder-only merch discounts, limited drops & brand partnership exclusives' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 px-4 py-3 bg-zinc-900/50 border border-zinc-800">
                    <Icon className="h-4 w-4 text-violet-400 shrink-0" />
                    <span className="text-sm text-zinc-400">{label}</span>
                  </div>
                ))}
              </div>
              <Link href="/register">
                <Button size="lg" className="h-12 px-8 bg-violet-600 hover:bg-violet-700 text-white rounded-none font-mono shadow-[0_0_20px_rgba(139,92,246,0.2)]">
                  <Star className="mr-2 h-4 w-4" /> Mint Your Creator Card
                </Button>
              </Link>
            </div>

            {/* Right: Creator Card Mock */}
            <div className="relative mx-auto w-[300px] select-none">
              <div className="absolute -inset-6 bg-violet-500/15 blur-3xl rounded-full pointer-events-none animate-pulse" />

              <div className="relative border-2 border-violet-500/60 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[0_0_60px_rgba(139,92,246,0.25)] overflow-hidden">

                {/* Card Header */}
                <div className="bg-gradient-to-r from-violet-900/80 to-zinc-900 px-4 py-2 flex justify-between items-center border-b border-violet-500/30">
                  <span className="text-[10px] font-mono text-violet-400 tracking-widest">METAWORK /// CREATOR</span>
                  <span className="text-[10px] font-mono text-zinc-500">#012 / 1000</span>
                </div>

                {/* Creator Stage */}
                <div className="relative bg-gradient-to-b from-zinc-900 via-violet-950/20 to-zinc-950 overflow-hidden" style={{ height: '260px' }}>
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-full pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.08) 0%, transparent 70%)' }}
                  />
                  <img
                    src="https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif"
                    alt="Content creator recording"
                    width={260}
                    height={260}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                    style={{ mixBlendMode: 'lighten' }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
                  <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                    <p className="text-lg font-black tracking-tight text-white leading-none">NOVA &quot;SOLSTICE&quot;</p>
                    <p className="text-sm font-bold text-violet-400 tracking-widest">CHEN · LIFESTYLE / TECH</p>
                  </div>
                </div>

                {/* Audience Stats Bar */}
                <div className="grid grid-cols-3 border-t border-violet-500/30">
                  {[
                    { label: 'FOLLOWERS', value: '2.4M', color: 'text-violet-400' },
                    { label: 'AVG. VIEWS', value: '890K', color: 'text-fuchsia-400' },
                    { label: 'ENG. RATE',  value: '6.2%', color: 'text-emerald-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center py-3 border-r border-zinc-800 last:border-0">
                      <span className={`text-lg font-black ${color}`}>{value}</span>
                      <span className="text-[9px] font-mono text-zinc-500 tracking-widest">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Creator Stats */}
                <div className="px-4 py-3 space-y-2.5 border-t border-zinc-800">
                  {[
                    { label: 'CONTENT CONSISTENCY', value: 92, display: '92%',  color: '#8b5cf6' },
                    { label: 'AUDIENCE TRUST',       value: 88, display: '8.8',  color: '#a78bfa' },
                    { label: 'BRAND SAFETY SCORE',   value: 96, display: 'AAA',  color: '#34d399' },
                    { label: 'ACTIVE SPONSORS',       value: 60, display: '4',    color: '#f59e0b' },
                    { label: 'CARD HOLDERS (VIP)',    value: 55, display: '550',  color: '#e879f9' },
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

                {/* Upcoming Drops */}
                <div className="px-4 py-3 border-t border-zinc-800 space-y-1">
                  <p className="text-[9px] font-mono text-zinc-500 tracking-widest mb-1">NEXT_DROPS</p>
                  {[
                    { name: 'Summer Collab Drop · Limited',   date: 'JUL 04' },
                    { name: 'Brand Reveal — VIP Early Access', date: 'JUL 18' },
                  ].map(({ name, date }) => (
                    <div key={name} className="flex justify-between">
                      <span className="text-[9px] text-zinc-400">{name}</span>
                      <span className="text-[9px] font-mono text-violet-400">{date}</span>
                    </div>
                  ))}
                </div>

                {/* Card Footer */}
                <div className="bg-gradient-to-r from-violet-900/40 to-zinc-900/60 px-4 py-2 flex justify-between items-center border-t border-violet-500/20">
                  <span className="text-[9px] font-mono text-violet-500/70 tracking-widest">DIAMOND TIER</span>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-1.5 w-1.5 rounded-full bg-violet-400" />
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
              Creator Deployment Tracks
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
              Four turn-key pipelines built for the working content creator — 
              any niche, any platform, any audience size.
            </p>
          </div>

          <div className="space-y-12">

            {/* TRACK 01: SPONSOR MERCH */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-violet-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Shirt className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-violet-500/10 px-2 py-1 text-xs font-mono text-violet-400 mb-4 border border-violet-500/20">
                    TRACK_01: SPONSOR_MERCH
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Your Sponsors on Products. Instantly.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    The brand deal is already signed. Now activate it beyond the post. 
                    MetaWork&apos;s visual designer lets you place sponsor logos directly onto 
                    physical products — apparel, mugs, tote bags, phone cases — and sell them 
                    through your Creator Aisle. Each brand gets dedicated product territory. 
                    Fans buy, we fulfill globally, you earn in USDC. Sponsors get real-world 
                    brand presence that outlasts any story or reel.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-violet-400" /> Creator Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-violet-400 mr-2">-</span> Give sponsors a physical, lasting presence beyond the feed.</li>
                      <li className="flex items-start"><span className="text-violet-400 mr-2">-</span> Launch limited collab drops with zero inventory risk.</li>
                      <li className="flex items-start"><span className="text-violet-400 mr-2">-</span> Create a new revenue stream on every brand relationship.</li>
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
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-violet-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Fingerprint className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-violet-500/10 px-2 py-1 text-xs font-mono text-violet-400 mb-4 border border-violet-500/20">
                    TRACK_02: IP_PROTECTION
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Own Your Content. Get Paid Every Time It Earns.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Your content is being clipped, reposted, and monetized by platforms 
                    and accounts that didn&apos;t create it. Your name and face are used in 
                    ads without traceable agreements. Mint your content as on-chain IP — 
                    photos, videos, audio, artwork, brand identity — and every downstream 
                    licensed use routes a royalty directly to your wallet. Sponsors who 
                    want to use your likeness do it on-chain, on your terms, with a 
                    verifiable audit trail.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-violet-400" /> Creator Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-violet-400 mr-2">-</span> Stop platforms from monetizing your content without paying you.</li>
                      <li className="flex items-start"><span className="text-violet-400 mr-2">-</span> Establish immutable ownership of every piece of your brand.</li>
                      <li className="flex items-start"><span className="text-violet-400 mr-2">-</span> License your likeness to sponsors on fully transparent terms.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> One-click IP minting on Algorand — photos, video, audio, logos.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Automated royalty routing on every downstream licensed use.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Cryptographic proof of ownership — your brand, protected forever.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 03: TEAM PAYOUTS */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-violet-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <DollarSign className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-violet-500/10 px-2 py-1 text-xs font-mono text-violet-400 mb-4 border border-violet-500/20">
                    TRACK_03: TEAM_PAYOUTS
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Pay Your Whole Team Automatically.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Behind every successful creator is a videographer, an editor, a 
                    manager, an assistant, a photographer — each with a cut of every deal. 
                    Set your revenue split once in a MetaWork smart contract. When a brand 
                    payment lands, every person on your team gets paid automatically in USDC, 
                    in seconds. Total transparency on-chain. No chasing invoices. 
                    No manual bank transfers. No awkward end-of-month conversations.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-violet-400" /> Creator Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-violet-400 mr-2">-</span> Eliminate manual payouts to editors and production team.</li>
                      <li className="flex items-start"><span className="text-violet-400 mr-2">-</span> Build trust with your crew — they see the split on-chain.</li>
                      <li className="flex items-start"><span className="text-violet-400 mr-2">-</span> Settle brand deal revenue in seconds, not weeks.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Custom revenue-split smart contracts per income source.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Multi-wallet payout — unlimited recipients.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Full on-chain transparency — every team member can verify their cut.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 04: CREATOR DROPS */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-violet-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-violet-500/10 px-2 py-1 text-xs font-mono text-violet-400 mb-4 border border-violet-500/20">
                    TRACK_04: CREATOR_DROPS
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Drop Products. Build Moments. Own the Launch.</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Milestone drops, collab reveals, channel anniversary limited editions — 
                    these are the moments your audience lives for. MetaWork gives you a 
                    full drop toolkit: limited-edition product runs, VIP card holder early 
                    access, countdown timers, and global fulfillment. Build the hype, 
                    launch the drop, sell out — all without touching inventory or 
                    coordinating a single shipment yourself.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-violet-400" /> Creator Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-violet-400 mr-2">-</span> Monetize milestone moments — 1M subs, anniversaries, collabs.</li>
                      <li className="flex items-start"><span className="text-violet-400 mr-2">-</span> Give card holders early access — reward your most loyal fans.</li>
                      <li className="flex items-start"><span className="text-violet-400 mr-2">-</span> Create scarcity and urgency without coordinating logistics.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Limited-run product drops with configurable quantity caps.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Card holder early-access windows before public sale.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Global fulfillment — zero inventory, zero logistics overhead.</li>
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
              <div className="h-3 w-3 rounded-full bg-violet-500/20" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/20" />
            </div>
            <span className="text-[10px] font-mono text-violet-400">/creator-terminal/live-telemetry</span>
          </div>
          <div className="p-8 font-mono text-sm space-y-4">
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>ACTIVE_CREATOR:</span>
              <span className="text-zinc-300">&quot;NOVA_SOLSTICE&quot; | VERIFIED | LIFESTYLE / TECH</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>CREATOR_CARD_HOLDERS:</span>
              <span className="text-violet-400">550 fans (DIAMOND tier)</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>MERCH_REVENUE_MTD:</span>
              <span className="text-emerald-400">$7,340.00 USDC</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>ACTIVE_SPONSORS:</span>
              <span className="text-zinc-300">4 brands — no product conflicts detected</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>NEXT_DROP:</span>
              <span className="text-amber-400">Summer Collab Limited Edition — JUL 04</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>LAST_TEAM_PAYOUT:</span>
              <span className="text-emerald-400">DISTRIBUTED (3 recipients, &lt;3 seconds)</span>
            </div>
            <div className="mt-4 text-xs text-zinc-400 pt-4">
              <p className="text-violet-400 mb-2">SMART_CONTRACT_LOG &gt;</p>
              <p>&gt; IP asset &quot;NOVA_SOLSTICE_BRAND_KIT_v3&quot; licensed by TechBrand Co.</p>
              <p>&gt; Royalty: $480.00 USDC routed to creator wallet automatically.</p>
              <p>&gt; Sponsor logo (BeautyBrand Inc.) placed on limited collab set — production queued.</p>
              <p className="text-emerald-400">&gt; Creator Card drop live — 550 VIP holders notified first.</p>
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
            Your next post is your next revenue event.
          </h2>
          <p className="text-zinc-400 mb-10">
            Set up your Creator Aisle in minutes. Mint your IP. Launch your Creator Card.
            Activate your sponsors on products. Pay your team automatically.
            Every upload, every collab, every milestone — your brand compounds.
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