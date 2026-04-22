import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, Gift, ArrowRight, PackageOpen, Layers, Cog, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function GiftsPromoPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-pink-500/30">
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-pink-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
            <Link href="/industries" className="hover:text-pink-400">INDUSTRIES</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-pink-400">PROMO_AND_B2B_MODULE</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            B2B Gifts & Promo Merch. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400">Zero overhead risk.</span>
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8 max-w-2xl">
            Provide end-to-end merchandising solutions for corporate clients. Build custom promotional products via the MetaManufacturing drag-and-drop tool and route fulfillment globally without touching a warehouse.
          </p>
          <div className="flex gap-4">
            <Link href="/register">
              <Button size="lg" className="h-12 px-8 bg-pink-600 hover:bg-pink-700 text-white rounded-none font-mono">
                <Terminal className="mr-2 h-4 w-4" /> Start Manufacturing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6">
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-pink-500/50">
            <CardHeader>
              <PackageOpen className="h-8 w-8 text-pink-400 mb-2" />
              <CardTitle className="font-mono text-lg">On-Demand Fulfillment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Whether a client orders 1 branded jacket or 1,000 logo mugs for an event, MetaWork routes the order to the most efficient print facility automatically. You never pay for storage.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-pink-500/50">
            <CardHeader>
              <Layers className="h-8 w-8 text-pink-400 mb-2" />
              <CardTitle className="font-mono text-lg">Private Aisles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Build dedicated, password-protected company stores (Aisles) for your enterprise clients. Employees can log in, select their sizes, and have items shipped directly to their homes.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-pink-500/50">
            <CardHeader>
              <Cog className="h-8 w-8 text-pink-400 mb-2" />
              <CardTitle className="font-mono text-lg">Margin Control</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Use our terminal dashboard to view live raw material costs and set precise markup parameters. As volume increases, costs dynamically adjust to maximize your profitability.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
          <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between">
            <div className="flex gap-2"><div className="h-3 w-3 rounded-full bg-red-500/20" /><div className="h-3 w-3 rounded-full bg-yellow-500/20" /></div>
            <span className="text-[10px] font-mono text-pink-400">/b2b/client-procurement</span>
          </div>
          <div className="p-8 font-mono text-sm space-y-4">
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>CORPORATE_AISLE:</span><span className="text-zinc-300">TECH_CORP_ANNUAL_SUMMIT</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>INVENTORY_HOLDING_COSTS:</span><span className="text-emerald-400">$0.00</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>UNITS_PROCESSED (YTD):</span><span className="text-pink-400">1,240</span>
            </div>
            <div className="mt-4 p-4 bg-pink-500/10 border border-pink-500/20 rounded text-xs text-zinc-400">
              <p className="text-pink-400 mb-2">ROUTING_LOG &gt;</p>
              <p>&gt; Event package ordered: 50x Mugs, 50x Polos.</p>
              <p>&gt; Production assigned to node: FACTORY_US_WEST.</p>
              <p>&gt; Shipping ETA: 4 Days. Margin locked.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}