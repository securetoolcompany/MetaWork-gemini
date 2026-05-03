import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Palette, Box, CheckCircle2, Truck, Wallet, Terminal, 
  ArrowRight, Layers, Globe, Cpu, Cog, Printer, Shirt,
  Image as ImageIcon, Hexagon, Target
} from 'lucide-react';
import Link from 'next/link';

export default function ProductProcess() {
  const steps = [
    { 
      id: "01_INGESTION",
      icon: <Palette className="h-6 w-6 text-purple-400" />, 
      title: "Start with IP", 
      desc: "Upload artwork or 3D files to the decentralized vault. Once approved, the IP is minted as a secure NFT and ready for network licensing.",
      log: "ASSET_HASH_VERIFIED"
    },
    { 
      id: "02_CONFIGURATION",
      icon: <Box className="h-6 w-6 text-blue-400" />, 
      title: "Design Products", 
      desc: "Open the MetaManufacturing engine. Route your IP through either the 2D surface applicator or the 3D slicer to generate physical mockups.",
      log: "RENDERING_PROTOTYPES"
    },
    { 
      id: "03_DEPLOYMENT",
      icon: <CheckCircle2 className="h-6 w-6 text-emerald-400" />, 
      title: "Review & Publish", 
      desc: "Set your retail margins and hit deploy. Approved products instantly appear in your personal storefront (Aisle) and the global MetaShop.",
      log: "CATALOG_SYNC_COMPLETE"
    },
    { 
      id: "04_ROUTING",
      icon: <Truck className="h-6 w-6 text-amber-400" />, 
      title: "Algorithmic Fulfillment", 
      desc: "When an order hits, the system routes it to the nearest global print or fabrication facility. We manufacture locally and ship globally.",
      log: "DISPATCHED_TO_NODE: EU_WEST"
    },
    { 
      id: "05_SETTLEMENT",
      icon: <Wallet className="h-6 w-6 text-green-400" />, 
      title: "Automated Earnings", 
      desc: "Upon sale, smart contracts instantly split the revenue. The product designer, the original IP owner, and the platform all get paid in milliseconds.",
      log: "TX_EXECUTED_ON_ALGORAND"
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-purple-500/30">
      
      {/* HERO SECTION */}
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs font-mono text-purple-400 uppercase tracking-widest mb-8">
            <Terminal className="mr-2 h-3.5 w-3.5" />
            MetaManufacturing Engine
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            Deploy physical goods. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">Zero supply chain risk.</span>
          </h1>
          
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8 max-w-2xl">
            From raw idea to globally fulfilled product in minutes. Design apparel, gear, and custom 3D-fabricated objects using our web-based terminal, and let our decentralized network handle the execution.
          </p>
          
          <div className="flex gap-4">
            <Link href="/catalog">
              <Button size="lg" className="h-12 px-8 bg-purple-600 hover:bg-purple-700 text-white rounded-none border border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                Initialize Product Line
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CORE INFRASTRUCTURE GRID */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6">
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-purple-500/50">
            <CardHeader>
              <Layers className="h-8 w-8 text-purple-400 mb-2" />
              <CardTitle className="font-mono text-lg">Web-Based Canvas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                No design software needed. Use our browser-based editor to map 2D artwork onto apparel, or slice 3D models for physical fabrication, all with real-time mockup generation.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-blue-500/50">
            <CardHeader>
              <Globe className="h-8 w-8 text-blue-400 mb-2" />
              <CardTitle className="font-mono text-lg">Global Node Routing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                We plug directly into an international network of manufacturing facilities. Orders are algorithmically routed to the node closest to the buyer, slashing shipping times and carbon footprints.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-emerald-500/50">
            <CardHeader>
              <Cpu className="h-8 w-8 text-emerald-400 mb-2" />
              <CardTitle className="font-mono text-lg">Smart Split Contracts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Build products using IP from other creators. The pricing engine automatically calculates the base cost, your markup, and the IP owner's royalty. Settlement is instant on Algorand.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* NEW SECTION: DUAL-TRACK MANUFACTURING */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Dual-Track Manufacturing Protocols</h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
              MetaWork bridges the gap between digital IP and physical goods through two distinct production pipelines. Whether applying a 2D design to an existing blank or fabricating a completely original 3D object, the network executes on demand.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            
            {/* Track 1: 2D Print on Demand */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-purple-500/50 transition-all group relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Shirt className="w-48 h-48 text-purple-400" />
              </div>
              <div className="relative z-10 flex-1 flex flex-col">
                <div className="inline-flex items-center rounded bg-purple-500/10 px-2 py-1 text-xs font-mono text-purple-400 mb-6 border border-purple-500/20 self-start">
                  PROTOCOL_01: 2D_SURFACE_APPLICATION
                </div>
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-3">
                  <ImageIcon className="h-6 w-6 text-purple-400" /> Standard Print-on-Demand
                </h3>
                <p className="text-zinc-400 leading-relaxed mb-8 text-sm">
                  The engine for branded merchandise and apparel. Take 2D digital assets (vectors, illustrations, logos) and map them onto high-quality, pre-existing physical blanks. 
                </p>
                
                <div className="grid sm:grid-cols-2 gap-6 mt-auto">
                  <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-sm">
                    <h4 className="text-xs font-bold font-mono text-zinc-300 mb-2 flex items-center gap-2">
                      <Cog className="h-3 w-3 text-purple-400" /> THE MECHANICS
                    </h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Select from a catalog of 500+ items (t-shirts, hoodies, mugs, stickers). Drag your minted IP onto the digital mockup, adjust placement, and publish. The network handles the DTG (Direct-to-Garment) or sublimation printing.
                    </p>
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-sm">
                    <h4 className="text-xs font-bold font-mono text-zinc-300 mb-2 flex items-center gap-2">
                      <Target className="h-3 w-3 text-emerald-400" /> MONETIZATION
                    </h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Capitalize on fast-cycle trends instantly. Launch a streetwear brand, event swag, or corporate promotional gear with zero minimum order quantities and zero inventory risk.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Track 2: 3D Additive Manufacturing */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-blue-500/50 transition-all group relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Printer className="w-48 h-48 text-blue-400" />
              </div>
              <div className="relative z-10 flex-1 flex flex-col">
                <div className="inline-flex items-center rounded bg-blue-500/10 px-2 py-1 text-xs font-mono text-blue-400 mb-6 border border-blue-500/20 self-start">
                  PROTOCOL_02: 3D_ADDITIVE_FABRICATION
                </div>
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-3">
                  <Hexagon className="h-6 w-6 text-blue-400" /> Custom 3D Fabrication
                </h3>
                <p className="text-zinc-400 leading-relaxed mb-8 text-sm">
                  The engine for physical product origination. Bring entirely novel, never-before-seen objects into the physical world by printing custom geometry on demand.
                </p>
                
                <div className="grid sm:grid-cols-2 gap-6 mt-auto">
                  <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-sm">
                    <h4 className="text-xs font-bold font-mono text-zinc-300 mb-2 flex items-center gap-2">
                      <Cog className="h-3 w-3 text-blue-400" /> THE MECHANICS
                    </h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Upload your 3D mesh files (STL/OBJ). MetaManufacturing processes the geometry, calculates material cost, and routes the order to specialized FDM (Fused Deposition Modeling) or high-detail Resin printing nodes.
                    </p>
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-sm">
                    <h4 className="text-xs font-bold font-mono text-zinc-300 mb-2 flex items-center gap-2">
                      <Target className="h-3 w-3 text-emerald-400" /> MONETIZATION
                    </h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Dominate niche markets. Fabricate custom tabletop gaming miniatures, bespoke hardware accessories, or prototype parts, selling directly to consumers without ever investing in injection molding.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* THE PIPELINE (Vertical Steps) */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">The MetaManufacturing Pipeline</h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-2xl">
              A streamlined, high-performance workflow designed to turn your IP into physical reality with zero friction.
            </p>
          </div>

          <div className="relative">
            {/* Connecting Vertical Line */}
            <div className="absolute left-[31px] top-8 bottom-8 w-px bg-zinc-800 hidden md:block" />
            
            <div className="space-y-12">
              {steps.map((step, idx) => (
                <div key={idx} className="relative flex flex-col md:flex-row gap-8 items-start group">
                  {/* Icon Node */}
                  <div className="h-16 w-16 rounded bg-zinc-950 border border-zinc-700 flex items-center justify-center shrink-0 z-10 shadow-[0_0_15px_rgba(0,0,0,0.5)] group-hover:border-zinc-500 transition-colors relative">
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {step.icon}
                  </div>
                  
                  {/* Content Node */}
                  <div className="flex-1 border border-zinc-800 bg-zinc-900/30 p-6 md:p-8 hover:border-zinc-700 transition-colors w-full shadow-inner">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                      <h3 className="text-2xl font-bold flex items-center gap-3">
                        <span className="text-zinc-600 font-mono text-lg">0{idx + 1}</span> 
                        {step.title}
                      </h3>
                      <span className="inline-flex items-center rounded bg-zinc-950 px-2 py-1 text-[10px] font-mono text-zinc-500 border border-zinc-800">
                        {step.id}
                      </span>
                    </div>
                    <p className="text-zinc-400 leading-relaxed mb-6">
                      {step.desc}
                    </p>
                    <div className="bg-zinc-950 p-3 rounded text-xs font-mono text-zinc-500 flex items-center gap-2 border border-zinc-800/80">
                      <Terminal className="h-3 w-3" />
                      &gt; {step.log}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TELEMETRY MOCKUP (Logistics & Routing) */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)]">
          <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between items-center">
            <div className="flex gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/50" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
              <div className="h-3 w-3 rounded-full bg-green-500/20 border border-green-500/50" />
            </div>
            <span className="text-[10px] font-mono text-blue-400">/sys/logistics-router</span>
          </div>
          
          <div className="p-8 font-mono text-sm space-y-4 relative">
            <div className="absolute top-8 right-8 text-emerald-500 opacity-20">
              <Cog className="w-32 h-32 animate-[spin_10s_linear_infinite]" />
            </div>
            
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2 relative z-10">
              <span>ORDER_ID:</span><span className="text-zinc-300">ORD-998A-4B21</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2 relative z-10">
              <span>DESTINATION:</span><span className="text-zinc-300">BERLIN, GERMANY</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2 relative z-10">
              <span>ITEM_SKU:</span><span className="text-purple-400">HDE-BLK-L-01 (HEAVYWEIGHT HOODIE)</span>
            </div>
            
            <div className="mt-8 text-xs text-zinc-400 space-y-2 pt-4 relative z-10">
              <p className="text-blue-400 mb-4">SYSTEM_LOG &gt; EXECUTING FULFILLMENT PROTOCOL</p>
              <p>&gt; Ping: Checking inventory at Node_US_EAST... [SKIP: HIGH FREIGHT COST]</p>
              <p>&gt; Ping: Checking inventory at Node_EU_CENTRAL... [MATCH FOUND]</p>
              <p>&gt; Transmitting print file hashes to Node_EU_CENTRAL.</p>
              <p>&gt; Production queued. Estimated completion: 48hrs.</p>
              <p className="text-emerald-400 font-bold mt-4">&gt; RETAIL MARGIN ($18.50) LOCKED. AWAITING FINAL DISPATCH.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-8 py-32 bg-zinc-950 relative overflow-hidden">
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center justify-center gap-2 mb-6">
            <CheckCircle2 className="h-5 w-5 text-purple-500" />
            <span className="font-mono text-purple-500 tracking-widest text-sm">MANUFACTURING_READY</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Build your catalog today.
          </h2>
          
          <p className="text-zinc-400 text-lg mb-10 font-light max-w-xl mx-auto">
            Zero minimum orders. Zero warehouse leases. Just your creativity and a global infrastructure ready to execute.
          </p>
          
          <Link href="/catalog">
            <Button size="lg" className="h-14 px-10 text-lg bg-purple-600 hover:bg-purple-700 text-white rounded-none border border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)] transition-all hover:shadow-[0_0_50px_rgba(168,85,247,0.5)] font-mono">
              <Terminal className="mr-3 h-5 w-5" />
              Open Design Engine
            </Button>
          </Link>
        </div>
      </section>

    </div>
  );
}