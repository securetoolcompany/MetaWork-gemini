import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, ArrowRight, BarChart3, Repeat, Target, ChevronRight, ShoppingBag, Dice5, Zap, CheckCircle2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function RetailersPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-cyan-500/30">
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
            <Link href="/industries" className="hover:text-cyan-400">INDUSTRIES</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-cyan-400">RETAIL_AGILITY_MODULE</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            Agile Retail & Merchandising. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">Never hold dead stock.</span>
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8 max-w-2xl">
            Retailers use MetaWork to spin up new product lines instantly. License trending IP, push products to your Aisle in seconds, and see what converts—all before manufacturing a single unit. 
          </p>
          <div className="flex gap-4">
            <Link href="/login">
              <Button size="lg" className="h-12 px-8 bg-cyan-600 hover:bg-cyan-700 text-white rounded-none font-mono">
                <Terminal className="mr-2 h-4 w-4" /> Open Retail Terminal
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6">
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-cyan-500/50">
            <CardHeader>
              <Target className="h-8 w-8 text-cyan-400 mb-2" />
              <CardTitle className="font-mono text-lg">A/B Demand Testing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Launch 50 product variations on your storefront today. The ones that don't sell cost you nothing. The ones that go viral are automatically routed to our global production nodes.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-cyan-500/50">
            <CardHeader>
              <Repeat className="h-8 w-8 text-cyan-400 mb-2" />
              <CardTitle className="font-mono text-lg">Instant IP Licensing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Spot a trend? Browse the MetaWork IP library to find artwork matching the current zeitgeist. Apply it to blanks and sell immediately; smart contracts handle the creator's royalty.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-cyan-500/50">
            <CardHeader>
              <BarChart3 className="h-8 w-8 text-cyan-400 mb-2" />
              <CardTitle className="font-mono text-lg">Live Margin Pipelines</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Access institutional-grade commodity trackers directly in your dashboard. Monitor shipping freight and cotton costs to dynamically update your retail pricing and protect margins.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* THE VALUE SHIFT: RETAIL & MERCH */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <ShoppingBag className="w-96 h-96" />
        </div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="inline-flex items-center rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-mono text-cyan-400 uppercase tracking-widest mb-8">
            <ShieldCheck className="mr-2 h-3.5 w-3.5" /> The IP Imperative
          </div>
          
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
                The <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">Fast-Fashion Defense.</span>
              </h2>
              <p className="text-lg text-zinc-400 leading-relaxed font-light mb-6">
                The retail landscape is plagued by algorithms trained to scrape independent designs and feed them to overseas manufacturing hubs in hours. By the time your boutique brand gains traction, corporate fast-fashion has already diluted your market with cheap knock-offs.
              </p>
              <p className="text-lg text-zinc-400 leading-relaxed font-light mb-6">
                Minting is your cryptographic armor. By registering your design files on the Algorand blockchain the second they are finalized, you establish absolute, chronological proof of origin. It turns a subjective copyright dispute into an undeniable mathematical fact. Furthermore, it allows retailers to verify the authenticity of limited-edition physical drops via paired digital tokens, instantly separating your authentic gear from the counterfeits.
              </p>
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800 p-8 font-mono text-sm space-y-6">
              <div className="border-l-2 border-cyan-500 pl-4">
                <div className="text-cyan-400 mb-1">THREAT_VECTOR:</div>
                <div className="text-zinc-500 text-xs">AI-driven design scraping and instantaneous offshore counterfeiting destroying independent margins.</div>
              </div>
              <div className="border-l-2 border-emerald-500 pl-4">
                <div className="text-emerald-400 mb-1">METAWORK_SOLUTION:</div>
                <div className="text-zinc-500 text-xs">Timestamped, immutable IP minting. Provide buyers with cryptographic proof of authenticity that fast-fashion cannot replicate.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROBUST DEPLOYMENT TRACKS */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Retail Agility Tracks</h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
              From high-fashion e-commerce drops to specialized tabletop gaming stores, MetaWork provides the supply chain back-end to scale without overhead.
            </p>
          </div>

          <div className="space-y-12">
            {/* TRACK 1 */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-cyan-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Zap className="w-48 h-48" /></div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-cyan-500/10 px-2 py-1 text-xs font-mono text-cyan-400 mb-4 border border-cyan-500/20">TRACK_01: E_COMMERCE</div>
                  <h3 className="text-2xl font-bold mb-4">Flash Sales & Pop-up Drops</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">Capitalize on internet trends instantly. See a meme blowing up? License the IP, launch a t-shirt drop on your Aisle within 20 minutes, and capture the hype cycle.</p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><Target className="mr-2 h-4 w-4 text-cyan-400" /> Business Goals</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-cyan-400 mr-2">-</span> Maximize speed-to-market.</li>
                      <li className="flex items-start"><span className="text-cyan-400 mr-2">-</span> Avoid buying inventory for a trend that dies in a week.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Instant network licensing from the IP Library.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> 1-click publishing to public Aisles.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 2 */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-cyan-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Dice5 className="w-48 h-48" /></div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-cyan-500/10 px-2 py-1 text-xs font-mono text-cyan-400 mb-4 border border-cyan-500/20">TRACK_02: NICHE_RETAIL</div>
                  <h3 className="text-2xl font-bold mb-4">Hobby & Tabletop Shops</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">Run a Local Game Store (LGS)? Go beyond selling boosters. License fantasy art to create custom playmats, deck boxes, and apparel. Tokenize your store's community to fund a larger play space for MTG and Chess tournaments.</p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><Target className="mr-2 h-4 w-4 text-cyan-400" /> Business Goals</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-cyan-400 mr-2">-</span> Differentiate from online mega-retailers with custom goods.</li>
                      <li className="flex items-start"><span className="text-cyan-400 mr-2">-</span> Deepen local community investment (Revenue Pools).</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> High-margin custom accessory manufacturing.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Community token issuance and dividend routing.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto rounded-md border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-2xl">
          <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between">
            <div className="flex gap-2"><div className="h-3 w-3 rounded-full bg-red-500/20" /><div className="h-3 w-3 rounded-full bg-yellow-500/20" /></div>
            <span className="text-[10px] font-mono text-cyan-400">/retail/demand-telemetry</span>
          </div>
          <div className="p-8 font-mono text-sm space-y-4">
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>LIVE_CATALOG_SIZE:</span><span className="text-zinc-300">412 SKUs</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>DEAD_STOCK_COST:</span><span className="text-emerald-400">$0.00</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>TOP_CONVERTING_ASSET:</span><span className="text-cyan-400">"CYBER_PUNK_VAR_03" (18%)</span>
            </div>
            <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded text-xs text-zinc-400 pt-4">
              <p className="text-cyan-400 mb-2">SYSTEM_RECOMMENDATION &gt;</p>
              <p>&gt; High engagement detected on "Vintage Wash Blank".</p>
              <p>&gt; Base raw material (Cotton) up 2% today.</p>
              <p className="text-zinc-300">&gt; Recommendation: Increase retail price by $1.50 to hold margin.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}