import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Terminal, Globe, ShieldCheck, Zap, Key, 
  BookOpen, Users, Cpu, ArrowRight, Network,
  Fingerprint, Briefcase, Code2
} from 'lucide-react';
import Link from 'next/link';

export default function AboutUsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-emerald-500/30 font-sans">
      
      {/* HEADER OVERLAY */}
      <div className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">MetaWork_OS / core_manifesto.txt</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono text-emerald-400">MISSION_ACTIVE</span>
          </div>
        </div>
      </div>

      {/* HERO: THE ACCESS DOCTRINE */}
      <section className="relative px-8 pt-32 pb-24 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-emerald-500/5 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 max-w-5xl">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[1.05] mb-8">
            Poverty is not a resource problem. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">It is an ACCESS problem.</span>
          </h1>
          
          <div className="max-w-3xl space-y-6 text-xl text-zinc-400 leading-relaxed font-light">
            <p>
              The world generates enough wealth to sustain everyone, but legacy financial systems are gated by geography, credit scores, and institutional intermediaries. 
            </p>
            <p>
              Over 1.7 billion adults remain unbanked. They are entirely disconnected from the global economy. MetaWork was built to patch this critical routing error. We are replacing legacy gatekeepers with decentralized, cryptographic infrastructure.
            </p>
          </div>
        </div>
      </section>

      {/* THE FOUR PILLARS (From Whitepaper) */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">The Universal Access Protocol</h2>
            <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">Executing systemic inclusion directives.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-zinc-950 border-zinc-800 rounded-none hover:border-emerald-500/50 transition-colors group">
              <CardContent className="p-8">
                <Briefcase className="h-8 w-8 text-emerald-400 mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-3">Access to Work</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Breaking down geographical borders. Users anywhere in the world can access MetaJobs, complete digital tasks, and earn crypto instantly without upfront costs or banking prerequisites.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800 rounded-none hover:border-cyan-500/50 transition-colors group">
              <CardContent className="p-8">
                <Fingerprint className="h-8 w-8 text-cyan-400 mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-3">Access to Ownership</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  The right to own is fundamental. Through tokenization on the Algorand blockchain, we transform art, physical businesses, and digital IP into verifiable, fractionalized assets.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800 rounded-none hover:border-blue-500/50 transition-colors group">
              <CardContent className="p-8">
                <Cpu className="h-8 w-8 text-blue-400 mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-3">Access to Tools</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  A smartphone is the only hardware required. We provide a full suite of business tools—from on-demand global manufacturing to automated smart contracts—democratizing enterprise-grade infrastructure.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800 rounded-none hover:border-purple-500/50 transition-colors group">
              <CardContent className="p-8">
                <BookOpen className="h-8 w-8 text-purple-400 mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-3">Access to Training</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Empowerment requires education. MetaWork integrates vocational-style educational modules, equipping users with the digital literacy required to thrive in a decentralized Web3 economy.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* THE ARCHITECTS (Founders) */}
      <section className="px-8 py-32 bg-zinc-950 border-b border-zinc-800/50 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-zinc-900/50 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="mb-20 text-center">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">System Architects</h2>
            <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">Co-Founders of SECURE MetaWork</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            
            {/* ADAM PAUL SMOLAK */}
            <div className="border border-zinc-800 bg-zinc-900/40 p-10 relative group hover:border-zinc-600 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                <Network className="w-48 h-48" />
              </div>
              <div className="relative z-10">
                <div className="inline-flex items-center rounded bg-emerald-500/10 px-2 py-1 text-[10px] font-mono text-emerald-400 mb-6 border border-emerald-500/20">
                  NODE_01: STRATEGY & ENTERPRISE PARTNERSHIPS
                </div>
                <h3 className="text-3xl font-bold mb-2">Adam Paul Smolak</h3>
                <p className="text-zinc-500 font-mono text-sm mb-6">Co-Founder & CEO</p>
                
                <div className="space-y-4 text-zinc-400 text-sm leading-relaxed mb-8">
                  <p>
                    Adam-Paul bridges the gap between massive physical operations and decentralized digital systems. With extensive executive experience founding and scaling physical product companies (such as SECURE Tool Company), Adam-Paul understands the inherent friction and immense overhead of legacy supply chains.
                  </p>
                  <p>
                    At MetaWork, he drives the strategic vision, forging the physical infrastructure networks (from manufacturing nodes to enterprise partnerships) that allow our users to originate real-world products globally with zero inventory risk.
                  </p>
                </div>
                
                <a href="https://www.linkedin.com/in/adam-paul-smolak-4b816312/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm font-bold font-mono text-zinc-300 hover:text-emerald-400 transition-colors">
                  <Key className="mr-2 h-4 w-4" /> VIEW_LINKEDIN_PROFILE
                </a>
              </div>
            </div>

            {/* SCOTT HOLBROOK */}
            <div className="border border-zinc-800 bg-zinc-900/40 p-10 relative group hover:border-zinc-600 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                <Code2 className="w-48 h-48" />
              </div>
              <div className="relative z-10">
                <div className="inline-flex items-center rounded bg-cyan-500/10 px-2 py-1 text-[10px] font-mono text-cyan-400 mb-6 border border-cyan-500/20">
                  NODE_02: ARCHITECTURE & DEPLOYMENT
                </div>
                <h3 className="text-3xl font-bold mb-2">Scott Holbrook</h3>
                <p className="text-zinc-500 font-mono text-sm mb-6">Co-Founder & COO</p>
                
                <div className="space-y-4 text-zinc-400 text-sm leading-relaxed mb-8">
                  <p>
                    Scott engineered the underlying logic of the MetaWork economy. Specializing in Web3 architecture, smart contract deployment on Algorand, and complex project management, he translates sweeping economic theory into functional, robust code.
                  </p>
                  <p>
                    Crucially, Scott brings a deep background in vocational-style educational programming. This ensures the MetaWork platform is not just a high-tech novelty for crypto-insiders, but an accessible, highly usable tool designed to educate and empower everyday people worldwide.
                  </p>
                </div>

                <a href="https://www.linkedin.com/in/imscottholbrook/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm font-bold font-mono text-zinc-300 hover:text-cyan-400 transition-colors">
                  <Key className="mr-2 h-4 w-4" /> VIEW_LINKEDIN_PROFILE
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* THE MANIFESTO (Terminal View) */}
      <section className="px-8 py-24 bg-zinc-900/20">
        <div className="max-w-4xl mx-auto rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          
          <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between items-center">
            <div className="flex gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/50" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
              <div className="h-3 w-3 rounded-full bg-green-500/20 border border-green-500/50" />
            </div>
            <span className="text-[10px] font-mono text-zinc-500">/sys/mission_manifesto.sh</span>
          </div>
          
          <div className="p-8 font-mono text-sm space-y-6 text-emerald-500/80 leading-relaxed">
            <p>
              <span className="text-zinc-500">root@metawork:~#</span> cat /manifesto/core_beliefs.txt
            </p>
            <div className="space-y-4 pl-4 border-l border-zinc-800">
              <p>&gt; We believe that global economic exclusion is a systemic failure, not an inevitability.</p>
              <p>&gt; We believe that if a system requires a central bank to participate, that system is fundamentally broken.</p>
              <p>&gt; We believe that creators should own their pixels, workers should own their labor, and communities should own their equity.</p>
              <p>&gt; We believe in replacing centralized servers with immutable ledgers.</p>
              <p>&gt; We believe in replacing gatekeepers with smart contracts.</p>
              <p>&gt; We believe that true financial sovereignty is achieved through permissionless access to global manufacturing, cryptographic IP protection, and fractionalized revenue pools.</p>
            </div>
            <p className="text-zinc-500 pt-4">
              root@metawork:~# <span className="text-emerald-400 animate-pulse">_</span>
            </p>
          </div>

        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-8 py-24 bg-zinc-950 border-t border-zinc-800/50 text-center">
        <h2 className="text-3xl font-bold tracking-tight mb-6">Join the Network.</h2>
        <p className="text-zinc-400 mb-10 max-w-2xl mx-auto">
          We are actively onboarding creators, investors, and workers into the MetaWork ecosystem. Step out of the legacy economy and into the future of decentralized commerce.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/login">
            <Button size="lg" className="h-14 px-10 text-lg bg-emerald-600 hover:bg-emerald-700 text-white rounded-none font-mono">
              <Zap className="mr-2 h-4 w-4" /> Open Your Account
            </Button>
          </Link>
          <Link href="/tools">
            <Button size="lg" variant="outline" className="h-14 px-10 text-lg border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-none font-mono">
              Explore the Tools
            </Button>
          </Link>
        </div>
      </section>

    </div>
  );
}