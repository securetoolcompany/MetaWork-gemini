import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, HeartHandshake, ArrowRight, BookOpenCheck, Coins, Package, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function NonProfitsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-amber-500/30">
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
            <Link href="/industries" className="hover:text-amber-400">INDUSTRIES</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-amber-400">CHARITY_AND_NGO_MODULE</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            Non-Profit & Charity Fundraising. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-500">Transparent, immutable trust.</span>
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8 max-w-2xl">
            Donors want to know exactly where their money goes. MetaWork uses the Algorand blockchain to create 100% transparent fundraising pools, while enabling charities to sell awareness merchandise with zero overhead.
          </p>
          <div className="flex gap-4">
            <Link href="/register">
              <Button size="lg" className="h-12 px-8 bg-amber-600 hover:bg-amber-700 text-white rounded-none font-mono border-amber-500">
                <Terminal className="mr-2 h-4 w-4" /> Open Charity Vault
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6">
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-amber-500/50">
            <CardHeader>
              <BookOpenCheck className="h-8 w-8 text-amber-400 mb-2" />
              <CardTitle className="font-mono text-lg">Cryptographic Ledgers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Every dollar raised via tokenization is recorded on a public blockchain explorer. You can definitively prove to donors exactly how much was raised and where capital was deployed.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-amber-500/50">
            <CardHeader>
              <Package className="h-8 w-8 text-amber-400 mb-2" />
              <CardTitle className="font-mono text-lg">Zero-Risk Swag</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Charities shouldn't waste budgets on boxes of unsold t-shirts. Build a public Aisle selling awareness merch. When supporters buy, the item is produced on-demand, and profits route directly to the cause.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-amber-500/50">
            <CardHeader>
              <Coins className="h-8 w-8 text-amber-400 mb-2" />
              <CardTitle className="font-mono text-lg">Automated Split Yields</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Partner with creators. An artist can upload their IP, sell it on products, and use our smart contracts to automatically route 50% of the profits to your charity—instantly and trustlessly.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
          <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between">
            <div className="flex gap-2"><div className="h-3 w-3 rounded-full bg-red-500/20" /><div className="h-3 w-3 rounded-full bg-yellow-500/20" /></div>
            <span className="text-[10px] font-mono text-amber-400">/ngo/transparent-ledger</span>
          </div>
          <div className="p-8 font-mono text-sm space-y-4">
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>ACTIVE_CAMPAIGN:</span><span className="text-zinc-300">CLEAN_WATER_INITIATIVE</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>FUNDS_RAISED (MERCH):</span><span className="text-emerald-400">$12,450.00</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>FUNDS_RAISED (TOKEN_POOL):</span><span className="text-emerald-400">$8,200.00</span>
            </div>
            <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-zinc-400">
              <p className="text-amber-400 mb-2">BLOCKCHAIN_LEDGER_SYNC &gt;</p>
              <p>&gt; TX_HASH: 0x992A...F11 &gt; $45.00 from "Save Oceans Hoodie".</p>
              <p>&gt; TX_HASH: 0x4B12...C90 &gt; $20.00 from Direct Pool Donation.</p>
              <p className="text-zinc-300">&gt; All transactions cryptographically verified and immutable.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}