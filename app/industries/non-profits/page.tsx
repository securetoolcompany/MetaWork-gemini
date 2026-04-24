import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, HeartHandshake, ArrowRight, BookOpenCheck, Coins, Package, ChevronRight, Target, CheckCircle2, Globe, Building } from 'lucide-react';
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
            Non-Profit Fundraising. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-500">Transparent, immutable trust.</span>
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8 max-w-2xl">
            Donors want to know exactly where their money goes. MetaWork uses the Algorand blockchain to create 100% transparent fundraising pools, while enabling charities to sell awareness merchandise with zero overhead.
          </p>
          <div className="flex gap-4">
            <Link href="/login">
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

      {/* ROBUST DEPLOYMENT TRACKS */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">NGO Deployment Tracks</h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
              Designed to restore trust to philanthropic giving, whether you are a local community fund or a massive international enterprise organization.
            </p>
          </div>

          <div className="space-y-12">
            {/* TRACK 1 */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-amber-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Building className="w-48 h-48" /></div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-amber-500/10 px-2 py-1 text-xs font-mono text-amber-400 mb-4 border border-amber-500/20">TRACK_01: ENTERPRISE_NGO</div>
                  <h3 className="text-2xl font-bold mb-4">Large-Scale Philanthropy</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">Ideal for massive organizations (like Goodwill). Create dedicated digital storefronts where proceeds from specific product lines automatically fund decentralized vocational training, entrepreneurship programs, or community grants.</p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><Target className="mr-2 h-4 w-4 text-amber-400" /> Organizational Goals</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Scale merchandising without warehouse overhead.</li>
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Transparently prove where funds are routed.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Enterprise-grade Aisle (storefront) generation.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Multi-wallet smart contract distribution logic.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 2 */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-amber-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Globe className="w-48 h-48" /></div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-amber-500/10 px-2 py-1 text-xs font-mono text-amber-400 mb-4 border border-amber-500/20">TRACK_02: CRISIS_RELIEF</div>
                  <h3 className="text-2xl font-bold mb-4">Disaster Relief Funds</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">When disaster strikes, deploy a relief fund in 5 minutes. Tokenize the fund so donors receive an NFT receipt of their contribution. The blockchain guarantees every cent is accounted for and routed directly to the impact zone.</p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><Target className="mr-2 h-4 w-4 text-amber-400" /> Organizational Goals</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Immediate global liquidity access.</li>
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Absolute trust and transparency in crisis.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Rapid Revenue Pool deployment.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Cryptographic "Proof of Donation" badges.</li>
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
            <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-zinc-400 pt-4">
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