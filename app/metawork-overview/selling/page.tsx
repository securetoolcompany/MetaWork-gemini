import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Store, Megaphone, Settings, Search, Coins, ArrowRight, 
  Terminal, LayoutTemplate, Globe, BarChart, CheckCircle2, 
  Lock, QrCode, MonitorPlay, Users, ShoppingCart, Zap,
  BookOpen, Database, Cpu
} from 'lucide-react';
import Link from 'next/link';

export default function CommerceProcessPage() {
  const process = [
    { 
      id: "01_OPTIMIZATION",
      icon: <Search className="h-6 w-6 text-amber-400" />, 
      title: "SEO & Indexing", 
      desc: "Give your product a powerful title, rich description, and targeted tags. This ensures it ranks perfectly on Google and within the MetaWork Showroom.",
      log: "METADATA_SYNCED"
    },
    { 
      id: "02_ECONOMICS",
      icon: <Settings className="h-6 w-6 text-blue-400" />, 
      title: "Margin Control", 
      desc: "You control the math. Set your retail price above the base manufacturing cost and IP licensing fee. The terminal instantly calculates your exact net profit.",
      log: "PROFIT_MARGIN_LOCKED"
    },
    { 
      id: "03_CURATION",
      icon: <LayoutTemplate className="h-6 w-6 text-purple-400" />, 
      title: "Aisle Setup", 
      desc: "Your Aisle is your dedicated slice of the network. Customize your storefront theme, upload banner art, and organize your products into featured collections.",
      log: "STOREFRONT_RENDERED"
    },
    { 
      id: "04_DISTRIBUTION",
      icon: <Megaphone className="h-6 w-6 text-rose-400" />, 
      title: "Social Broadcast", 
      desc: "Take your custom Aisle link and drop it in your Linktree, YouTube description, or Instagram bio. You own the traffic. When they click, they buy directly from you.",
      log: "TRAFFIC_ROUTING_ACTIVE"
    },
    { 
      id: "05_DISCOVERY",
      icon: <Globe className="h-6 w-6 text-emerald-400" />, 
      title: "Showroom Amplification", 
      desc: "Beyond your own audience, your products are automatically indexed in the global MetaWork Showroom, exposing your brand to the entire decentralized network.",
      log: "NETWORK_INDEXING_COMPLETE"
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-amber-500/30">
      
      {/* HERO SECTION */}
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs font-mono text-amber-400 uppercase tracking-widest mb-8">
            <Terminal className="mr-2 h-3.5 w-3.5" />
            MetaCommerce Engine
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            Stop renting shelf space. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Own the entire store.</span>
          </h1>
          
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8 max-w-2xl">
            You minted the IP. You designed the product. Now capture the yield. Build a custom, algorithmic storefront (Aisle) to distribute your brand directly to your audience without legacy middlemen stealing your margins.
          </p>
          
          <div className="flex gap-4">
            <Link href="/login">
              <Button size="lg" className="h-12 px-8 bg-amber-600 hover:bg-amber-700 text-white rounded-none border border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)] font-mono">
                Initialize Aisle
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CORE INFRASTRUCTURE */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6">
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-amber-500/50 hover:border-amber-500/30 transition-colors">
            <CardHeader>
              <Store className="h-8 w-8 text-amber-400 mb-2" />
              <CardTitle className="font-mono text-lg">Your Aisle, Your Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Your Aisle is your primary weapon. It's a dedicated, customizable storefront that exists entirely under your control. Direct your social media followers here to convert attention directly into capital.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-amber-500/50 hover:border-amber-500/30 transition-colors">
            <CardHeader>
              <BarChart className="h-8 w-8 text-amber-400 mb-2" />
              <CardTitle className="font-mono text-lg">Granular Economics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                You aren't boxed into rigid retail tiers. You set the exact retail price. The terminal shows you the base manufacturing cost and IP license fee, allowing you to dial in your profit margin to the penny.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-amber-500/50 hover:border-amber-500/30 transition-colors">
            <CardHeader>
              <Globe className="h-8 w-8 text-amber-400 mb-2" />
              <CardTitle className="font-mono text-lg">Showroom Indexing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                While your Aisle captures your direct audience, the MetaWork Showroom acts as a global discovery engine. Your optimized products are indexed network-wide, putting your brand in front of thousands of new buyers.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* AISLE CONFIGURATION MATRIX */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Aisle Configuration Matrix</h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
              An Aisle is not just a webpage—it is a programmable financial engine. Configure your Aisle to generate multiple streams of passive and active yield.
            </p>
          </div>

          <div className="space-y-12">
            
            {/* CONFIG 1: Monetization & Ads */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-amber-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <MonitorPlay className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-amber-500/10 px-2 py-1 text-xs font-mono text-amber-400 mb-4 border border-amber-500/20">
                    CONFIG_01: PASSIVE_YIELD
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Ad Network Integration</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Why should the platform keep all the ad money? Turn on the Universal Ad Network in your Aisle settings. We display non-intrusive, premium placements on your storefront, and the smart contract automatically splits the ad revenue with you.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Coins className="mr-2 h-4 w-4 text-amber-400" /> Revenue Streams
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Earn passive income even when visitors don't buy a product.</li>
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Enable the "Digital Tip Jar" to accept direct crypto donations.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Output
                    </h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Your storefront transforms from a static catalog into a dual-engine yield generator, monetizing both physical product sales and digital traffic simultaneously.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CONFIG 2: Community Curation */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-amber-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Users className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-amber-500/10 px-2 py-1 text-xs font-mono text-amber-400 mb-4 border border-amber-500/20">
                    CONFIG_02: CROSS_POLLINATION
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Community Curation</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    If another creator on MetaWork designs a brilliant hoodie using <em>your</em> minted IP, you can feature their product in <em>your</em> Aisle. When it sells from your store, you earn the IP Royalty AND the storefront cut.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <LayoutTemplate className="mr-2 h-4 w-4 text-amber-400" /> Aisle Curation
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Group items into thematic Collections.</li>
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Curate the best third-party designs featuring your art.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Output
                    </h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      You build a massive, diverse catalog without lifting a finger to design the products, fully leveraging the creativity of the decentralized network.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CONFIG 3: Promotions & QR */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-amber-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <QrCode className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-amber-500/10 px-2 py-1 text-xs font-mono text-amber-400 mb-4 border border-amber-500/20">
                    CONFIG_03: OMNICHANNEL
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Promotions & Physical Bridge</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Bridge the gap between physical spaces and digital sales. Generate precise promotional codes and instant QR codes straight from your dashboard to drive traffic anywhere.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Megaphone className="mr-2 h-4 w-4 text-amber-400" /> Omnichannel Tools
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Run flash sales with percentage-based promo codes.</li>
                      <li className="flex items-start"><span className="text-amber-400 mr-2">-</span> Print auto-generated QR codes to put on cafe tables or event booths.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Output
                    </h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Seamlessly convert physical foot traffic into digital sales. No need to carry inventory to a convention; just display the QR code and let MetaWork handle the rest.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* THE PIPELINE (Horizontal Grid) */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">The Sales & Distribution Pipeline</h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-2xl">
              Five automated phases to take your product from a digital draft to a globally accessible revenue stream.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 relative">
            {process.map((item, idx) => (
              <div key={idx} className="border border-zinc-800 bg-zinc-950 p-6 flex flex-col hover:border-zinc-600 transition-colors group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                  <span className="text-8xl font-black">{idx + 1}</span>
                </div>
                
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="h-10 w-10 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                    {item.id}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold mb-3 relative z-10">{item.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed flex-1 relative z-10">
                  {item.desc}
                </p>
                
                <div className="mt-6 pt-4 border-t border-zinc-800/50 font-mono text-[10px] text-zinc-500 relative z-10">
                  &gt; {item.log}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NEW: UNDER THE HOOD / ARCHITECTURE TEASER */}
      <section className="px-8 py-24 bg-amber-900/10 border-b border-zinc-800/50">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-zinc-950 border border-amber-500/30 mb-8 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
            <BookOpen className="h-8 w-8 text-amber-400" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Look Under the Hood.</h2>
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-12 max-w-3xl mx-auto">
            MetaWork is not a standard Web2 database. It is a decentralized protocol powered by Algorand smart contracts, cryptographic IPFS hashing, and trustless settlement layers. Discover exactly how the technology guarantees your ownership and revenue.
          </p>
          
          <div className="grid sm:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto text-left">
            <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-md">
              <Database className="h-6 w-6 text-amber-400 mb-4" />
              <h4 className="font-bold text-zinc-200 mb-2">Immutable Metadata</h4>
              <p className="text-xs text-zinc-500 leading-relaxed">How IPFS permanently locks your SEO, imagery, and product descriptions to the blockchain.</p>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-md">
              <Cpu className="h-6 w-6 text-blue-400 mb-4" />
              <h4 className="font-bold text-zinc-200 mb-2">Smart Contracts</h4>
              <p className="text-xs text-zinc-500 leading-relaxed">How Algorand TEAL scripts execute trustless, split-second payouts across multiple wallets.</p>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-md">
              <Lock className="h-6 w-6 text-emerald-400 mb-4" />
              <h4 className="font-bold text-zinc-200 mb-2">Crypto Attribution</h4>
              <p className="text-xs text-zinc-500 leading-relaxed">How decentralized indexing eliminates affiliate fraud and tracks your sales globally.</p>
            </div>
          </div>

          <Link href="/selling/architecture">
            <Button size="lg" variant="outline" className="h-14 px-10 text-lg border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-zinc-950 rounded-none font-mono transition-all">
              <Terminal className="mr-3 h-5 w-5" /> View Full Protocol Specs
            </Button>
          </Link>
        </div>
      </section>

      {/* METAWORK VS AMAZON */}
      <section className="px-8 py-24 bg-blue-900/5 border-b border-zinc-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">The Decentralized Advantage</h2>
            <p className="text-zinc-400">Why launching an Aisle beats renting shelf space from legacy Web2 marketplaces.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 rounded-lg overflow-hidden">
            
            {/* The Old Way */}
            <div className="bg-zinc-950 p-10">
              <h3 className="text-xl font-bold text-red-400 mb-8 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" /> Legacy Marketplaces (Amazon/Etsy)
              </h3>
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-500 text-xs">✕</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-300">Predatory Fees</h4>
                    <p className="text-xs text-zinc-500 mt-1">They charge 15% to 25% just for the privilege of listing your product, crushing your margins.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-500 text-xs">✕</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-300">Blind Operations</h4>
                    <p className="text-xs text-zinc-500 mt-1">They own the customer data. You don't know who is buying your products or how to retarget them.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-500 text-xs">✕</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-300">Algorithmic Suppression</h4>
                    <p className="text-xs text-zinc-500 mt-1">Your products are displayed right next to cheaper knock-offs, forcing a race to the bottom in price.</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* The MetaWork Way */}
            <div className="bg-zinc-900/80 p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[50px] rounded-full" />
              <h3 className="text-xl font-bold text-amber-400 mb-8 flex items-center gap-2 relative z-10">
                <Zap className="h-5 w-5" /> MetaCommerce Aisles
              </h3>
              <ul className="space-y-6 relative z-10">
                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-amber-400 text-xs">✓</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Zero Listing Fees</h4>
                    <p className="text-xs text-amber-200/70 mt-1">You only pay the manufacturing cost and IP royalty. No platform subscription fees. Period.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-amber-400 text-xs">✓</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Absolute Ownership</h4>
                    <p className="text-xs text-amber-200/70 mt-1">Your Aisle is yours. You control the theme, the branding, and the exact margins on every product.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-amber-400 text-xs">✓</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Cross-Pollination</h4>
                    <p className="text-xs text-amber-200/70 mt-1">Tap into the network. Feature products built by others using your IP to effortlessly expand your catalog.</p>
                  </div>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* SYSTEM TELEMETRY (Terminal Mockup) */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto rounded-md border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between items-center">
            <div className="flex gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/50" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
              <div className="h-3 w-3 rounded-full bg-green-500/20 border border-green-500/50" />
            </div>
            <span className="text-[10px] font-mono text-amber-400">/sys/pricing-and-distribution</span>
          </div>
          
          <div className="p-8 font-mono text-sm space-y-3 relative overflow-hidden h-[420px]">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-zinc-900/90 z-10 pointer-events-none" />
            
            <p className="text-zinc-500">&gt; Loading product draft: "Heavyweight Street Hoodie"</p>
            <p className="text-zinc-500">&gt; Verifying IP License: <span className="text-purple-400">"Neon Skull Vector" (Active)</span></p>
            <br />
            <p className="text-zinc-300 font-bold">--- ECONOMIC CONFIGURATION ---</p>
            <p className="text-zinc-400 ml-4">Base Manufacturing Cost: <span className="text-zinc-500">$18.50</span></p>
            <p className="text-zinc-400 ml-4">IP Owner Royalty (Per Sale): <span className="text-zinc-500">$2.00</span></p>
            <p className="text-amber-400 ml-4">Target Retail Price: <span className="text-amber-500 font-bold">$45.00</span></p>
            <p className="text-emerald-400 ml-4">YOUR NET MARGIN: <span className="text-emerald-500 font-bold">$24.50</span></p>
            <br />
            <p className="text-zinc-300 font-bold">--- DEPLOYMENT ROUTING ---</p>
            <p className="text-zinc-500">&gt; Pushing metadata to Aisle frontend...</p>
            <p className="text-zinc-500">&gt; Generating secure public URL...</p>
            <p className="text-blue-400 font-bold">&gt; AISLE LINK: metawork.com/aisle/your-brand/hoodie-01</p>
            <br />
            <p className="text-emerald-400 font-bold">&gt; SUCCESS: PRODUCT IS LIVE. READY FOR SOCIAL BROADCAST.</p>
            <p className="text-zinc-500 animate-pulse">&gt; _</p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-8 py-32 bg-zinc-950 relative overflow-hidden">
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center justify-center gap-2 mb-6">
            <Lock className="h-5 w-5 text-amber-500" />
            <span className="font-mono text-amber-500 tracking-widest text-sm">COMMERCE_READY</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Open your doors.
          </h2>
          
          <p className="text-zinc-400 text-lg mb-10 font-light max-w-xl mx-auto">
            You don't need a massive marketing budget. You just need an audience and a link. Set up your Aisle and start turning your community's attention into real-world value.
          </p>
          
          <Link href="/login">
            <Button size="lg" className="h-14 px-10 text-lg bg-amber-600 hover:bg-amber-700 text-white rounded-none border border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-all hover:shadow-[0_0_50px_rgba(245,158,11,0.5)] font-mono">
              <Store className="mr-3 h-5 w-5" />
              Initialize Storefront
            </Button>
          </Link>
        </div>
      </section>

    </div>
  );
}