import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Sparkles, FileSearch, Cpu, Settings, Rocket, Terminal, 
  ArrowRight, Database, ShieldCheck, Zap, ChevronRight, CheckCircle2, Lock
} from 'lucide-react';
import Link from 'next/link';

export default function MintingProcess() {
  const process = [
    { 
      id: "01_INGESTION",
      icon: <Database className="h-6 w-6 text-blue-400" />, 
      title: "Data Ingestion", 
      desc: "Convert physical revenue or digital IP into a blockchain-ready state. We encrypt your assets and securely pin the metadata to the decentralized IPFS network.",
      log: "ASSET_HASH_GENERATED"
    },
    { 
      id: "02_VERIFICATION",
      icon: <FileSearch className="h-6 w-6 text-amber-400" />, 
      title: "Rights Verification", 
      desc: "Our automated and manual compliance nodes verify ownership rights, revenue models, and copyright data to ensure total network security and legal compliance.",
      log: "COMPLIANCE_CHECK: PASSED"
    },
    { 
      id: "03_EXECUTION",
      icon: <Cpu className="h-6 w-6 text-purple-400" />, 
      title: "On-Chain Minting", 
      desc: "The asset is minted as an Algorand Standard Asset (ASA). This creates an immutable, cryptographically secure digital token representing absolute ownership.",
      log: "TX_CONFIRMED_ON_ALGORAND"
    },
    { 
      id: "04_CONFIGURATION",
      icon: <Settings className="h-6 w-6 text-rose-400" />, 
      title: "Smart Contracts", 
      desc: "You set the rules. Define licensing fees, revenue splits, and token supplies. These parameters are permanently locked into self-executing code.",
      log: "ROYALTY_LOGIC_LOCKED"
    },
    { 
      id: "05_DEPLOYMENT",
      icon: <Rocket className="h-6 w-6 text-emerald-400" />, 
      title: "Live Yield", 
      desc: "Your tokenized asset goes live in the MetaWork ecosystem. Smart contracts automatically route revenue to your wallet the exact millisecond a sale occurs.",
      log: "ASSET_YIELDING: TRUE"
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-emerald-500/30">
      
      {/* HERO SECTION */}
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs font-mono text-emerald-400 uppercase tracking-widest mb-8">
            <Terminal className="mr-2 h-3.5 w-3.5" />
            Asset Tokenization Protocol
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            Convert reality <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">into code.</span>
          </h1>
          
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8 max-w-2xl">
            Minting is the process of converting your intellectual property or real-world revenue into secure, tradeable digital tokens. Welcome to the engine room of the decentralized economy.
          </p>
          
          <div className="flex gap-4">
            <Link href="/login">
              <Button size="lg" className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none border border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                Initialize Asset Vault
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CORE INFRASTRUCTURE */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6">
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-emerald-500/50 hover:border-emerald-500/30 transition-colors">
            <CardHeader>
              <Zap className="h-8 w-8 text-emerald-400 mb-2" />
              <CardTitle className="font-mono text-lg">Quantum-Proof Security</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                We mint exclusively on the Algorand blockchain. Featuring advanced cryptographic protocols, your assets are protected against future quantum-computing threats. Absolute permanence.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-emerald-500/50 hover:border-emerald-500/30 transition-colors">
            <CardHeader>
              <Database className="h-8 w-8 text-emerald-400 mb-2" />
              <CardTitle className="font-mono text-lg">Decentralized Storage</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Your high-resolution files aren't sitting on a fragile AWS server. They are hashed and pinned to IPFS (InterPlanetary File System), ensuring your source files can never be altered or deleted by a central authority.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-emerald-500/50 hover:border-emerald-500/30 transition-colors">
            <CardHeader>
              <Cpu className="h-8 w-8 text-emerald-400 mb-2" />
              <CardTitle className="font-mono text-lg">Micro-Penny Economics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Unlike Ethereum, which charges massive "gas fees" to mint assets, our architecture executes transactions for fractions of a penny in under 3 seconds. Scalability without financial friction.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* THE PIPELINE (Horizontal Grid) */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">The Execution Pipeline</h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-2xl">
              Five automated phases to transition your real-world value onto the immutable ledger.
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

      {/* SYSTEM TELEMETRY (Terminal Mockup) */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto rounded-md border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between items-center">
            <div className="flex gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/50" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
              <div className="h-3 w-3 rounded-full bg-green-500/20 border border-green-500/50" />
            </div>
            <span className="text-[10px] font-mono text-zinc-400">/sys/algorand-mint-node</span>
          </div>
          
          <div className="p-8 font-mono text-sm space-y-3 relative overflow-hidden h-[340px]">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-zinc-900/90 z-10 pointer-events-none" />
            
            <p className="text-zinc-500">&gt; Authenticating user wallet signature...</p>
            <p className="text-emerald-400">&gt; Signature valid: 0x8F9A...B32C</p>
            <p className="text-zinc-500">&gt; Compiling asset metadata JSON...</p>
            <p className="text-zinc-500">&gt; Uploading high-res payload to IPFS cluster...</p>
            <p className="text-blue-400">&gt; IPFS CID Generated: QmXyZ1...9pLq</p>
            <br />
            <p className="text-zinc-500">&gt; Constructing Algorand Standard Asset (ASA) transaction...</p>
            <p className="text-zinc-400 ml-4">Asset Name: "CYBER_PUNK_ILLUSTRATION_01"</p>
            <p className="text-zinc-400 ml-4">Total Supply: 1 (Non-Fungible)</p>
            <p className="text-zinc-400 ml-4">Clawback Address: ZERO</p>
            <p className="text-zinc-400 ml-4">Freeze Address: ZERO</p>
            <br />
            <p className="text-zinc-500">&gt; Submitting payload to Algorand Mainnet...</p>
            <p className="text-zinc-500">&gt; Awaiting block confirmation...</p>
            <p className="text-emerald-400 font-bold">&gt; SUCCESS: ASSET MINTED.</p>
            <p className="text-emerald-400 font-bold">&gt; SMART CONTRACT SPLITS CONFIGURED. READY FOR NETWORK LICENSING.</p>
            <p className="text-zinc-500 animate-pulse">&gt; _</p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-8 py-32 bg-zinc-950 relative overflow-hidden">
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center justify-center gap-2 mb-6">
            <Lock className="h-5 w-5 text-emerald-500" />
            <span className="font-mono text-emerald-500 tracking-widest text-sm">CRYPTOGRAPHY_READY</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Lock in your legacy.
          </h2>
          
          <p className="text-zinc-400 text-lg mb-10 font-light max-w-xl mx-auto">
            Whether it's the rights to a song, a brand logo, or the equity of a local business, the blockchain is the ultimate source of truth. Start minting today.
          </p>
          
          <Link href="/login">
            <Button size="lg" className="h-14 px-10 text-lg bg-emerald-600 hover:bg-emerald-700 text-white rounded-none border border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all hover:shadow-[0_0_50px_rgba(16,185,129,0.5)] font-mono">
              <Terminal className="mr-3 h-5 w-5" />
              Initialize Vault
            </Button>
          </Link>
        </div>
      </section>

    </div>
  );
}