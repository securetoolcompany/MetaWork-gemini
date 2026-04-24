import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Terminal, Dumbbell, ArrowRight, ShieldCheck, Activity, 
  Users, LineChart, ChevronRight, Ticket, Trophy, Target, 
  CheckCircle2, Box
} from 'lucide-react';
import Link from 'next/link';

export default function GymsFitnessPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-rose-500/30">
      
      {/* HERO SECTION */}
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-rose-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
            <Link href="/industries" className="hover:text-rose-400 transition-colors">INDUSTRIES</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-rose-400">ATHLETIC_DEPLOYMENT_MODULE</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            Monetize the mat. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-red-600">Zero inventory required.</span>
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8 max-w-2xl">
            You built the community. Now capture the value. Use MetaWork to launch premium gear, crowdfund your fight team, and sell digital event tickets—all automated through the blockchain, with zero upfront costs.
          </p>
          <div className="flex gap-4">
            <Link href="/login">
              <Button size="lg" className="h-12 px-8 bg-rose-600 hover:bg-rose-700 text-white rounded-none font-mono shadow-[0_0_20px_rgba(225,29,72,0.2)]">
                <Terminal className="mr-2 h-4 w-4" /> Initialize Gym Aisle
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6">
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-rose-500/50 hover:border-rose-500/30 transition-colors">
            <CardHeader>
              <Box className="h-8 w-8 text-rose-400 mb-2" />
              <CardTitle className="font-mono text-lg">On-Demand Gear</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Design custom rash guards, hoodies, and walk-out shirts. When a member orders from your MetaWork Aisle, we manufacture and ship it directly. No upfront costs or leftover sizes.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-rose-500/50 hover:border-rose-500/30 transition-colors">
            <CardHeader>
              <Trophy className="h-8 w-8 text-rose-400 mb-2" />
              <CardTitle className="font-mono text-lg">Tokenized Athletes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Let your gym community sponsor fighters. Fans buy digital trading cards to fund a fight camp, and smart contracts automatically split purse bonuses back to the sponsors.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-rose-500/50 hover:border-rose-500/30 transition-colors">
            <CardHeader>
              <ShieldCheck className="h-8 w-8 text-rose-400 mb-2" />
              <CardTitle className="font-mono text-lg">IP Protection</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Mint your academy's logo on the blockchain. If other designers in the MetaWork network use your logo on their products, our algorithm routes the royalty directly to your wallet.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ROBUST DEPLOYMENT TRACKS */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Combat & Fitness Deployment Tracks</h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
              We provide turn-key, zero-overhead pipelines specifically engineered for martial arts academies, crossfit boxes, and independent fight promotions. Take total control of your gym's economy.
            </p>
          </div>

          <div className="space-y-12">
            
            {/* TRACK 1: Supply Chain & Merch */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-rose-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Box className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-rose-500/10 px-2 py-1 text-xs font-mono text-rose-400 mb-4 border border-rose-500/20">
                    TRACK_01: SUPPLY_CHAIN
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Infinite Merchandising</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Stop tying up $5,000 in t-shirt inventory that sits in a cardboard box in the back office. The MetaWork design engine lets you launch fresh, high-quality gear every single month.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-rose-400" /> Business Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-rose-400 mr-2">-</span> Eliminate dead stock and upfront costs.</li>
                      <li className="flex items-start"><span className="text-rose-400 mr-2">-</span> Offer an expanded catalog (shorts, hoodies, bags).</li>
                      <li className="flex items-start"><span className="text-rose-400 mr-2">-</span> Create limited-edition drops for seminars and belt promotions.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Drag-and-drop MetaManufacturing design suite.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Global print-on-demand fulfillment integration.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Dedicated, public-facing Aisle for your members.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 2: Fighter Trading Cards */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-rose-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Trophy className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-rose-500/10 px-2 py-1 text-xs font-mono text-rose-400 mb-4 border border-rose-500/20">
                    TRACK_02: ATHLETE_FUNDING
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Fighter Cards & Sponsorships</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Fight camps are expensive. Turn your stable of amateur and pro fighters into tokenized assets. Mint digital "Fighter Trading Cards" as NFTs that the community buys to fund the fighter's journey.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-rose-400" /> Business Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-rose-400 mr-2">-</span> Crowdfund athlete medicals, travel, and training gear.</li>
                      <li className="flex items-start"><span className="text-rose-400 mr-2">-</span> Deepen local fan engagement and gym loyalty.</li>
                      <li className="flex items-start"><span className="text-rose-400 mr-2">-</span> Create recurring revenue streams for active competitors.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Immutable NFT minting for collectible Fighter Cards.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Smart contracts that route a % of purse/sponsors back to fans.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Secondary market trading for rare athlete assets.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 3: Event Ticketing & Gate NFTs */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-rose-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Ticket className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-rose-500/10 px-2 py-1 text-xs font-mono text-rose-400 mb-4 border border-rose-500/20">
                    TRACK_03: ACCESS_PROTOCOLS
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Gate NFTs & Event Ticketing</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Hosting an in-house smoker, a grappling tournament, or a masterclass seminar? Stop using legacy platforms that take 10% of the cut. Issue your event tickets as secure, verifiable NFTs.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-rose-400" /> Business Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-rose-400 mr-2">-</span> Eradicate ticket fraud and scalping.</li>
                      <li className="flex items-start"><span className="text-rose-400 mr-2">-</span> Sell "Lifetime VIP" tokens for permanent front-row access.</li>
                      <li className="flex items-start"><span className="text-rose-400 mr-2">-</span> Capture royalties every time a ticket is resold.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Direct-to-wallet ticketing on Algorand.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> QR code scanner integration for seamless door checks.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Automated secondary market royalty collection.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 4: Facility Expansion */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-rose-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Users className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-rose-500/10 px-2 py-1 text-xs font-mono text-rose-400 mb-4 border border-rose-500/20">
                    TRACK_04: REVENUE_POOLS
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Facility Expansion Equity</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Need new mats, a heavier bag rack, or moving to a larger facility? Tokenize a percentage of your gym's total merchandise revenue pool. Your members fund the expansion, and they earn a yield when the gym succeeds.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-rose-400" /> Business Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-rose-400 mr-2">-</span> Raise capital instantly without crippling bank loans.</li>
                      <li className="flex items-start"><span className="text-rose-400 mr-2">-</span> Maintain 100% operational ownership of your academy.</li>
                      <li className="flex items-start"><span className="text-rose-400 mr-2">-</span> Turn casual gym-goers into brand evangelists.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Custom Smart Contract Revenue Pool setup.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Live crowdfunding progress trackers in your Terminal.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Automated dividend distribution back to member wallets.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Terminal View / Live Data Mockup */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto rounded-md border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-2xl">
          <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between">
            <div className="flex gap-2"><div className="h-3 w-3 rounded-full bg-red-500/20" /><div className="h-3 w-3 rounded-full bg-yellow-500/20" /></div>
            <span className="text-[10px] font-mono text-rose-400">/gym-dashboard/live-telemetry</span>
          </div>
          <div className="p-8 font-mono text-sm space-y-4">
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>ACTIVE_ASSET:</span><span className="text-zinc-300">"FIGHTER_CARD: J. SMITH" (TIER: RARE)</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>FIGHT_CAMP_TARGET:</span><span className="text-rose-400">$3,000.00</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>CARDS_MINTED (SPONSORS):</span><span className="text-emerald-400">30 / 30 (SOLD OUT)</span>
            </div>
            <div className="mt-4 text-xs text-zinc-400 pt-4">
              <p className="text-rose-400 mb-2">SMART_CONTRACT_LOG &gt;</p>
              <p>&gt; Fight completed. Sponsorship bonus ($5,000) ingested.</p>
              <p>&gt; Routing 20% ($1,000) back to 30 Fighter Card holders.</p>
              <p className="text-emerald-400">&gt; Yield execution complete. Community payout verified.</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}