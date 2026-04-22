import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, ShoppingBag, ArrowRight, BarChart3, Repeat, Target, ChevronRight } from 'lucide-react';
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
            <Link href="/register">
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
                Spot a trend? Browse the MetaWork IP library to find artwork matching the current zeitgeist. Apply it to blanks and sell immediately; smart contracts automatically handle the creator's royalty.
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

      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
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
            <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded text-xs text-zinc-400">
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