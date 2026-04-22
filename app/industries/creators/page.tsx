import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, Palette, ArrowRight, ShieldCheck, Box, Activity, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function CreatorsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-purple-500/30">
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
            <Link href="/industries" className="hover:text-purple-400">INDUSTRIES</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-purple-400">CREATOR_ECONOMY_MODULE</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            Creator & Influencer IP. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-violet-500">The infinite supply chain.</span>
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8 max-w-2xl">
            Stop posting your art to social media for free. Mint your designs as secure IP assets, license them globally, and earn automated royalties every time your art moves physical merchandise across the network.
          </p>
          <div className="flex gap-4">
            <Link href="/register">
              <Button size="lg" className="h-12 px-8 bg-purple-600 hover:bg-purple-700 text-white rounded-none font-mono">
                <Terminal className="mr-2 h-4 w-4" /> Deploy IP Asset
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6">
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-purple-500/50">
            <CardHeader>
              <ShieldCheck className="h-8 w-8 text-purple-400 mb-2" />
              <CardTitle className="font-mono text-lg">Cryptographic Protection</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Your file is hashed to the decentralized IPFS network and minted as an NFT on Algorand. You establish absolute, indisputable proof of ownership over your pixels and ideas.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-purple-500/50">
            <CardHeader>
              <Box className="h-8 w-8 text-purple-400 mb-2" />
              <CardTitle className="font-mono text-lg">Zero Inventory Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                No more screen-printing in your garage. Product designers map your tokenized art onto blanks via MetaManufacturing. We handle production and global shipping. You just provide the IP.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-purple-500/50">
            <CardHeader>
              <Activity className="h-8 w-8 text-purple-400 mb-2" />
              <CardTitle className="font-mono text-lg">Algorithmic Royalties</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Set a flat fee or a percentage per use. When a consumer buys a product featuring your art anywhere on the network, the smart contract splits the payment and sends your cut instantly.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
          <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between">
             <div className="flex gap-2"><div className="h-3 w-3 rounded-full bg-red-500/20" /><div className="h-3 w-3 rounded-full bg-yellow-500/20" /></div>
            <span className="text-[10px] font-mono text-purple-400">/vault/ip-management</span>
          </div>
          <div className="p-8 font-mono text-sm space-y-4">
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>ASSET_HASH:</span><span className="text-zinc-300">QmYwAPJzv5CZsnA625s3X...</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>LICENSE_FEE_CONFIG:</span><span className="text-purple-400">$2.50 PER_SALE</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>ACTIVE_NETWORK_DEPLOYMENTS:</span><span className="text-zinc-300">47 PRODUCTS</span>
            </div>
            <div className="mt-4 text-xs text-zinc-400 space-y-1">
              <p className="text-purple-400 mb-2">SYSTEM_EVENT &gt; SALE EXECUTED</p>
              <p>&gt; Consumer purchased hoodie via "StreetWear_Aisle".</p>
              <p className="text-emerald-400">&gt; $2.50 IP royalty routed to Creator Wallet.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}