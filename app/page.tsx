import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Terminal, Network, PackageSearch, Activity, ShieldCheck, Cpu, ArrowLeftRight, Layers } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Store } from 'lucide-react';

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

          {/* Hero Dashboard Preview (Use your primary dashboard screenshot here) */}
          <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/80 p-2 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center gap-2 px-3 pb-2 mb-2 border-b border-zinc-800">
              <div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/50" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
              <div className="h-3 w-3 rounded-full bg-green-500/20 border border-green-500/50" />
              <span className="ml-2 text-xs font-mono text-zinc-500">metawork-dashboard-view</span>
            </div>
            <div className="relative aspect-video w-full overflow-hidden rounded-md bg-zinc-950 flex items-center justify-center border border-zinc-800/50">
              {/* Replace src with your Cloudinary URL for image_906001.png */}
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
            <div className="text-xs font-mono text-zinc-500 bg-zinc-900 px-3 py-1 rounded border border-zinc-800">
              STATUS: ALL SYSTEMS OPERATIONAL
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Tokenization */}
            <Card className="bg-zinc-900/40 border-zinc-800 hover:border-blue-500/50 transition-colors rounded-none">
              <CardHeader className="pb-4">
                <Network className="h-8 w-8 text-blue-400 mb-4" />
                <CardTitle className="text-xl font-mono uppercase tracking-wider">01. Tokenization</CardTitle>
              </CardHeader>
              <CardContent>
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
            <Card className="bg-zinc-900/40 border-zinc-800 hover:border-purple-500/50 transition-colors rounded-none">
              <CardHeader className="pb-4">
                <PackageSearch className="h-8 w-8 text-purple-400 mb-4" />
                <CardTitle className="text-xl font-mono uppercase tracking-wider">02. Supply Chain</CardTitle>
              </CardHeader>
              <CardContent>
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
            <Card className="bg-zinc-900/40 border-zinc-800 hover:border-emerald-500/50 transition-colors rounded-none">
              <CardHeader className="pb-4">
                <Cpu className="h-8 w-8 text-emerald-400 mb-4" />
                <CardTitle className="text-xl font-mono uppercase tracking-wider">03. Investment</CardTitle>
              </CardHeader>
              <CardContent>
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

      {/* DASHBOARD DEEP DIVE (The Visual Proof) */}
      <section className="px-8 py-24 bg-zinc-900/20 border-y border-zinc-800">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Side: Images */}
          <div className="space-y-6">
             {/* Secondary Dashboard Preview (Aisle/Storefront config) */}
            <div className="rounded border border-zinc-800 bg-zinc-950 p-1 shadow-xl transform hover:-translate-y-1 transition-transform">
               {/* Replace src with your Cloudinary URL for image_905cbb.png */}
              <img 
                src="https://via.placeholder.com/600x300/09090b/3f3f46?text=Drop+Aisle+Config+Screenshot+Here" 
                alt="Aisle Configuration" 
                className="object-cover w-full h-auto opacity-70 hover:opacity-100 transition-opacity"
              />
            </div>
            {/* Tertiary Dashboard Preview (Revenue Pool/Vault) */}
            <div className="rounded border border-zinc-800 bg-zinc-950 p-1 shadow-xl ml-8 transform hover:-translate-y-1 transition-transform">
               {/* Replace src with your Cloudinary URL for image_9060b2.png */}
              <img 
                src="https://via.placeholder.com/600x300/09090b/3f3f46?text=Drop+Revenue+Pool+Screenshot+Here" 
                alt="Revenue Pool Management" 
                className="object-cover w-full h-auto opacity-70 hover:opacity-100 transition-opacity"
              />
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

    </div>
  );
}