import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Terminal, ArrowLeft, Database, Network, Cpu, 
  ShieldCheck, Lock, Zap, Hash, Activity, Globe,
  Users, TrendingUp, Heart, Wallet, FileText,
  Palette, ShoppingCart
} from 'lucide-react';
import Link from 'next/link';

export default function ProtocolWhitepaperPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-amber-500/30 font-sans">
      
      {/* PERSISTENT PROTOCOL HEADER */}
      <div className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
          <Link href="/selling" className="text-sm font-mono text-zinc-400 hover:text-amber-400 flex items-center transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> BACK_TO_ENGINE
          </Link>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-zinc-500">
              <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald-500" /> QUANTUM_SAFE</span>
              <span className="flex items-center gap-1"><Database className="h-3 w-3 text-blue-500" /> IPFS_SYNCED</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono text-zinc-500">ALGORAND_MAINNET_v3.2</span>
            </div>
          </div>
        </div>
      </div>

      {/* HERO: THE UNIFIED VISION */}
      <section className="relative px-8 pt-24 pb-20 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs font-mono text-amber-400 uppercase tracking-widest mb-8">
            <Zap className="mr-2 h-3.5 w-3.5" /> Official Whitepaper & Protocol Specs
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1] mb-8">
            Unlocking Global <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Economic Opportunity.</span>
          </h1>
          
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-10">
            MetaWork is a blockchain-powered ecosystem designed to democratize wealth creation. By merging decentralized infrastructure with a user-centric social mission, we empower the unbanked, the creators, and the investors to earn, own, and manage assets securely.
          </p>
        </div>
      </section>

      {/* SECTION 1: THE GLOBAL PROBLEM (Social Context) */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Globe className="h-8 w-8 text-blue-400" /> The Barrier to Participation
              </h2>
              <div className="space-y-6 text-zinc-400 leading-relaxed italic border-l-2 border-zinc-800 pl-6">
                <p>
                  &quot;Over 1.7 billion adults globally remain unbanked as of 2023. Without access to banks, they cannot save, invest, or transact securely.&quot;
                </p>
                <p>
                  &quot;The average daily wage of workers in low-income countries is estimated at just $3.70 per day—far below the UN&apos;s poverty threshold of $6.85 per day.&quot;
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-none">
                <div className="text-3xl font-bold text-red-500 mb-2">40%</div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-tighter">Workers in extreme poverty</p>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-none">
                <div className="text-3xl font-bold text-red-500 mb-2">15.6%</div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-tighter">Global youth unemployment</p>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-none col-span-2">
                <div className="text-zinc-200 text-sm font-bold mb-2 uppercase font-mono tracking-widest">Future Projection</div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Based on current economic trends, the number of workers in low-income countries living in poverty is projected to grow to 43% by 2030.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: THE TECHNICAL BACKBONE (Architecture) */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 text-center">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Protocol Architecture</h2>
            <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">The Pillars of Cryptographic Trust</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-zinc-950 border border-zinc-800 p-8 hover:border-blue-500/30 transition-colors group">
              <div className="h-12 w-12 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Network className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-4">Immutable Ledger</h3>
              <p className="text-xs text-zinc-500 leading-relaxed mb-6">
                Every transaction, royalty split, and investment return is recorded on a tamper-proof ledger, allowing for independent verification by any user.
              </p>
              <div className="font-mono text-[9px] text-blue-400/60 uppercase">&gt; sys_integrity_check: pass</div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 p-8 hover:border-emerald-500/30 transition-colors group">
              <div className="h-12 w-12 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold mb-4">Quantum-Safe</h3>
              <p className="text-xs text-zinc-500 leading-relaxed mb-6">
                Utilizing Algorand&apos;s quantum-proof cryptographic algorithms to ensure long-term protection against emerging hacking technologies.
              </p>
              <div className="font-mono text-[9px] text-emerald-400/60 uppercase">&gt; crypt_alg: sha-512_q</div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 p-8 hover:border-amber-500/30 transition-colors group">
              <div className="h-12 w-12 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Cpu className="h-6 w-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold mb-4">Smart Contracts</h3>
              <p className="text-xs text-zinc-500 leading-relaxed mb-6">
                Self-executing TEAL scripts automate all payments, royalty distributions, and investor payouts, eliminating costly intermediaries.
              </p>
              <div className="font-mono text-[9px] text-amber-400/60 uppercase">&gt; teal_v8: active</div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 p-8 hover:border-purple-500/30 transition-colors group">
              <div className="h-12 w-12 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Database className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-4">IPFS Storage</h3>
              <p className="text-xs text-zinc-500 leading-relaxed mb-6">
                User-generated IP and product designs are hashed and pinned to the IPFS network, ensuring they remain secure and accessible only to authorized wallets.
              </p>
              <div className="font-mono text-[9px] text-purple-400/60 uppercase">&gt; p2p_cluster: connected</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: THE USER TRIAD (Social Synergy) */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-12">
            
            {/* Workers */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-blue-400" />
                <h4 className="text-2xl font-bold font-mono tracking-tight">WORKERS</h4>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Access global MetaJobs like sentiment surveys and in-game tasks without upfront costs. Earnings are paid directly into wallets, with gamified tracking to reward reliability.
              </p>
              <div className="bg-zinc-900/50 p-4 border-l-2 border-blue-500 font-mono text-[10px] text-zinc-500">
                &gt; GOAL: Cover tuition and basic needs through consistent, flexible crypto earnings.
              </div>
            </div>

            {/* Creators */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Palette className="h-6 w-6 text-purple-400" />
                <h4 className="text-2xl font-bold font-mono tracking-tight">CREATORS</h4>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Monetize IP through MetaManufacturing. Mint artwork as NFTs for licensing or design physical merchandise for global sale. Every sale triggers an automatic royalty split.
              </p>
              <div className="bg-zinc-900/50 p-4 border-l-2 border-purple-500 font-mono text-[10px] text-zinc-500">
                &gt; GOAL: Decouple income from labor by licensing pixels into the infinite supply chain.
              </div>
            </div>

            {/* Investors */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-emerald-400" />
                <h4 className="text-2xl font-bold font-mono tracking-tight">INVESTORS</h4>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Generate passive income via MetaFinance tools. Purchase fractional shares of tokenized revenue streams from small businesses, gaming rewards, or survey pools.
              </p>
              <div className="bg-zinc-900/50 p-4 border-l-2 border-emerald-500 font-mono text-[10px] text-zinc-500">
                &gt; GOAL: Support local businesses while earning a share of real-world profits.
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SYSTEM DIAGRAM: THE FLOW OF CAPITAL */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-2">The Flow of Capital</h2>
            <p className="text-zinc-500 font-mono text-sm">Visualizing the Automated Smart Contract Settlement</p>
          </div>

          <div className="border border-zinc-800 bg-zinc-950 p-10 rounded-md shadow-2xl relative">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
              
              <div className="flex flex-col items-center gap-3 w-32">
                <div className="h-16 w-16 rounded-full bg-zinc-900 border-2 border-amber-500/50 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-amber-500" />
                </div>
                <span className="text-[10px] font-mono text-zinc-400">CONSUMER_SALE</span>
              </div>

              <div className="h-px w-full md:w-24 bg-zinc-800 hidden md:block" />

              <div className="flex flex-col items-center gap-3">
                <div className="h-20 w-20 rounded bg-zinc-900 border-2 border-blue-500 flex items-center justify-center relative shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                  <Cpu className="h-8 w-8 text-blue-400" />
                  <div className="absolute -top-1 -right-1 h-3 w-3 bg-blue-500 rounded-full animate-ping" />
                </div>
                <span className="text-[10px] font-mono text-blue-400">SMART_CONTRACT</span>
              </div>

              <div className="h-px w-full md:w-24 bg-zinc-800 hidden md:block" />

              <div className="flex flex-col gap-4 w-48">
                <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500 bg-zinc-900 p-2 rounded border border-zinc-800">
                  <div className="h-2 w-2 rounded-full bg-purple-500" /> IP_OWNER (15%)
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500 bg-zinc-900 p-2 rounded border border-zinc-800">
                  <div className="h-2 w-2 rounded-full bg-blue-500" /> SELLER (65%)
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500 bg-zinc-900 p-2 rounded border border-zinc-800">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" /> INVESTORS (20%)
                </div>
              </div>

            </div>
            
            <div className="absolute inset-0 opacity-[0.03] overflow-hidden pointer-events-none font-mono text-[8px] leading-tight select-none">
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i}>01011010101010111100101010101010101010101011101010101101010101011110010101010101010101010101110101010</div>
              ))}
            </div>
          </div>
          
          <div className="mt-8 p-6 bg-amber-900/10 border border-amber-500/20 font-mono text-xs text-amber-200/70">
            <p className="flex items-start gap-3">
              <Zap className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                &quot;Blockchain micro-investments allow users to contribute as little as a fraction of a penny to tokenized revenue streams, making wealth generation accessible to all.&quot;
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA: JOIN THE REVOLUTION */}
      <section className="px-8 py-32 bg-zinc-950 relative overflow-hidden">
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center justify-center gap-2 mb-6">
            <Lock className="h-5 w-5 text-emerald-500" />
            <span className="font-mono text-emerald-500 tracking-widest text-sm">PROTOCOL_ESTABLISHED</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">
            Secure your financial future.
          </h2>
          
          <p className="text-zinc-400 text-lg mb-12 font-light max-w-xl mx-auto">
            The code is written. The ledger is live. Whether you are a worker in rural India, an artist in Nigeria, or an investor in Mississippi, the MetaWork protocol is your doorway to the global economy.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="h-14 px-10 text-lg bg-white text-black hover:bg-zinc-200 rounded-none font-bold shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                Initialize Workspace
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="h-14 px-10 text-lg border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-none font-mono">
                Connect Wallet
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}