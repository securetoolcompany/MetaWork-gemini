import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ArrowRight, Terminal, Network, PackageSearch, Activity, ShieldCheck, 
  Cpu, ArrowLeftRight, Layers, Store, BarChart3, Globe, Crosshair, 
  Zap, Lock, LineChart, Database
} from 'lucide-react';
import Link from 'next/link';

export default function WelcomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-blue-500/30">
      
      {/* HERO SECTION: The Terminal Hook */}
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-left space-y-8">
            <div className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs font-mono text-zinc-400 uppercase tracking-widest">
              <Terminal className="mr-2 h-3.5 w-3.5 text-blue-400" />
              MetaWork OS v2.0
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1]">
              Manage your business with our <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Web3 tools.</span>
            </h1>
            
            <p className="text-xl text-zinc-400 leading-relaxed max-w-xl font-light">
              A comprehensive command center for the decentralized economy. Consolidate your IP, automate your supply chain, and deploy capital from a single, high-performance dashboard.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link href="/login">
                <Button size="lg" className="h-14 px-8 text-lg w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-none border border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]">
                  Launch Terminal
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/showroom">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg w-full sm:w-auto border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-none font-mono">
                  Browse Network
                </Button>
              </Link>
            </div>
          </div>

          {/* Hero Dashboard Preview */}
          <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/80 p-2 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center gap-2 px-3 pb-2 mb-2 border-b border-zinc-800">
              <div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/50" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
              <div className="h-3 w-3 rounded-full bg-green-500/20 border border-green-500/50" />
              <span className="ml-2 text-xs font-mono text-zinc-500">metawork-dashboard-view</span>
            </div>
            <div className="relative aspect-video w-full overflow-hidden rounded-md bg-zinc-950 flex items-center justify-center border border-zinc-800/50">
              <img 
                src="https://res.cloudinary.com/dplnacuyy/image/upload/v1775738117/Operations_ndfrqb.png" 
                alt="MetaWork Dashboard Interface" 
                className="object-cover w-full h-full opacity-80"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CORE INFRASTRUCTURE (The 3 Pillars) */}
      <section className="px-8 py-24 bg-zinc-950">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 border-b border-zinc-800 pb-6 gap-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Core Infrastructure</h2>
              <p className="text-zinc-500 font-mono text-sm">System modules available in your command center.</p>
            </div>
            <div className="text-xs font-mono text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/20">
              STATUS: ALL SYSTEMS OPERATIONAL
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Tokenization */}
            <Card className="bg-zinc-900/40 border-zinc-800 hover:border-blue-500/50 transition-colors rounded-none flex flex-col">
              <CardHeader className="pb-4">
                <Network className="h-8 w-8 text-blue-400 mb-4" />
                <CardTitle className="text-xl font-mono uppercase tracking-wider">01. Tokenization</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                  Digitize your business. Convert intellectual property, real estate, and future business revenue into fractionalized digital assets on Algorand. Build complex stakeholder structures and distribute automated yield securely.
                </p>
                <div className="pt-4 border-t border-zinc-800/50 flex flex-col gap-2 font-mono text-xs text-zinc-500">
                  <span className="flex items-center gap-2"><Activity className="h-3 w-3 text-blue-500" /> Revenue Pools</span>
                  <span className="flex items-center gap-2"><ShieldCheck className="h-3 w-3 text-blue-500" /> IP Vaults</span>
                </div>
              </CardContent>
            </Card>

            {/* Product Creation & Supply Chain */}
            <Card className="bg-zinc-900/40 border-zinc-800 hover:border-purple-500/50 transition-colors rounded-none flex flex-col">
              <CardHeader className="pb-4">
                <PackageSearch className="h-8 w-8 text-purple-400 mb-4" />
                <CardTitle className="text-xl font-mono uppercase tracking-wider">02. Supply Chain</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                  End-to-end product creation and fulfillment. License tokenized IP, drag-and-drop designs onto blank merchandise, and deploy to your public Aisle. We handle the manufacturing and global shipping automatically.
                </p>
                <div className="pt-4 border-t border-zinc-800/50 flex flex-col gap-2 font-mono text-xs text-zinc-500">
                  <span className="flex items-center gap-2"><Activity className="h-3 w-3 text-purple-500" /> MetaManufacturing</span>
                  <span className="flex items-center gap-2"><ShieldCheck className="h-3 w-3 text-purple-500" /> Creator Aisles</span>
                </div>
              </CardContent>
            </Card>

            {/* Investment */}
            <Card className="bg-zinc-900/40 border-zinc-800 hover:border-emerald-500/50 transition-colors rounded-none flex flex-col">
              <CardHeader className="pb-4">
                <Cpu className="h-8 w-8 text-emerald-400 mb-4" />
                <CardTitle className="text-xl font-mono uppercase tracking-wider">03. Investment</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                  Put your capital to work. Access instant decentralized swaps and protocol staking directly from your dashboard. Leverage our innovative 'Revenue Pool' architecture to invest in real-world yielding assets.
                </p>
                <div className="pt-4 border-t border-zinc-800/50 flex flex-col gap-2 font-mono text-xs text-zinc-500">
                  <span className="flex items-center gap-2"><Activity className="h-3 w-3 text-emerald-500" /> Token Swaps</span>
                  <span className="flex items-center gap-2"><ShieldCheck className="h-3 w-3 text-emerald-500" /> Staking & Yield</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* DATA FEEDS SECTION */}
      <section className="px-8 py-24 bg-zinc-900/30 border-y border-zinc-800">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Data-Driven Decision Making</h2>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Stop guessing. The MetaWork OS pipes real-world macroeconomic data, commodity pricing, and on-chain analytics directly into your dashboard, enabling you to manage your business with institutional foresight.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Tokenization Data Feed */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <Globe className="h-6 w-6 text-blue-400" />
                <h3 className="text-xl font-semibold">Macro Indicators</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6 h-20">
                Determine the perfect moment to tokenize your Real-World Assets. Our dashboard feeds track global liquidity, regional real estate yield averages, and Web3 market sentiment to help you price your tokens perfectly.
              </p>
              <div className="border border-zinc-800 bg-zinc-950 p-4 rounded-sm font-mono text-xs space-y-3 shadow-inner">
                <div className="text-zinc-600 mb-2">LIVE_FEED &gt; TOKENIZATION_METRICS</div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">GLOBAL_LIQUIDITY_IDX</span>
                  <span className="text-emerald-400">+2.4% (Uptrend)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">RWA_AVG_YIELD_US</span>
                  <span className="text-zinc-300">8.2% APY</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">ALGO_NETWORK_FEE</span>
                  <span className="text-blue-400">0.001 ALGO</span>
                </div>
              </div>
            </div>

            {/* Supply Chain Data Feed */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="h-6 w-6 text-purple-400" />
                <h3 className="text-xl font-semibold">Commodity Trackers</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6 h-20">
                Run your merchandise empire efficiently. Get up-to-date data on raw materials like cotton and crude oil (shipping costs). Use these indicators to dynamically adjust product pricing and protect your profit margins.
              </p>
              <div className="border border-zinc-800 bg-zinc-950 p-4 rounded-sm font-mono text-xs space-y-3 shadow-inner">
                <div className="text-zinc-600 mb-2">LIVE_FEED &gt; COMMODITY_INDEX</div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">CRUDE_OIL (WTI)</span>
                  <span className="text-emerald-400">$78.45/bbl </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">COTTON_FUTURES</span>
                  <span className="text-red-400">71.20c/lb </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">FREIGHTOS_BALTIC</span>
                  <span className="text-zinc-300">$1,422 / FEU</span>
                </div>
              </div>
            </div>

            {/* Investment Data Feed */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <Crosshair className="h-6 w-6 text-emerald-400" />
                <h3 className="text-xl font-semibold">Investment Analytics</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6 h-20">
                Deploy capital strategically. The terminal aggregates risk-adjusted returns, real-time staking yields, and performance matrices across all active Revenue Pools on the network.
              </p>
              <div className="border border-zinc-800 bg-zinc-950 p-4 rounded-sm font-mono text-xs space-y-3 shadow-inner">
                <div className="text-zinc-600 mb-2">LIVE_FEED &gt; YIELD_AGGREGATOR</div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">AVG_POOL_RETURN</span>
                  <span className="text-emerald-400">12.4% APY</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">STAKING_RETI_YIELD</span>
                  <span className="text-emerald-400">5.5% APY</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">ACTIVE_POOLS</span>
                  <span className="text-zinc-300">1,204</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* DASHBOARD DEEP DIVE (Visual Proof / Terminal Replacement) */}
      <section className="px-8 py-24 bg-zinc-950">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Side: Mock Terminal & Network Diagram instead of images */}
          <div className="space-y-6">
            {/* Terminal Window Mockup */}
            <div className="rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)]">
              <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/50" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                <div className="h-3 w-3 rounded-full bg-green-500/20 border border-green-500/50" />
                <span className="ml-2 text-xs font-mono text-zinc-500">system_kernel_log</span>
              </div>
              <div className="p-5 font-mono text-[10px] sm:text-xs text-emerald-500/70 space-y-2 h-48 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950 z-10" />
                <p>&gt; initializing routing protocol...</p>
                <p>&gt; connecting to algorand mainnet... <span className="text-zinc-300">[OK]</span></p>
                <p>&gt; fetching current block height: 35,892,101</p>
                <p>&gt; loading smart contract ABIs...</p>
                <p>&gt; validating revenue pool signatures...</p>
                <p className="text-blue-400">&gt; IPFS daemon running securely. 14,021 assets online.</p>
                <p>&gt; waiting for incoming network transactions...</p>
                <p>&gt; parsing decentralized identities...</p>
                <p>&gt; deploying dynamic royalty split module...</p>
                <p className="animate-pulse">&gt; _</p>
              </div>
            </div>

            {/* Architecture Node Mockup */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-zinc-800 bg-zinc-900/30 p-4 rounded-md flex flex-col items-center justify-center text-center gap-2 shadow-inner">
                <Database className="h-6 w-6 text-indigo-400 mb-1" />
                <span className="font-mono text-xs text-zinc-300">Encrypted IPFS Storage</span>
                <span className="text-[10px] text-zinc-500">Distributed & Immutable</span>
              </div>
              <div className="border border-zinc-800 bg-zinc-900/30 p-4 rounded-md flex flex-col items-center justify-center text-center gap-2 shadow-inner">
                <Network className="h-6 w-6 text-blue-400 mb-1" />
                <span className="font-mono text-xs text-zinc-300">Algorand Consensus</span>
                <span className="text-[10px] text-zinc-500">Sub-second Finality</span>
              </div>
            </div>
          </div>

          {/* Right Side: Features */}
          <div>
            <h3 className="text-3xl font-bold tracking-tight mb-8">Unprecedented operational control.</h3>
            
            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="flex-shrink-0 h-10 w-10 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Layers className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-zinc-200 mb-1">Unified Asset Management</h4>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    View your intellectual property, physical product inventory, and digital tokens in one centralized interface. Track real-time sales and automated royalty distributions.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 h-10 w-10 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <Store className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-zinc-200 mb-1">Aisle Customization</h4>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Configure your public-facing storefront directly from the terminal. Adjust pricing, curate collections, and manage product visibility with immediate on-chain execution.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 h-10 w-10 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <ArrowLeftRight className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-zinc-200 mb-1">Algorithmic Revenue Routing</h4>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Our smart contract architecture ensures that every time a product sells, the revenue is instantly and accurately split between the product creator, the IP owner, and the platform.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10">
               <Link href="/login">
                <Button className="rounded-none border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-sm px-6">
                  Initialize Your Dashboard <Terminal className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* THE METAWORK ADVANTAGE */}
      <section className="px-8 py-24 bg-blue-900/5 border-t border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">The MetaWork Advantage</h2>
            <p className="text-zinc-400">Why running your business on Web2 is costing you time, money, and ownership.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 rounded-lg overflow-hidden">
            
            {/* The Old Way */}
            <div className="bg-zinc-950 p-10">
              <h3 className="text-xl font-bold text-red-400 mb-8 flex items-center gap-2">
                <LineChart className="h-5 w-5 rotate-180" /> Traditional Web2 Systems
              </h3>
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-500 text-xs">✕</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-300">Fragmented Software</h4>
                    <p className="text-xs text-zinc-500 mt-1">You pay for separate e-commerce, banking, supply chain, and legal software.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-500 text-xs">✕</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-300">Delayed Capital</h4>
                    <p className="text-xs text-zinc-500 mt-1">Banks hold your funds for 3-5 days. Gatekeepers charge high transaction fees.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-500 text-xs">✕</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-300">Blind Operations</h4>
                    <p className="text-xs text-zinc-500 mt-1">No real-time macro indicators. You guess on pricing without seeing live commodity costs.</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* The MetaWork Way */}
            <div className="bg-zinc-900/80 p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full" />
              <h3 className="text-xl font-bold text-blue-400 mb-8 flex items-center gap-2 relative z-10">
                <Zap className="h-5 w-5" /> MetaWork OS
              </h3>
              <ul className="space-y-6 relative z-10">
                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-400 text-xs">✓</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Unified Terminal</h4>
                    <p className="text-xs text-blue-200/70 mt-1">Manage IP licensing, automated supply chains, and storefronts in one login.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-400 text-xs">✓</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Instant Settlement</h4>
                    <p className="text-xs text-blue-200/70 mt-1">Smart contracts route revenue directly to your wallet in milliseconds. Zero banks.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-400 text-xs">✓</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Data-Driven Decisions</h4>
                    <p className="text-xs text-blue-200/70 mt-1">Live data pipelines for commodities, global liquidity, and yield analytics.</p>
                  </div>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section className="py-20 border-t border-zinc-800 bg-zinc-950 text-center">
        <h2 className="text-3xl font-bold mb-6">Take Control of Your Economy.</h2>
        <p className="text-zinc-400 mb-10 max-w-xl mx-auto">
          Join thousands of creators, businesses, and investors who are already leveraging the MetaWork Operating System.
        </p>
        <Link href="/login">
          <Button size="lg" className="h-14 px-10 text-lg bg-white text-black hover:bg-zinc-200 rounded-none font-bold tracking-wide transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            <Lock className="mr-2 h-5 w-5" /> Create Free Account
          </Button>
        </Link>
      </section>

    </div>
  );
}