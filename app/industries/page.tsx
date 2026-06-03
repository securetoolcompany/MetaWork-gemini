import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Terminal, Dumbbell, GraduationCap, Coffee, Palette, 
  ArrowRight, ShieldCheck, Gamepad2, ChevronRight, Store, 
  Gift, HeartHandshake, Zap, Building2, Network, Swords, Trophy, Star
} from 'lucide-react';
import Link from 'next/link';

export default function IndustriesPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-blue-500/30">
      
      {/* HERO SECTION */}
      <section className="relative px-8 pt-24 pb-20 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs font-mono text-indigo-400 uppercase tracking-widest mb-8">
            <Terminal className="mr-2 h-3.5 w-3.5" />
            Network Deployment Sectors
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            Engineered for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">Real-World Scale.</span>
          </h1>
          
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-10 max-w-3xl">
            MetaWork is an operational layer currently powering supply chains, capital raises, and IP licensing across industries. Select your sector below to see how blockchain and tokenization can power your business to the next level.
          </p>
          
          <div className="flex gap-4">
            <Link href="/login">
              <Button size="lg" className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-none border border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.2)]">
                Initialize Workspace
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* THE 7 INDUSTRIES FUNNEL (Bento Grid) */}
      <section className="px-8 py-24 bg-zinc-950">
        <div className="max-w-7xl mx-auto">

          {/* FIGHTERS — Featured full-width card (NEW) */}
          <Link href="/industries/fighters" className="block group mb-6">
            <Card className="bg-zinc-900/40 border-zinc-800 group-hover:border-red-500/50 transition-all duration-300 rounded-none relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-orange-500/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-0 right-0 w-[400px] h-[300px] bg-red-500/5 blur-[80px] rounded-full pointer-events-none" />
              <CardContent className="p-8 md:p-10 relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                  
                  {/* Left: Icon + heading + description */}
                  <div className="flex items-start gap-6 flex-1">
                    <div className="h-14 w-14 bg-red-500/10 border border-red-500/20 flex items-center justify-center rounded shrink-0 group-hover:scale-110 transition-transform">
                      <Swords className="h-7 w-7 text-red-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Fighters</h2>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-mono rounded">
                          NEW — FIGHTER_DEPLOYMENT_MODULE
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
                        The first platform built specifically for the individual competitor. Mint your IP, pay your whole team trustlessly on fight night, launch your Fighter Card to build a fanbase that pays you between fights, and sell merch with zero inventory risk.
                      </p>
                    </div>
                  </div>

                  {/* Right: Feature tags + arrow */}
                  <div className="flex flex-col items-start md:items-end gap-4 shrink-0">
                    <div className="flex flex-wrap gap-2 font-mono text-[10px]">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400">
                        <Trophy className="h-3 w-3" /> FIGHTER_CARD_NFT
                      </span>
                      <span className="px-2 py-1 bg-zinc-950 border border-zinc-800 text-zinc-500">MERCH_SALES</span>
                      <span className="px-2 py-1 bg-zinc-950 border border-zinc-800 text-zinc-500">IP_TOKENIZATION</span>
                      <span className="px-2 py-1 bg-zinc-950 border border-zinc-800 text-zinc-500">PURSE_DISTRIBUTION</span>
                      <span className="px-2 py-1 bg-zinc-950 border border-zinc-800 text-zinc-500">FIGHT_KITS</span>
                    </div>
                    <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-red-400 transition-colors group-hover:translate-x-1" />
                  </div>

                </div>
              </CardContent>
            </Card>
          </Link>
          
          {/* Row 1: The Big 3 (Gyms, Education, Food) */}
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            
            {/* GYMS & FITNESS */}
            <Link href="/industries/gyms-fitness" className="block group">
              <Card className="bg-zinc-900/40 border-zinc-800 group-hover:border-rose-500/50 transition-all duration-300 rounded-none h-full flex flex-col relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-4 border-b border-zinc-800/50 bg-zinc-900/20 relative z-10">
                  <div className="flex justify-between items-start">
                    <div className="h-12 w-12 bg-rose-500/10 border border-rose-500/20 flex items-center justify-center rounded mb-4 group-hover:scale-110 transition-transform">
                      <Dumbbell className="h-6 w-6 text-rose-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-rose-400 transition-colors group-hover:translate-x-1" />
                  </div>
                  <CardTitle className="text-2xl font-bold tracking-tight">Gyms & Fitness</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 flex-1 relative z-10">
                  <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                    Zero-inventory fight gear, digital ticket gates for tournaments, and tokenized fighter sponsorships. Monetize the mat.
                  </p>
                  <div className="flex flex-wrap gap-2 font-mono text-[10px] text-zinc-500">
                    <span className="px-2 py-1 bg-zinc-950 border border-zinc-800">MERCHANDISE</span>
                    <span className="px-2 py-1 bg-zinc-950 border border-zinc-800">ATHLETE_SPONSORSHIP</span>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* EDUCATION */}
            <Link href="/industries/education" className="block group">
              <Card className="bg-zinc-900/40 border-zinc-800 group-hover:border-indigo-500/50 transition-all duration-300 rounded-none h-full flex flex-col relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-4 border-b border-zinc-800/50 bg-zinc-900/20 relative z-10">
                  <div className="flex justify-between items-start">
                    <div className="h-12 w-12 bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center rounded mb-4 group-hover:scale-110 transition-transform">
                      <GraduationCap className="h-6 w-6 text-indigo-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-indigo-400 transition-colors group-hover:translate-x-1" />
                  </div>
                  <CardTitle className="text-2xl font-bold tracking-tight">Education</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 flex-1 relative z-10">
                  <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                    Real-world commerce for classrooms. Students design products and raise real funds for clubs without touching school budgets.
                  </p>
                  <div className="flex flex-wrap gap-2 font-mono text-[10px] text-zinc-500">
                    <span className="px-2 py-1 bg-zinc-950 border border-zinc-800">CTE_CURRICULUM</span>
                    <span className="px-2 py-1 bg-zinc-950 border border-zinc-800">FUNDRAISING</span>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* FOOD & BEVERAGE */}
            <Link href="/industries/food-beverage" className="block group">
              <Card className="bg-zinc-900/40 border-zinc-800 group-hover:border-emerald-500/50 transition-all duration-300 rounded-none h-full flex flex-col relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-4 border-b border-zinc-800/50 bg-zinc-900/20 relative z-10">
                  <div className="flex justify-between items-start">
                    <div className="h-12 w-12 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center rounded mb-4 group-hover:scale-110 transition-transform">
                      <Coffee className="h-6 w-6 text-emerald-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-emerald-400 transition-colors group-hover:translate-x-1" />
                  </div>
                  <CardTitle className="text-2xl font-bold tracking-tight">Food & Beverage</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 flex-1 relative z-10">
                  <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                    Bypass bank loans. Tokenize your café's future revenue so your local regulars can fund your buildout and earn a yield.
                  </p>
                  <div className="flex flex-wrap gap-2 font-mono text-[10px] text-zinc-500">
                    <span className="px-2 py-1 bg-zinc-950 border border-zinc-800">CROWDFUNDING</span>
                    <span className="px-2 py-1 bg-zinc-950 border border-zinc-800">LOYALTY_PROGRAMS</span>
                  </div>
                </CardContent>
              </Card>
            </Link>

          </div>

          {/* Row 2: Supply Chain (Promo, Retailers) */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            
            {/* GIFTS & PROMO */}
            <Link href="/industries/gifts-promo" className="block group">
              <Card className="bg-zinc-900/40 border-zinc-800 group-hover:border-pink-500/50 transition-all duration-300 rounded-none h-full flex flex-col relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-pink-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-4 border-b border-zinc-800/50 bg-zinc-900/20 relative z-10">
                  <div className="flex justify-between items-start">
                    <div className="h-12 w-12 bg-pink-500/10 border border-pink-500/20 flex items-center justify-center rounded mb-4 group-hover:scale-110 transition-transform">
                      <Gift className="h-6 w-6 text-pink-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-pink-400 transition-colors group-hover:translate-x-1" />
                  </div>
                  <CardTitle className="text-2xl font-bold tracking-tight">Gifts & Promo (B2B)</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 flex-1 relative z-10">
                  <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                    End-to-end B2B merchandising. Build private corporate storefronts for employee onboarding kits or trade show swag, fully integrated with our global print-on-demand network.
                  </p>
                  <div className="flex flex-wrap gap-2 font-mono text-[10px] text-zinc-500">
                    <span className="px-2 py-1 bg-zinc-950 border border-zinc-800">B2B_FULFILLMENT</span>
                    <span className="px-2 py-1 bg-zinc-950 border border-zinc-800">PRIVATE_STOREFRONTS</span>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* RETAILERS */}
            <Link href="/industries/retailers" className="block group">
              <Card className="bg-zinc-900/40 border-zinc-800 group-hover:border-cyan-500/50 transition-all duration-300 rounded-none h-full flex flex-col relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-4 border-b border-zinc-800/50 bg-zinc-900/20 relative z-10">
                  <div className="flex justify-between items-start">
                    <div className="h-12 w-12 bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center rounded mb-4 group-hover:scale-110 transition-transform">
                      <Store className="h-6 w-6 text-cyan-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-cyan-400 transition-colors group-hover:translate-x-1" />
                  </div>
                  <CardTitle className="text-2xl font-bold tracking-tight">Retailers & LGS</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 flex-1 relative z-10">
                  <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                    Test product demand instantly. License trending IP to create apparel or tabletop gaming accessories (like playmats) without buying a single unit of dead stock.
                  </p>
                  <div className="flex flex-wrap gap-2 font-mono text-[10px] text-zinc-500">
                    <span className="px-2 py-1 bg-zinc-950 border border-zinc-800">AGILE_CATALOGS</span>
                    <span className="px-2 py-1 bg-zinc-950 border border-zinc-800">A/B_TESTING</span>
                  </div>
                </CardContent>
              </Card>
            </Link>

          </div>

          {/* Row 3: Digital & Trust (Creators, Non-Profits) */}
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* CREATORS & INFLUENCERS */}
            <Link href="/industries/creators" className="block group">
              <Card className="bg-zinc-900/40 border-zinc-800 group-hover:border-purple-500/50 transition-all duration-300 rounded-none h-full flex flex-col relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-4 border-b border-zinc-800/50 bg-zinc-900/20 relative z-10">
                  <div className="flex justify-between items-start">
                    <div className="h-12 w-12 bg-purple-500/10 border border-purple-500/20 flex items-center justify-center rounded mb-4 group-hover:scale-110 transition-transform">
                      <Palette className="h-6 w-6 text-purple-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-purple-400 transition-colors group-hover:translate-x-1" />
                  </div>
                  <CardTitle className="text-2xl font-bold tracking-tight">Creators & Influencers</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 flex-1 relative z-10">
                  <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                    Stop posting art for free. Mint your designs as secure IP assets, license them globally to product creators, and earn automated royalties on every physical sale.
                  </p>
                  <div className="flex flex-wrap gap-2 font-mono text-[10px] text-zinc-500">
                    <span className="px-2 py-1 bg-zinc-950 border border-zinc-800">IP_LICENSING</span>
                    <span className="px-2 py-1 bg-zinc-950 border border-zinc-800">AUTOMATED_ROYALTIES</span>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* NON-PROFITS & CHARITIES */}
            <Link href="/industries/non-profits" className="block group">
              <Card className="bg-zinc-900/40 border-zinc-800 group-hover:border-amber-500/50 transition-all duration-300 rounded-none h-full flex flex-col relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-4 border-b border-zinc-800/50 bg-zinc-900/20 relative z-10">
                  <div className="flex justify-between items-start">
                    <div className="h-12 w-12 bg-amber-500/10 border border-amber-500/20 flex items-center justify-center rounded mb-4 group-hover:scale-110 transition-transform">
                      <HeartHandshake className="h-6 w-6 text-amber-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-amber-400 transition-colors group-hover:translate-x-1" />
                  </div>
                  <CardTitle className="text-2xl font-bold tracking-tight">Non-Profits & Charities</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 flex-1 relative z-10">
                  <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                    Establish immutable trust. Use cryptographic ledgers to prove exactly where donor funds are routed, and sell awareness merchandise with zero overhead risk.
                  </p>
                  <div className="flex flex-wrap gap-2 font-mono text-[10px] text-zinc-500">
                    <span className="px-2 py-1 bg-zinc-950 border border-zinc-800">TRANSPARENT_LEDGERS</span>
                    <span className="px-2 py-1 bg-zinc-950 border border-zinc-800">DONATION_ROUTING</span>
                  </div>
                </CardContent>
              </Card>
            </Link>

          </div>

        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="px-8 py-24 bg-zinc-900/30 border-t border-zinc-800/50 text-center relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <Network className="w-[800px] h-[800px]" />
        </div>
        <div className="max-w-2xl mx-auto relative z-10">
          <h2 className="text-3xl font-bold tracking-tight mb-6">Ready to upgrade your industry?</h2>
          <p className="text-zinc-400 mb-10">
            Join the decentralized economy. Setup takes minutes, and execution happens instantly on the Algorand blockchain.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 bg-white text-black hover:bg-zinc-200 rounded-none font-bold tracking-wide">
                Start Tokenizing
              </Button>
            </Link>
            <Link href="/showroom">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-none font-mono">
                View Active Nodes <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}