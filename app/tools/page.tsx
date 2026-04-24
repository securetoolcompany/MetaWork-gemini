import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Terminal, LayoutDashboard, Database, Palette, 
  Store, Gift, Wallet, ArrowRight, Activity, 
  Lock, Wrench, Smartphone, Hammer, 
  Cpu, LineChart, QrCode, Layers, Image as ImageIcon,
  Shirt, Type, SlidersHorizontal, Hash, Link as LinkIcon
} from 'lucide-react';
import Link from 'next/link';

export default function ToolsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-blue-500/30">
      
      {/* HERO SECTION */}
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs font-mono text-blue-400 uppercase tracking-widest mb-8">
            <Wrench className="mr-2 h-3.5 w-3.5" />
            MetaWork OS Utility Belt
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            The ultimate <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Business Toolbox.</span>
          </h1>
          
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8 max-w-2xl">
            We built a digital Swiss Army knife for the modern creator economy. Turn your phone or laptop into a comprehensive command center—equipped with digital tools like blockchain ledgers and physical tools like global supply chains.
          </p>
          
          <div className="flex gap-4">
            <Link href="/login">
              <Button size="lg" className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-none border border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)] font-mono">
                <Terminal className="mr-2 h-4 w-4" /> Open Your Toolbox
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs font-mono text-zinc-500">
            * All tools accessible via unified secure gateway.
          </p>
        </div>
      </section>

      {/* THE 6 CORE MODULES (Overview Grid) */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">The MetaWork Toolbox</h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
              You do not need to know how to code to leverage Web3. Our terminal packages enterprise-grade digital architecture and global physical manufacturing into intuitive, point-and-click tools.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-zinc-900/30 border-zinc-800 rounded-none border-l-2 border-l-purple-500 hover:bg-zinc-900/50 transition-colors">
              <CardHeader>
                <div className="h-10 w-10 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                  <Database className="h-5 w-5 text-purple-400" />
                </div>
                <CardTitle className="text-xl">Cryptographic Storage</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">Upload artwork, logos, and 3D files. We hash them to the IPFS network and mint them as NFTs on Algorand.</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/30 border-zinc-800 rounded-none border-l-2 border-l-blue-500 hover:bg-zinc-900/50 transition-colors">
              <CardHeader>
                <div className="h-10 w-10 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <Hammer className="h-5 w-5 text-blue-400" />
                </div>
                <CardTitle className="text-xl">Physical Origination</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">Access a catalog of 500+ physical blanks. Use our 3D web canvas to drag-and-drop your IP onto apparel and gear.</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/30 border-zinc-800 rounded-none border-l-2 border-l-amber-500 hover:bg-zinc-900/50 transition-colors">
              <CardHeader>
                <div className="h-10 w-10 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <Store className="h-5 w-5 text-amber-400" />
                </div>
                <CardTitle className="text-xl">Storefront Builder</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">Construct your public Aisle. Customize colors, layout, and thematic collections without writing any CSS.</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/30 border-zinc-800 rounded-none border-l-2 border-l-rose-500 hover:bg-zinc-900/50 transition-colors">
              <CardHeader>
                <div className="h-10 w-10 rounded bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
                  <Smartphone className="h-5 w-5 text-rose-400" />
                </div>
                <CardTitle className="text-xl">Omnichannel Marketing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">Generate dynamic discount codes and printable QR codes that route physical foot traffic directly to your Aisle.</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/30 border-zinc-800 rounded-none border-l-2 border-l-emerald-500 hover:bg-zinc-900/50 transition-colors">
              <CardHeader>
                <div className="h-10 w-10 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                  <Cpu className="h-5 w-5 text-emerald-400" />
                </div>
                <CardTitle className="text-xl">On-Chain Finance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">Connect your wallet. Track real-time transactions, view transparent fee splits, and watch your USDC yield deposit instantly.</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/30 border-zinc-800 rounded-none border-l-2 border-l-cyan-500 hover:bg-zinc-900/50 transition-colors">
              <CardHeader>
                <div className="h-10 w-10 rounded bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
                  <LineChart className="h-5 w-5 text-cyan-400" />
                </div>
                <CardTitle className="text-xl">Global Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">Track macro-level performance. See how many times your IP was licensed by others and view your Showroom ranking.</p>
              </CardContent>
            </Card>

          </div>
        </div>
      </section>

      {/* DEEP DIVE MODULE MOCKUPS */}
      <section className="py-24 bg-zinc-900/10">
        <div className="max-w-7xl mx-auto space-y-32 px-8">
          
          {/* 1. IP Vault Mockup */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center rounded bg-purple-500/10 px-2 py-1 text-xs font-mono text-purple-400 mb-4 border border-purple-500/20">MODULE_01</div>
              <h3 className="text-3xl font-bold mb-4">The IP Vault</h3>
              <p className="text-zinc-400 leading-relaxed mb-6">Bypass traditional copyright bureaucracy. Upload your raw files directly into the vault. We automatically generate a cryptographic hash, pin the file to IPFS, and mint an Algorand Standard Asset (ASA) to prove your undisputed ownership.</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
              <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /></div>
                <span className="ml-2 text-[10px] font-mono text-purple-400">vault_indexer.exe</span>
              </div>
              <div className="p-6 font-mono text-xs">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-3 mb-3">
                  <div className="flex items-center gap-3"><ImageIcon className="h-4 w-4 text-purple-400" /> <span>skull_vector_v2.png</span></div>
                  <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">MINTED</span>
                </div>
                <div className="space-y-2 text-zinc-500">
                  <div className="flex justify-between"><span>IPFS_CID:</span><span className="text-zinc-300">QmYwAPJzv5CZsnA625...</span></div>
                  <div className="flex justify-between"><span>ALGO_ID:</span><span className="text-zinc-300">104299104</span></div>
                  <div className="flex justify-between"><span>LICENSE_FEE:</span><span className="text-purple-400">$2.50 USDC</span></div>
                </div>
                <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded">
                  <p className="text-purple-400 mb-1">&gt; ASSET LOCKED. READY FOR LICENSING.</p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. MetaManufacturing Mockup */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl order-2 lg:order-1">
              <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /></div>
                <span className="ml-2 text-[10px] font-mono text-blue-400">canvas_renderer.exe</span>
              </div>
              <div className="flex h-56">
                <div className="w-1/3 bg-zinc-900/50 border-r border-zinc-800 p-4 space-y-3 font-mono text-[10px]">
                  <div className="text-zinc-500 mb-1 border-b border-zinc-800 pb-1">LAYERS</div>
                  <div className="bg-blue-500/20 text-blue-400 p-2 rounded border border-blue-500/30 flex items-center justify-between">
                    <span>IP_GRAPHIC</span> <SlidersHorizontal className="h-3 w-3" />
                  </div>
                  <div className="bg-zinc-900 text-zinc-400 p-2 rounded border border-zinc-800 flex items-center justify-between">
                    <span>BASE_HOODIE</span> <Palette className="h-3 w-3" />
                  </div>
                </div>
                <div className="flex-1 relative flex items-center justify-center bg-zinc-950">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_24px]" />
                  <Shirt className="w-32 h-32 text-zinc-800 relative z-10" />
                  <ImageIcon className="w-8 h-8 text-blue-400 absolute z-20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-[80%]" />
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center rounded bg-blue-500/10 px-2 py-1 text-xs font-mono text-blue-400 mb-4 border border-blue-500/20">MODULE_02</div>
              <h3 className="text-3xl font-bold mb-4">Design Engine</h3>
              <p className="text-zinc-400 leading-relaxed mb-6">Your browser is now a manufacturing facility. Select from hundreds of premium physical blanks, pull assets directly from your IP Vault, and position them on the 3D canvas. The system automatically generates print files and calculates exact production costs.</p>
            </div>
          </div>

          {/* 3. Aisle Architect Mockup */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center rounded bg-amber-500/10 px-2 py-1 text-xs font-mono text-amber-400 mb-4 border border-amber-500/20">MODULE_03</div>
              <h3 className="text-3xl font-bold mb-4">Aisle Architect</h3>
              <p className="text-zinc-400 leading-relaxed mb-6">No HTML required. Configure your public storefront via a live visual editor. Toggle theme colors, establish product collections, and instantly deploy your Aisle to the network. Every Aisle comes pre-wired with decentralized checkout.</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
              <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /></div>
                <span className="ml-2 text-[10px] font-mono text-amber-400">storefront_builder.exe</span>
              </div>
              <div className="flex flex-col h-56">
                <div className="bg-zinc-900/50 border-b border-zinc-800 p-2 flex gap-2 text-[10px] font-mono">
                  <div className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded border border-amber-500/30">THEME_UI</div>
                  <div className="text-zinc-500 px-3 py-1 hover:text-zinc-300">COLLECTIONS</div>
                  <div className="text-zinc-500 px-3 py-1 hover:text-zinc-300">SEO_TAGS</div>
                </div>
                <div className="flex-1 p-4 flex gap-6 items-center">
                  <div className="w-1/3 space-y-4">
                    <div className="flex items-center justify-between bg-zinc-900 p-2 rounded border border-zinc-800"><span className="text-xs text-zinc-400">Primary</span><div className="h-4 w-4 rounded bg-amber-500" /></div>
                    <div className="flex items-center justify-between bg-zinc-900 p-2 rounded border border-zinc-800"><span className="text-xs text-zinc-400">Font</span><Type className="h-3 w-3 text-zinc-500" /></div>
                  </div>
                  <div className="flex-1 border border-zinc-800 rounded-lg h-full p-3 bg-zinc-900 flex flex-col justify-between opacity-50">
                    <div className="h-8 w-full bg-zinc-800 rounded flex items-center px-2"><div className="h-2 w-12 bg-zinc-700 rounded" /></div>
                    <div className="flex gap-2">
                       <div className="h-16 flex-1 bg-zinc-800 rounded" />
                       <div className="h-16 flex-1 bg-zinc-800 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Promo Toolkit Mockup */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl order-2 lg:order-1">
              <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /></div>
                <span className="ml-2 text-[10px] font-mono text-rose-400">omni_channel_router.exe</span>
              </div>
              <div className="p-6 flex gap-6 items-center h-56">
                <div className="p-2 bg-white rounded-lg shrink-0">
                  <QrCode className="w-24 h-24 text-black" />
                </div>
                <div className="space-y-3 font-mono text-xs w-full">
                  <div className="text-zinc-500 border-b border-zinc-800 pb-1 mb-2">CAMPAIGN_LOGIC</div>
                  <div className="flex items-center gap-2"><Hash className="h-3 w-3 text-zinc-600"/> <span className="text-zinc-300">ID: SUMMER_BRAWL_26</span></div>
                  <div className="flex items-center gap-2"><LinkIcon className="h-3 w-3 text-zinc-600"/> <span className="text-zinc-400 truncate">metawork.com/qr/a7...</span></div>
                  <div className="bg-rose-500/10 border border-rose-500/20 p-2 rounded mt-2">
                    <span className="text-rose-400 block mb-1">EXECUTION_RULE:</span>
                    <span className="text-zinc-300">IF (CART_TOTAL &gt; $50)</span><br/>
                    <span className="text-emerald-400">THEN APPLY (-15% MARGIN_CUT)</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center rounded bg-rose-500/10 px-2 py-1 text-xs font-mono text-rose-400 mb-4 border border-rose-500/20">MODULE_04</div>
              <h3 className="text-3xl font-bold mb-4">Promotional Toolkit</h3>
              <p className="text-zinc-400 leading-relaxed mb-6">Bridge physical spaces to your digital Aisle. Generate high-res QR codes for event booths, cafe tables, or gym bulletin boards. Write custom smart-discount logic to run flash sales without cannibalizing your base costs.</p>
            </div>
          </div>

          {/* 5. Financial Settlement Mockup */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center rounded bg-emerald-500/10 px-2 py-1 text-xs font-mono text-emerald-400 mb-4 border border-emerald-500/20">MODULE_05</div>
              <h3 className="text-3xl font-bold mb-4">On-Chain Finance</h3>
              <p className="text-zinc-400 leading-relaxed mb-6">Web2 e-commerce platforms hold your money for weeks. Our financial dashboard reads directly from the blockchain. View exact fee splits, track incoming royalties, and execute 1-click withdrawals to your connected Web3 wallet.</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
              <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /></div>
                <span className="ml-2 text-[10px] font-mono text-emerald-400">ledger_settlement.exe</span>
              </div>
              <div className="p-6 font-mono text-xs flex flex-col justify-center h-56">
                <div className="flex justify-between items-end mb-4 bg-zinc-900 p-4 rounded border border-zinc-800">
                  <div>
                    <div className="text-zinc-500 mb-1">CLAIMABLE_USDC</div>
                    <div className="text-3xl font-bold text-emerald-400">$1,240.50</div>
                  </div>
                  <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none">WITHDRAW</Button>
                </div>
                <div className="space-y-3">
                  <div className="text-zinc-600 border-b border-zinc-800 pb-1 mb-2">RECENT_SETTLEMENTS</div>
                  <div className="flex justify-between text-zinc-400"><span>TX: Hoodie_Sale_01</span><span className="text-emerald-400">+$24.50</span></div>
                  <div className="flex justify-between text-zinc-400"><span>TX: IP_Royalty_Sync</span><span className="text-emerald-400">+$2.00</span></div>
                  <div className="flex justify-between text-zinc-400"><span>TX: Ad_Network_Yield</span><span className="text-emerald-400">+$0.45</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Analytics Mockup */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl order-2 lg:order-1">
              <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /><div className="h-2.5 w-2.5 rounded-full bg-zinc-700" /></div>
                <span className="ml-2 text-[10px] font-mono text-cyan-400">showroom_analytics.exe</span>
              </div>
              <div className="p-6 flex flex-col justify-end h-56">
                <div className="text-[10px] font-mono text-zinc-500 mb-4 text-right">30_DAY_VELOCITY</div>
                <div className="flex items-end gap-2 h-24 border-b border-zinc-800 pb-2">
                  <div className="w-1/6 bg-cyan-500/20 h-[30%] hover:bg-cyan-500/40 transition-colors" />
                  <div className="w-1/6 bg-cyan-500/30 h-[45%] hover:bg-cyan-500/50 transition-colors" />
                  <div className="w-1/6 bg-cyan-500/40 h-[40%] hover:bg-cyan-500/60 transition-colors" />
                  <div className="w-1/6 bg-cyan-500/60 h-[70%] hover:bg-cyan-500/80 transition-colors" />
                  <div className="w-1/6 bg-cyan-500/80 h-[90%] hover:bg-cyan-500 transition-colors" />
                  <div className="w-1/6 bg-cyan-400 h-[100%] shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                </div>
                <div className="mt-4 flex justify-between items-center text-xs font-mono">
                  <span className="text-zinc-500">SHOWROOM_INDEX: <span className="text-zinc-300">#412</span></span>
                  <span className="text-cyan-400">&gt; Traffic up 42% WoW</span>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center rounded bg-cyan-500/10 px-2 py-1 text-xs font-mono text-cyan-400 mb-4 border border-cyan-500/20">MODULE_06</div>
              <h3 className="text-3xl font-bold mb-4">Global Analytics</h3>
              <p className="text-zinc-400 leading-relaxed mb-6">Stop operating blind. The analytics module tracks macro-level network performance. See exactly how many third-party Aisles are utilizing your IP, monitor your conversion rates, and track your ranking within the global Showroom.</p>
            </div>
          </div>

        </div>
      </section>

      {/* DASHBOARD PREVIEW (Unified Terminal Mockup) */}
      <section className="px-8 py-32 bg-zinc-900/30 border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Unified Command Dashboard</h2>
            <p className="text-zinc-400 text-lg leading-relaxed">
              All six modules converge into a single, high-performance interface. This is what you see when you log in to MetaWork.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-700 bg-zinc-950 overflow-hidden shadow-[0_0_80px_rgba(59,130,246,0.15)] ring-1 ring-white/5">
            {/* Window Header */}
            <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between items-center">
              <div className="flex gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/50" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                <div className="h-3 w-3 rounded-full bg-green-500/20 border border-green-500/50" />
              </div>
              <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-2">
                <Lock className="h-3 w-3 text-emerald-500" /> metawork_os_v2.0_MAIN
              </span>
            </div>

            {/* Dashboard Body */}
            <div className="grid md:grid-cols-4 min-h-[600px]">
              {/* Fake Sidebar */}
              <div className="hidden md:flex flex-col border-r border-zinc-800/50 bg-zinc-950/80 p-4 space-y-2">
                <div className="text-[10px] font-mono text-zinc-600 mb-4 px-2">SYSTEM / CREATOR</div>
                {[
                  { icon: LayoutDashboard, text: "Dashboard Telemetry", active: true },
                  { icon: Database, text: "IP Vault Utility" },
                  { icon: Palette, text: "Design Engine" },
                  { icon: Store, text: "Aisle Architect" },
                  { icon: Gift, text: "Promo Toolkit" },
                  { icon: Wallet, text: "Financial Tools" }
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono ${item.active ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-zinc-500'}`}>
                    <item.icon className="h-4 w-4" /> {item.text}
                  </div>
                ))}
              </div>

              {/* Fake Main Content */}
              <div className="col-span-3 p-8 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/10 via-zinc-950 to-zinc-950">
                <div className="flex justify-between items-start mb-8 border-b border-zinc-800/50 pb-6">
                  <div>
                    <h3 className="text-2xl font-bold mb-1">System Operational.</h3>
                    <p className="text-sm text-zinc-500 font-mono">WALLET: 0x48FA...9C21</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500 font-mono mb-1">NETWORK_YIELD (30D)</p>
                    <p className="text-3xl font-mono text-emerald-400">$4,250.80</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-6 mb-8">
                  <div className="bg-zinc-900/40 border border-zinc-800 p-5 rounded-lg shadow-inner">
                    <div className="flex justify-between mb-4">
                      <span className="text-[10px] font-mono text-zinc-500">ACTIVE_ASSETS</span>
                      <Database className="h-4 w-4 text-purple-400" />
                    </div>
                    <div className="text-xl font-bold mb-1 text-zinc-200">14 Assets</div>
                  </div>
                  <div className="bg-zinc-900/40 border border-zinc-800 p-5 rounded-lg shadow-inner">
                    <div className="flex justify-between mb-4">
                      <span className="text-[10px] font-mono text-zinc-500">LIVE_PRODUCTS</span>
                      <Shirt className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="text-xl font-bold mb-1 text-zinc-200">42 SKUs</div>
                  </div>
                  <div className="bg-zinc-900/40 border border-zinc-800 p-5 rounded-lg shadow-inner">
                    <div className="flex justify-between mb-4">
                      <span className="text-[10px] font-mono text-zinc-500">STORE_TRAFFIC</span>
                      <Activity className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="text-xl font-bold mb-1 text-zinc-200">1,204 Visits</div>
                  </div>
                </div>

                {/* Fake Terminal Log */}
                <div className="bg-zinc-950/80 border border-zinc-800 p-5 rounded-lg font-mono text-xs space-y-2 h-48 overflow-hidden relative shadow-inner">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-zinc-950 pointer-events-none" />
                  <p className="text-blue-400">SYSTEM_LOG &gt; INITIALIZING DATA STREAM</p>
                  <p className="text-zinc-500">&gt; Polling Algorand Mainnet...</p>
                  <p className="text-emerald-500">&gt; TX_RECEIPT: Royalty payment ($4.50) confirmed.</p>
                  <p className="text-zinc-500">&gt; MetaManufacturing Node (EU) accepted order #9928.</p>
                  <p className="text-zinc-500">&gt; Aisle analytics compiled. Traffic up 12% today.</p>
                  <p className="text-emerald-500">&gt; TX_RECEIPT: Direct Sale ($24.50) confirmed.</p>
                  <p className="text-zinc-600 animate-pulse">&gt; _</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-8 py-32 bg-zinc-950 relative overflow-hidden">
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center justify-center gap-2 mb-6">
            <Lock className="h-5 w-5 text-blue-500" />
            <span className="font-mono text-blue-500 tracking-widest text-sm">ACCESS_GRANTED</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Equip yourself.
          </h2>
          
          <p className="text-zinc-400 text-lg mb-10 font-light max-w-xl mx-auto">
            Log in to access your digital toolbox, connect your wallet, and start building your decentralized business today.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="h-14 px-10 text-lg bg-blue-600 hover:bg-blue-700 text-white rounded-none border border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all hover:shadow-[0_0_50px_rgba(59,130,246,0.5)] font-mono w-full sm:w-auto">
                <Terminal className="mr-3 h-5 w-5" />
                Login / Register
              </Button>
            </Link>
            <Link href="/selling/architecture">
              <Button size="lg" variant="outline" className="h-14 px-10 text-lg border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-none font-mono w-full sm:w-auto">
                Read the Whitepaper
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}