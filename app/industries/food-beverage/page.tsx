import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, Coffee, ArrowRight, Pizza, Store, Users, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function FoodBeveragePage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-emerald-500/30">
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
            <Link href="/industries" className="hover:text-emerald-400">INDUSTRIES</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-emerald-400">HOSPITALITY_AND_FOOD</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            Food & Beverage Crowdfunding. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Reward your regulars.</span>
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8 max-w-2xl">
            Want to open a cafe or pizzeria? Bypass massive bank loans. Tokenize your future revenue and let your local community fund your build-out. They become highly motivated customers who get paid when you succeed.
          </p>
          <div className="flex gap-4">
            <Link href="/register">
              <Button size="lg" className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none font-mono">
                <Terminal className="mr-2 h-4 w-4" /> Initialize Revenue Pool
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6">
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-emerald-500/50">
            <CardHeader>
              <Pizza className="h-8 w-8 text-emerald-400 mb-2" />
              <CardTitle className="font-mono text-lg">Zero-Debt Capital</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Tokenize 15% of your future storefront's revenue pool. Locals buy the tokens, providing you the cash needed to buy equipment and secure a lease—without predatory interest rates.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-emerald-500/50">
            <CardHeader>
              <Users className="h-8 w-8 text-emerald-400 mb-2" />
              <CardTitle className="font-mono text-lg">Hyper-Loyal Patrons</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Your investors are your neighbors. They will buy their coffee from you instead of Starbucks, because every time the register rings, their tokenized wallet earns a micro-yield.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-emerald-500/50">
            <CardHeader>
              <Store className="h-8 w-8 text-emerald-400 mb-2" />
              <CardTitle className="font-mono text-lg">On-Demand Merch</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Launch a line of branded t-shirts, mugs, and aprons using MetaManufacturing. Sell them through your website or via QR codes on your tables. Zero boxes in the back room.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
          <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between">
            <div className="flex gap-2"><div className="h-3 w-3 rounded-full bg-red-500/20" /><div className="h-3 w-3 rounded-full bg-yellow-500/20" /></div>
            <span className="text-[10px] font-mono text-emerald-400">/pos-integration/yield-distribution</span>
          </div>
          <div className="p-8 font-mono text-sm space-y-4">
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>POINT_OF_SALE_SYNC:</span><span className="text-emerald-400">CONNECTED (STRIPE)</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>DAILY_GROSS_REVENUE:</span><span className="text-zinc-300">$2,450.50</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>AUTOMATED_TOKEN_YIELD (15%):</span><span className="text-emerald-400">$367.57</span>
            </div>
            <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded">
              <p className="text-zinc-400 text-xs">&gt;&gt; Smart contract executing distribution to 142 local investor wallets.</p>
              <p className="text-emerald-400 text-xs font-bold mt-2">&gt;&gt; SETTLEMENT COMPLETE.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}