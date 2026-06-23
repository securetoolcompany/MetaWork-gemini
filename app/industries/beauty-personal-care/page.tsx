import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Terminal, Sparkles, ArrowRight, ShoppingBag, PieChart, 
  Lightbulb, ChevronRight, Palette, Clock, Home, Zap,
  CheckCircle2, Target, AlertTriangle, Fingerprint, 
  Users, Network
} from 'lucide-react';
import Link from 'next/link';

export default function BeautyPersonalCarePage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-fuchsia-500/30">

      {/* HERO SECTION */}
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-fuchsia-500/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
            <Link href="/industries" className="hover:text-fuchsia-400 transition-colors">INDUSTRIES</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-fuchsia-400">BEAUTY_AND_PERSONAL_CARE_MODULE</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            Direct-to-Community. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-rose-400">Zero inventory risk.</span>
          </h1>
          
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8 max-w-2xl">
            Empower indie beauty brands and formulators to launch tokenized product lines. License IP, automate royalty distributions, and scale without the crushing weight of traditional retail overhead.
          </p>
          
          <div className="flex gap-4">
            <Link href="/register">
              <Button size="lg" className="h-12 px-8 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-none font-mono">
                <Terminal className="mr-2 h-4 w-4" /> Initialize Brand Network
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* NEW: THE PARADIGM SHIFT */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fuchsia-500/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row gap-16 items-start">
            <div className="w-full md:w-1/3 sticky top-24">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-xs font-mono mb-6">
                <AlertTriangle className="h-3 w-3" /> SYSTEM_WARNING: RETAIL_MIDDLEMEN
              </div>
              <h2 className="text-3xl font-bold tracking-tight mb-4">The Epoch of <br />Skin-in-the-Game.</h2>
              <p className="text-zinc-500 font-mono text-sm leading-relaxed">
                '&gt;' Standardize cryptographic equity. <br />
                '&gt;' Eliminate shelf-space gatekeepers.
              </p>
            </div>
            
            <div className="w-full md:w-2/3 space-y-8 text-lg text-zinc-400 leading-relaxed font-light">
              <p>
                The legacy beauty industry is built on a foundation of gatekeepers. From retail buyers to massive distribution conglomerates, the path from formulator to consumer is clogged with middlemen who extract value while taking zero risk on the product itself.
              </p>
              <p>
                To thrive in the next decade, beauty brands must transition from centralized inventory models into **decentralized community engines.**
              </p>
              <p>
                This begins with **Product IP Tokenization.** By minting formulas, branding, and limited-edition drops as tokenized assets on Algorand, creators can raise capital directly from their fans. Fans aren't just customers; they become fractional equity holders in the product's success.
              </p>
              <p>
                When a tokenized lip kit or serum is sold through the MetaWork fulfillment network, every stakeholder—from the original formulator to the early backer—receives their exact royalty split instantly. No waiting for 90-day retail payout cycles. Just pure, algorithmic commerce.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES */}
      <section className="px-8 py-24 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="bg-zinc-900/50 border-zinc-800 rounded-none border-t-2 border-t-fuchsia-500">
            <CardHeader>
              <div className="w-10 h-10 rounded-full bg-fuchsia-500/10 flex items-center justify-center mb-4">
                <Palette className="h-5 w-5 text-fuchsia-500" />
              </div>
              <CardTitle className="text-xl font-bold tracking-tight">Formula IP Vaults</CardTitle>
            </CardHeader>
            <CardContent className="text-zinc-400 text-sm leading-relaxed">
              Formulators tokenize their proprietary recipes and scent profiles. License these formulas to brands with immutable royalty triggers on every unit produced.
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800 rounded-none border-t-2 border-t-fuchsia-500">
            <CardHeader>
              <div className="w-10 h-10 rounded-full bg-fuchsia-500/10 flex items-center justify-center mb-4">
                <ShoppingBag className="h-5 w-5 text-fuchsia-500" />
              </div>
              <CardTitle className="text-xl font-bold tracking-tight">Aisle Drops</CardTitle>
            </CardHeader>
            <CardContent className="text-zinc-400 text-sm leading-relaxed">
              Launch zero-inventory storefronts (Aisles) for influencers and creators. Test demand with 3D renderings before committing to manufacturing runs.
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800 rounded-none border-t-2 border-t-fuchsia-500">
            <CardHeader>
              <div className="w-10 h-10 rounded-full bg-fuchsia-500/10 flex items-center justify-center mb-4">
                <PieChart className="h-5 w-5 text-fuchsia-500" />
              </div>
              <CardTitle className="text-xl font-bold tracking-tight">Revenue Pools</CardTitle>
            </CardHeader>
            <CardContent className="text-zinc-400 text-sm leading-relaxed">
              Tokenize the future revenue of a new product line. Raise R&D capital from your community in exchange for a smart-contracted percentage of gross sales.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* DEPLOYMENT TRACKS */}
      <section className="px-8 py-24 bg-zinc-900/30 border-t border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold tracking-tight mb-16 text-center">Beauty Deployment Tracks</h2>
          
          <div className="space-y-24">
            {/* TRACK 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div>
                <div className="text-fuchsia-500 font-mono text-sm mb-4">TRACK_01: INDIE_FOUNDER</div>
                <h3 className="text-3xl font-bold mb-6">Agile Brand Launch</h3>
                <p className="text-zinc-400 text-lg font-light leading-relaxed mb-8">
                  For solo entrepreneurs and influencers. Move from concept to market in weeks by leveraging our verified network of manufacturers and tokenized licensing.
                </p>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-50 uppercase tracking-widest mb-4">Strategic Goals</h4>
                    <ul className="space-y-2 text-sm text-zinc-500 font-mono">
                      <li>- Minimize Upfront CAPEX</li>
                      <li>- Rapid Product Iteration</li>
                      <li>- Community Ownership</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-50 uppercase tracking-widest mb-4">Deliverables</h4>
                    <ul className="space-y-2 text-sm text-zinc-500 font-mono">
                      <li>- White-label Formulations</li>
                      <li>- Automated Royalty Store</li>
                      <li>- Asset Creation SOPs</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-none font-mono text-xs text-zinc-500">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-fuchsia-500" />
                  <span className="text-zinc-300">SYSTEM_DEPLOYMENT_ACTIVE</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between border-b border-zinc-800 pb-2">
                    <span>ASSET_MINTING</span>
                    <span className="text-fuchsia-500">COMPLETED</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800 pb-2">
                    <span>MANUFACTURING_LINK</span>
                    <span className="text-fuchsia-500">ACTIVE</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800 pb-2">
                    <span>ROYALTY_ROUTING</span>
                    <span className="text-fuchsia-500">INITIALIZED</span>
                  </div>
                  <div className="mt-8 text-[10px] leading-relaxed">
                    '&gt;' Initialize smart contract #BEAUTY-772<br />
                    '&gt;' Verifying community cap table...<br />
                    '&gt;' Network ready for genesis sale.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Terminal View */}
      <section className="px-8 py-24 max-w-7xl mx-auto w-full border-t border-zinc-800/50">
        <div className="bg-black border border-zinc-800 rounded-none overflow-hidden">
          <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500/20" />
              <div className="w-2 h-2 rounded-full bg-amber-500/20" />
              <div className="w-2 h-2 rounded-full bg-green-500/20" />
            </div>
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">/beauty/revenue-settlement</div>
            <div className="w-4" />
          </div>
          <div className="p-6 font-mono text-xs md:text-sm leading-relaxed">
            <div className="text-fuchsia-500 mb-4 tracking-tighter uppercase font-bold">
              ACTIVE_PRODUCT_DROP:  GLOW_SERUM_GEN_1
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8 text-zinc-400">
              <div>
                <div className="text-[10px] text-zinc-600 mb-1">UNITS_SOLD</div>
                <div className="text-zinc-100">12,450</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-600 mb-1">TOTAL_REVENUE</div>
                <div className="text-zinc-100">$435,750.00</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-600 mb-1">COMMUNITY_YIELD</div>
                <div className="text-fuchsia-500">$65,362.50</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-600 mb-1">STATUS</div>
                <div className="text-emerald-500">DISTRIBUTED</div>
              </div>
            </div>
            <div className="text-zinc-600 text-[10px] space-y-1">
              <div>SMART_CONTRACT_LOG '&gt;'</div>
              <div className="flex gap-4">
                <span className="text-zinc-800">[14:22:01]</span>
                <span>Batch processing 12,450 micro-royalty triggers...</span>
              </div>
              <div className="flex gap-4">
                <span className="text-zinc-800">[14:22:03]</span>
                <span>Formulator wallet verified: 15% revenue share routed.</span>
              </div>
              <div className="flex gap-4">
                <span className="text-zinc-800">[14:22:05]</span>
                <span className="text-fuchsia-500/50">Genesis Token Holder distribution complete.</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
