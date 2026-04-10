import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Terminal, Database, FileText, Music, Image as ImageIcon, 
  Lightbulb, Activity, ShieldCheck, Users, Coins, Store, 
  ArrowRight, Palette, GraduationCap, ChevronRight, UploadCloud, 
  Settings, Rocket, CheckCircle2 
} from 'lucide-react';
import Link from 'next/link';

export default function TokenizationPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-emerald-500/30">
      
      {/* HERO SECTION */}
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs font-mono text-emerald-400 uppercase tracking-widest mb-8">
            <Terminal className="mr-2 h-3.5 w-3.5" />
            Universal Tokenization Protocol
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            Tokenize <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Literally Anything.</span>
          </h1>
          
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8">
            We aren't chasing Wall Street dollars. We are democratizing asset ownership for Main Street. MetaWork is the world's first universal tokenization engine—empowering you to protect, monetize, and raise capital for your local business, art, or ideas.
          </p>
          
          <div className="flex gap-4">
            <Link href="/login">
              <Button size="lg" className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none border border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                Initialize Vault
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* DEFINITION SECTION */}
      <section className="px-8 py-16 border-b border-zinc-800/50 bg-zinc-900/20">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-12 items-start">
          <div className="lg:col-span-1">
            <h2 className="text-2xl font-bold tracking-tight mb-4">System Definition</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Tokenization is the process of converting rights to an asset—whether physical, digital, or conceptual—into a secure digital token on the blockchain. 
              <br /><br />
              By doing this, an asset that is normally hard to sell or split up (like a business, a contract, or a song) becomes highly liquid, divisible, and programmable.
            </p>
          </div>
          
          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
            <div className="border border-zinc-800 bg-zinc-950 p-6">
              <ShieldCheck className="h-6 w-6 text-emerald-400 mb-4" />
              <h3 className="font-mono text-sm font-bold text-zinc-200 mb-2">1. Asset Protection</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">Immutable proof of ownership recorded on the Algorand ledger. Once minted, your intellectual property or equity is cryptographically secured.</p>
            </div>
            <div className="border border-zinc-800 bg-zinc-950 p-6">
              <Coins className="h-6 w-6 text-emerald-400 mb-4" />
              <h3 className="font-mono text-sm font-bold text-zinc-200 mb-2">2. Capital Generation</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">Sell micro-fractions of your asset to a global (or local) pool of investors. Raise money without giving up control to predatory banks.</p>
            </div>
            <div className="border border-zinc-800 bg-zinc-950 p-6">
              <Users className="h-6 w-6 text-emerald-400 mb-4" />
              <h3 className="font-mono text-sm font-bold text-zinc-200 mb-2">3. Community Loyalty</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">Turn your customers into stakeholders. Reward them with tokens that yield dividends, transforming casual buyers into dedicated brand advocates.</p>
            </div>
            <div className="border border-zinc-800 bg-zinc-950 p-6">
              <Activity className="h-6 w-6 text-emerald-400 mb-4" />
              <h3 className="font-mono text-sm font-bold text-zinc-200 mb-2">4. Automated Yield</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">Smart contracts route revenue directly to token holders. When your asset generates income, payouts happen instantly and automatically.</p>
            </div>
          </div>
        </div>
      </section>

      {/* THE ASSET MATRIX */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-2">The Asset Matrix</h2>
            <p className="text-zinc-500 font-mono text-sm">Supported inputs for the MetaWork Tokenization Engine.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Visual/Audio Art */}
            <Card className="bg-zinc-900/40 border-zinc-800 rounded-none">
              <CardHeader className="pb-2">
                <div className="flex gap-2 mb-3">
                  <ImageIcon className="h-5 w-5 text-zinc-400" />
                  <Music className="h-5 w-5 text-zinc-400" />
                </div>
                <CardTitle className="text-base font-mono uppercase">Media & Art</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Tokenize images, photography, logos, music tracks, and audio stems. License them directly to product creators for automated royalties.
                </p>
              </CardContent>
            </Card>

            {/* Documents & Text */}
            <Card className="bg-zinc-900/40 border-zinc-800 rounded-none">
              <CardHeader className="pb-2">
                <FileText className="h-5 w-5 text-zinc-400 mb-3" />
                <CardTitle className="text-base font-mono uppercase">Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Protect and monetize written works. Tokenize books, essays, legal contracts, research papers, and codebases to secure licensing rights.
                </p>
              </CardContent>
            </Card>

            {/* Revenue & Business */}
            <Card className="bg-zinc-900/40 border-zinc-800 rounded-none">
              <CardHeader className="pb-2">
                <Store className="h-5 w-5 text-zinc-400 mb-3" />
                <CardTitle className="text-base font-mono uppercase">Revenue Streams</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Tokenize a percentage of future business income. Fractionalize real estate, local storefronts, or digital subscription yields.
                </p>
              </CardContent>
            </Card>

            {/* Ideas & Concepts */}
            <Card className="bg-zinc-900/40 border-zinc-800 rounded-none">
              <CardHeader className="pb-2">
                <Lightbulb className="h-5 w-5 text-zinc-400 mb-3" />
                <CardTitle className="text-base font-mono uppercase">Abstract Ideas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Establish immutable proof-of-concept. Tokenize inventions, business plans, or game mechanics before pitching them to publishers.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* NETWORK DEPLOYMENTS (The Use Cases) */}
      <section className="px-8 py-24 bg-zinc-900/30 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          
          <div className="mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-2">Network Deployments</h2>
            <p className="text-zinc-500 font-mono text-sm">How different sectors utilize the MetaWork protocol in the real world.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Case Study 1: Main Street Pizza */}
            <Card className="bg-zinc-950 border-zinc-800 rounded-none overflow-hidden flex flex-col">
              <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-blue-400">
                  <Store className="h-3.5 w-3.5" /> CASE_01: LOCAL_BUSINESS
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <CardContent className="p-8 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-4">Funding the Local Pizza Shop</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                    Bypass the bank entirely. Tokenize 20% of your future shop's revenue pool. Your local community buys tokens to fund your ovens, becoming highly motivated customers who literally own a piece of your success.
                  </p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800/80 p-4 rounded font-mono text-xs">
                  <div className="flex justify-between text-zinc-500 mb-2">
                    <span>CAPITAL RAISED</span>
                    <span className="text-zinc-300">$45,000 / $50,000</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-950 rounded overflow-hidden mb-4">
                    <div className="h-full bg-blue-500 w-[90%]" />
                  </div>
                  <div className="flex justify-between border-t border-zinc-800 pt-2 text-emerald-400">
                    <span>YIELD DISTRIBUTED (YTD)</span>
                    <span>$3,420.50</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Case Study 2: Musician */}
            <Card className="bg-zinc-950 border-zinc-800 rounded-none overflow-hidden flex flex-col">
              <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-purple-400">
                  <Music className="h-3.5 w-3.5" /> CASE_02: INDEPENDENT_MUSICIAN
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <CardContent className="p-8 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-4">Crowdfunding the Next Album</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                    A local musician tokenizes the master rights to an upcoming EP before recording it. Fans purchase tokens to fund the studio time. Once released, the smart contract automatically splits streaming royalties with the fan-investors.
                  </p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800/80 p-4 rounded font-mono text-xs">
                  <div className="flex justify-between text-zinc-500 mb-2">
                    <span>STUDIO TARGET</span>
                    <span className="text-zinc-300">$4,200 / $5,000</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-950 rounded overflow-hidden mb-4">
                    <div className="h-full bg-purple-500 w-[84%]" />
                  </div>
                  <div className="flex justify-between border-t border-zinc-800 pt-2 text-purple-400">
                    <span>FAN INVESTORS</span>
                    <span>128 WALLETS</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Case Study 3: Visual Artist */}
            <Card className="bg-zinc-950 border-zinc-800 rounded-none overflow-hidden flex flex-col">
              <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-pink-400">
                  <Palette className="h-3.5 w-3.5" /> CASE_03: VISUAL_ARTIST
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <CardContent className="p-8 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-4">Infinite Supply Chain Licensing</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                    Upload an illustration and mint it as an IP Asset. Product designers across the MetaWork network apply your art to t-shirts and hoodies. Sell the same design 10,000 times without touching a shipping box, earning a micro-royalty on every sale.
                  </p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800/80 p-4 rounded font-mono text-xs space-y-2">
                  <div className="flex justify-between text-zinc-500">
                    <span>IP_STATUS</span>
                    <span className="text-emerald-400">MINTED_AND_LOCKED</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>ACTIVE_NETWORK_LICENSES</span>
                    <span className="text-zinc-300">47 PRODUCTS</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-800 pt-2 text-pink-400">
                    <span>ROYALTIES GENERATED</span>
                    <span>$1,844.20</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Case Study 4: University */}
            <Card className="bg-zinc-950 border-zinc-800 rounded-none overflow-hidden flex flex-col">
              <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
                  <GraduationCap className="h-3.5 w-3.5" /> CASE_04: ACADEMIC_INSTITUTION
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <CardContent className="p-8 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-4">Cryptographic Document Verification</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                    A university tokenizes student transcripts and diplomas as immutable digital assets. Employers can instantly verify a candidate's credentials on the blockchain without contacting the registrar, completely eliminating degree fraud.
                  </p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800/80 p-4 rounded font-mono text-xs space-y-2">
                  <div className="flex justify-between text-zinc-500">
                    <span>DOCUMENT_HASH</span>
                    <span className="text-zinc-400 truncate ml-4">0x7F8B...99A2</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>ISSUING_AUTHORITY</span>
                    <span className="text-zinc-300">STATE_UNIVERSITY</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-800 pt-2 text-amber-400">
                    <span>VERIFICATION_STATUS</span>
                    <span>[ VALIDATED ]</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* DEPLOYMENT PROTOCOL (The User Flow) */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Deployment Protocol</h2>
            <p className="text-zinc-400 text-sm">Four steps from raw asset to live, yield-bearing blockchain token.</p>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start relative gap-8 md:gap-4">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-8 left-12 right-12 h-px bg-zinc-800 z-0" />
            
            {/* Step 1 */}
            <div className="relative z-10 flex flex-col items-center text-center flex-1">
              <div className="h-16 w-16 rounded-full bg-zinc-900 border-2 border-zinc-700 flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                <Terminal className="h-6 w-6 text-zinc-400" />
              </div>
              <h4 className="font-mono text-sm font-bold text-zinc-200 mb-2">01. INITIALIZE</h4>
              <p className="text-xs text-zinc-500 max-w-[200px]">Create your MetaWork account and set up your secure digital workspace.</p>
            </div>

            {/* Step 2 */}
            <div className="relative z-10 flex flex-col items-center text-center flex-1">
              <div className="h-16 w-16 rounded-full bg-zinc-900 border-2 border-blue-500/50 flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <UploadCloud className="h-6 w-6 text-blue-400" />
              </div>
              <h4 className="font-mono text-sm font-bold text-zinc-200 mb-2">02. INGESTION</h4>
              <p className="text-xs text-zinc-500 max-w-[200px]">Upload your artwork, business plan, or legal documents to the decentralized IPFS vault.</p>
            </div>

            {/* Step 3 */}
            <div className="relative z-10 flex flex-col items-center text-center flex-1">
              <div className="h-16 w-16 rounded-full bg-zinc-900 border-2 border-purple-500/50 flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                <Settings className="h-6 w-6 text-purple-400" />
              </div>
              <h4 className="font-mono text-sm font-bold text-zinc-200 mb-2">03. CONFIGURATION</h4>
              <p className="text-xs text-zinc-500 max-w-[200px]">Set your parameters. Define the token supply, pricing, and automated royalty splits.</p>
            </div>

            {/* Step 4 */}
            <div className="relative z-10 flex flex-col items-center text-center flex-1">
              <div className="h-16 w-16 rounded-full bg-emerald-900/20 border-2 border-emerald-500 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                <Rocket className="h-6 w-6 text-emerald-400" />
              </div>
              <h4 className="font-mono text-sm font-bold text-zinc-200 mb-2">04. DEPLOYMENT</h4>
              <p className="text-xs text-zinc-500 max-w-[200px]">Mint to Algorand. Your asset is now live, protected, and ready to generate yield.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ACTIVE NETWORK NODES (Aisle Examples) - REAL DATA VERSION */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Active Network Nodes</h2>
              <p className="text-zinc-500 font-mono text-sm">Live storefronts and revenue pools operating on MetaWork.</p>
            </div>
            <Link href="/showroom">
              <Button variant="link" className="text-emerald-500 hover:text-emerald-400 font-mono text-xs hidden sm:flex">
                VIEW ALL DIRECTORY <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Node 1: RISE */}
            <div className="group border border-zinc-800 bg-zinc-950 p-4 hover:border-zinc-600 transition-colors cursor-pointer">
              <div className="aspect-square bg-zinc-900 border border-zinc-800 mb-4 flex items-center justify-center overflow-hidden relative">
                <div className="absolute top-2 right-2 flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
                </div>
                <Activity className="h-8 w-8 text-zinc-700 group-hover:scale-110 transition-transform" />
              </div>
              <h4 className="font-mono font-bold text-sm text-zinc-200 truncate">RISE</h4>
              <p className="text-xs text-zinc-500 mb-3">Athletic Apparel Brand</p>
              <div className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-2 py-1 inline-block rounded">PRODUCT LICENSING</div>
            </div>

            {/* Node 2: Alpha BJJ */}
            <div className="group border border-zinc-800 bg-zinc-950 p-4 hover:border-zinc-600 transition-colors cursor-pointer">
              <div className="aspect-square bg-zinc-900 border border-zinc-800 mb-4 flex items-center justify-center overflow-hidden relative">
                <div className="absolute top-2 right-2 flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
                </div>
                <ShieldCheck className="h-8 w-8 text-zinc-700 group-hover:scale-110 transition-transform" />
              </div>
              <h4 className="font-mono font-bold text-sm text-zinc-200 truncate">Alpha BJJ</h4>
              <p className="text-xs text-zinc-500 mb-3">Martial Arts Academy</p>
              <div className="text-[10px] font-mono text-blue-400 bg-blue-400/10 px-2 py-1 inline-block rounded">COMMUNITY FUNDED</div>
            </div>

            {/* Node 3: Boxing Fit University */}
            <div className="group border border-zinc-800 bg-zinc-950 p-4 hover:border-zinc-600 transition-colors cursor-pointer">
              <div className="aspect-square bg-zinc-900 border border-zinc-800 mb-4 flex items-center justify-center overflow-hidden relative">
                <div className="absolute top-2 right-2 flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
                </div>
                <GraduationCap className="h-8 w-8 text-zinc-700 group-hover:scale-110 transition-transform" />
              </div>
              <h4 className="font-mono font-bold text-sm text-zinc-200 truncate">Boxing Fit University</h4>
              <p className="text-xs text-zinc-500 mb-3">Fitness Education Platform</p>
              <div className="text-[10px] font-mono text-purple-400 bg-purple-400/10 px-2 py-1 inline-block rounded">MEMBERSHIP YIELD</div>
            </div>

            {/* Node 4: Cherechy Draws */}
            <div className="group border border-zinc-800 bg-zinc-950 p-4 hover:border-zinc-600 transition-colors cursor-pointer">
              <div className="aspect-square bg-zinc-900 border border-zinc-800 mb-4 flex items-center justify-center overflow-hidden relative">
                <div className="absolute top-2 right-2 flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
                </div>
                <Palette className="h-8 w-8 text-zinc-700 group-hover:scale-110 transition-transform" />
              </div>
              <h4 className="font-mono font-bold text-sm text-zinc-200 truncate">Cherechy Draws</h4>
              <p className="text-xs text-zinc-500 mb-3">Illustration IP Library</p>
              <div className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-2 py-1 inline-block rounded">ACTIVE MERCH LICENSES</div>
            </div>

          </div>
          
          <div className="mt-6 text-center sm:hidden">
            <Link href="/showroom">
              <Button variant="outline" className="w-full border-zinc-800 font-mono text-xs">VIEW ALL DIRECTORY</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FINAL CTA (System Ready) */}
      <section className="px-8 py-32 bg-zinc-950 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <Terminal className="w-[800px] h-[800px]" />
        </div>
        
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center justify-center gap-2 mb-6">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <span className="font-mono text-emerald-500 tracking-widest text-sm">SYSTEM_READY</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Ready to deploy your assets?
          </h2>
          
          <p className="text-zinc-400 text-lg mb-10 font-light max-w-xl mx-auto">
            Stop letting gatekeepers control your wealth. Initialize your MetaWork workspace today and bring your IP and business revenue onto the blockchain.
          </p>
          
          <Link href="/register">
            <Button size="lg" className="h-14 px-10 text-lg bg-emerald-600 hover:bg-emerald-700 text-white rounded-none border border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all hover:shadow-[0_0_50px_rgba(16,185,129,0.5)] font-mono">
              <Terminal className="mr-3 h-5 w-5" />
              Initialize Workspace
            </Button>
          </Link>
          <div className="mt-6 font-mono text-xs text-zinc-600">
            SECURED BY ALGORAND CRYPTOGRAPHY
          </div>
        </div>
      </section>

    </div>
  );
}