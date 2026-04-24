import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, Gift, ArrowRight, PackageOpen, Layers, Cog, ChevronRight, Target, CheckCircle2, Briefcase, Handshake, MonitorSmartphone } from 'lucide-react';
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
            <Link href="/login">
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

      {/* ROBUST DEPLOYMENT TRACKS */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Enterprise Deployment Tracks</h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
              Scalable solutions for promotional agencies and B2B merch providers handling complex corporate accounts.
            </p>
          </div>

          <div className="space-y-12">
            {/* TRACK 1 */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-pink-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Briefcase className="w-48 h-48" /></div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-pink-500/10 px-2 py-1 text-xs font-mono text-pink-400 mb-4 border border-pink-500/20">TRACK_01: INTERNAL_HR</div>
                  <h3 className="text-2xl font-bold mb-4">Employee Onboarding Kits</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">Stop making HR guess hoodie sizes. Create a private Aisle where new hires input their own details and order their welcome kit on-demand, directly to their remote location.</p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><Target className="mr-2 h-4 w-4 text-pink-400" /> B2B Goals</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-pink-400 mr-2">-</span> Eliminate HR administrative bottlenecks.</li>
                      <li className="flex items-start"><span className="text-pink-400 mr-2">-</span> Reduce wasted spending on wrong sizes.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Whitelabeled, password-protected Aisles.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Pre-paid corporate budgeting / voucher systems.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 2 */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-pink-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><MonitorSmartphone className="w-48 h-48" /></div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-pink-500/10 px-2 py-1 text-xs font-mono text-pink-400 mb-4 border border-pink-500/20">TRACK_02: EVENT_SWAG</div>
                  <h3 className="text-2xl font-bold mb-4">Trade Show Merchandising</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">Instead of hauling 500 heavy bags to an expo, display QR codes at your client's booth. Attendees scan, pick their size, and the item ships home while the client captures the lead data.</p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><Target className="mr-2 h-4 w-4 text-pink-400" /> B2B Goals</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-pink-400 mr-2">-</span> Remove freight and logistics costs for events.</li>
                      <li className="flex items-start"><span className="text-pink-400 mr-2">-</span> Combine physical swag with digital lead generation.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> QR-code powered rapid checkout flow.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Customer data export tools for CRM integration.</li>
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