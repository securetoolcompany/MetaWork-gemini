import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Terminal, Palette, ShieldCheck, Box, Activity, ChevronRight, 
  Video, Gamepad, Paintbrush, Target, CheckCircle2,
  BrainCircuit, AlertTriangle, Fingerprint
} from 'lucide-react';
import Link from 'next/link';

export default function CreatorsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-purple-500/30">
      
      {/* HERO SECTION */}
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
            <Link href="/login">
              <Button size="lg" className="h-12 px-8 bg-purple-600 hover:bg-purple-700 text-white rounded-none font-mono">
                <Terminal className="mr-2 h-4 w-4" /> Deploy IP Asset
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* NEW: THE PARADIGM SHIFT (AI & Truth) */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-5xl mx-auto relative z-10 border border-zinc-800 bg-zinc-900/40 p-10 md:p-16 shadow-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono mb-8">
            <AlertTriangle className="h-3.5 w-3.5" />
            SYSTEM_WARNING: IDENTITY_DEVALUATION
          </div>
          
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
            The Epoch of Pure Ideation.
          </h2>
          
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6 text-zinc-400 leading-relaxed font-light">
              <p>
                The definition of human economic value has fundamentally shifted. Historically, value was derived from physical presence. As society industrialized, it shifted to physical labor—who could build the most with their hands. 
              </p>
              <p>
                Today, the "Creator Economy" represents the final transition to <strong className="text-zinc-200">pure ideation</strong>. Generative AI, automation, and advanced compute can now instantly manifest your imagination into reality. But this creates a massive epistemic vulnerability.
              </p>
            </div>
            
            <div className="space-y-6 text-zinc-400 leading-relaxed font-light">
              <p>
                In a landscape of infinite digital replication, escalating deep fakes, and sophisticated fraud, <strong className="text-purple-400">cryptographic truth is your only defense.</strong>
              </p>
              <p>
                Content creators must mint <em>everything</em>. Every YouTube video, every podcast episode, every character design. MetaWork instantiates your ideas on the blockchain, establishing an absolute, timestamped proof of origin. If a bad actor steals your IP, you don't just have a claim—you have undeniable, mathematical recourse.
              </p>
            </div>
          </div>
          
          <div className="mt-10 pt-8 border-t border-zinc-800 flex items-center gap-4">
            <BrainCircuit className="h-8 w-8 text-purple-500 opacity-50" />
            <Fingerprint className="h-8 w-8 text-blue-500 opacity-50" />
            <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest ml-4">
              &gt; Secure your imagination.
            </span>
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6">
          <Card className="bg-zinc-950 border-zinc-800 rounded-none border-t-2 border-t-purple-500/50">
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
          <Card className="bg-zinc-950 border-zinc-800 rounded-none border-t-2 border-t-purple-500/50">
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
          <Card className="bg-zinc-950 border-zinc-800 rounded-none border-t-2 border-t-purple-500/50">
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

      {/* ROBUST DEPLOYMENT TRACKS */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Digital Creator Pipelines</h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
              Specialized workflows to help digital-native creators bridge the gap into physical merchandising and verifiable digital licensing.
            </p>
          </div>

          <div className="space-y-12">
            {/* TRACK 1 */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-purple-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Paintbrush className="w-48 h-48" /></div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-purple-500/10 px-2 py-1 text-xs font-mono text-purple-400 mb-4 border border-purple-500/20">TRACK_01: VISUAL_ARTS</div>
                  <h3 className="text-2xl font-bold mb-4">Illustrators & Webtoon Artists</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">Turn your character designs and comic panels into licensed merch. Let other designers on MetaWork build apparel featuring your art, generating passive royalties while you focus on drawing.</p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><Target className="mr-2 h-4 w-4 text-purple-400" /> Creator Goals</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-purple-400 mr-2">-</span> Decouple income from active client commissions.</li>
                      <li className="flex items-start"><span className="text-purple-400 mr-2">-</span> Stop art theft via cryptographic hashing.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> IP Vault for organizing layers and character sheets.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Public licensing catalog integration.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 2 */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-purple-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Video className="w-48 h-48" /></div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-purple-500/10 px-2 py-1 text-xs font-mono text-purple-400 mb-4 border border-purple-500/20">TRACK_02: CONTENT_CREATORS</div>
                  <h3 className="text-2xl font-bold mb-4">Streamers & YouTubers</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">Launch a premium apparel line for your subscribers in 10 minutes. Offer exclusive "Merch Drop NFTs" to your Twitch subs that grant them access to hidden products in your Aisle.</p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><Target className="mr-2 h-4 w-4 text-purple-400" /> Creator Goals</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-purple-400 mr-2">-</span> Diversify away from ad-revenue dependency.</li>
                      <li className="flex items-start"><span className="text-purple-400 mr-2">-</span> Reward top-tier subscribers with exclusive physical access.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Zero-maintenance merch storefront (Aisle).</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> NFT token-gating for exclusive product visibility.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 3 */}
            <div className="border border-zinc-800 bg-zinc-900/30 p-8 hover:border-purple-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Gamepad className="w-48 h-48" /></div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-purple-500/10 px-2 py-1 text-xs font-mono text-purple-400 mb-4 border border-purple-500/20">TRACK_03: GAME_DEVS</div>
                  <h3 className="text-2xl font-bold mb-4">Indie Game Studios</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">Funding a game is hard. Tokenize your concept art and game lore. Fans buy into the IP Pool to fund your development, and you can instantly offer them physical merch of the game characters.</p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><Target className="mr-2 h-4 w-4 text-purple-400" /> Creator Goals</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-purple-400 mr-2">-</span> Bootstrap development without a publisher.</li>
                      <li className="flex items-start"><span className="text-purple-400 mr-2">-</span> Monetize 3D models and lore bibles physically.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3"><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables</h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Crowdfunding Revenue Pool generation.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> 3D to 2D product rendering pipeline.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
            <div className="mt-4 text-xs text-zinc-400 space-y-1 pt-4">
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