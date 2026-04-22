import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, Dumbbell, ArrowRight, ShieldCheck, Activity, Users, LineChart, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function GymsFitnessPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-rose-500/30">
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-rose-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
            <Link href="/industries" className="hover:text-rose-400">INDUSTRIES</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-rose-400">GYMS_AND_FITNESS</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            Gym & Fitness Monetization. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-red-600">Zero inventory required.</span>
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8 max-w-2xl">
            Launch premium, limited-edition apparel for your gym without buying a single box of t-shirts upfront. Tokenize membership perks and let your most loyal athletes literally own a piece of the brand.
          </p>
          <div className="flex gap-4">
            <Link href="/register">
              <Button size="lg" className="h-12 px-8 bg-rose-600 hover:bg-rose-700 text-white rounded-none font-mono">
                <Terminal className="mr-2 h-4 w-4" /> Initialize Gym Aisle
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6">
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-rose-500/50">
            <CardHeader>
              <Dumbbell className="h-8 w-8 text-rose-400 mb-2" />
              <CardTitle className="font-mono text-lg">On-Demand Gear</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Design custom rash guards, hoodies, and shaker bottles. When a member orders from your MetaWork Aisle, we manufacture and ship it directly to them. No upfront costs or leftover sizes.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-rose-500/50">
            <CardHeader>
              <Users className="h-8 w-8 text-rose-400 mb-2" />
              <CardTitle className="font-mono text-lg">Tokenized Memberships</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Turn members into investors. Tokenize a percentage of your gym's merch revenue. Members who buy the token earn automated micro-yields every time someone buys a shirt.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-rose-500/50">
            <CardHeader>
              <ShieldCheck className="h-8 w-8 text-rose-400 mb-2" />
              <CardTitle className="font-mono text-lg">IP Protection</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Mint your gym's logo and branding on the blockchain. If another designer on the network uses your logo on their product, the smart contract automatically routes the royalty fee to your wallet.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
          <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between">
            <div className="flex gap-2"><div className="h-3 w-3 rounded-full bg-red-500/20" /><div className="h-3 w-3 rounded-full bg-yellow-500/20" /></div>
            <span className="text-[10px] font-mono text-rose-400">/gym-dashboard/live-telemetry</span>
          </div>
          <div className="p-8 font-mono text-sm space-y-4">
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>ACTIVE_MERCH_AISLE:</span><span className="text-zinc-300">ALPHA_BJJ_GEAR</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>MONTHLY_FULFILLMENT_COSTS:</span><span className="text-emerald-400">$0.00 (ON_DEMAND)</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>TOKENIZED_MEMBER_WALLETS:</span><span className="text-rose-400">142 ACTIVE</span>
            </div>
            <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded">
              <span className="text-rose-400 text-xs block mb-2">SYSTEM_LOG &gt;</span>
              <p className="text-zinc-400 text-xs">&gt; Order received: "Alpha Competitor Hoodie" (Size L)</p>
              <p className="text-zinc-400 text-xs">&gt; MetaManufacturing production initiated.</p>
              <p className="text-emerald-400 text-xs">&gt; $14.50 profit routed to Gym Wallet instantly.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}