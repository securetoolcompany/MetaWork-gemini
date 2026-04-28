import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Terminal, ArrowLeft, Wallet, UploadCloud, Users, 
  Cpu, Store, Coins, ShieldCheck, Database, Zap,
  MousePointer2, FileImage, CheckCircle2, ToggleRight,
  BarChart3, Activity
} from 'lucide-react';

export default function MintingTutorialPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-blue-500/30 font-sans">
      
      {/* PERSISTENT TERMINAL HEADER */}
      <div className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-sm font-mono text-zinc-400 hover:text-blue-400 flex items-center transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> RETURN_TO_DASHBOARD
          </Link>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-zinc-500">
              <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald-500" /> ORACLE_ACTIVE</span>
              <span className="flex items-center gap-1"><Database className="h-3 w-3 text-blue-500" /> IPFS_SYNCED</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-mono text-blue-400">TUTORIAL_MODE</span>
            </div>
          </div>
        </div>
      </div>

      {/* HERO SECTION */}
      <section className="relative px-8 pt-24 pb-12 max-w-5xl mx-auto w-full">
        <div className="inline-flex items-center rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-mono text-blue-400 uppercase tracking-widest mb-8">
          <Terminal className="mr-2 h-3.5 w-3.5" /> Initialization Sequence
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tighter leading-[1.1] mb-6">
          The <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">IP Minting</span> Protocol.
        </h1>
        <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8 max-w-3xl">
          A step-by-step guide to registering your assets on-chain, configuring your stakeholder economy, and deploying your products for global commerce.
        </p>
      </section>

      <div className="max-w-5xl mx-auto px-8 pb-32 space-y-12">

        {/* TLDR SUMMARY (Moved to Top) */}
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl shadow-lg mb-8">
          <h4 className="text-sm font-mono text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Terminal className="h-4 w-4" /> Command Summary
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 font-mono text-xs">
            <div className="flex flex-col gap-2 p-3 bg-zinc-950 rounded border border-zinc-800/50 items-center text-center"><Wallet className="h-4 w-4 text-blue-400"/> Connect Wallet</div>
            <div className="flex flex-col gap-2 p-3 bg-zinc-950 rounded border border-zinc-800/50 items-center text-center"><UploadCloud className="h-4 w-4 text-blue-400"/> Upload to IPFS</div>
            <div className="flex flex-col gap-2 p-3 bg-zinc-950 rounded border border-zinc-800/50 items-center text-center"><Users className="h-4 w-4 text-purple-400"/> Define Split</div>
            <div className="flex flex-col gap-2 p-3 bg-zinc-950 rounded border border-zinc-800/50 items-center text-center"><Cpu className="h-4 w-4 text-purple-400"/> Mint Token</div>
            <div className="flex flex-col gap-2 p-3 bg-zinc-950 rounded border border-zinc-800/50 items-center text-center"><Store className="h-4 w-4 text-amber-400"/> Launch Aisle</div>
            <div className="flex flex-col gap-2 p-3 bg-zinc-950 rounded border border-zinc-800/50 items-center text-center"><Coins className="h-4 w-4 text-emerald-400"/> Claim USDC</div>
          </div>
        </div>

        {/* STAGE 1 */}
        <div className="border border-zinc-800 bg-zinc-900/20 rounded-xl overflow-hidden">
          <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-blue-500/10 flex items-center justify-center">
              <UploadCloud className="h-4 w-4 text-blue-400" />
            </div>
            <h2 className="text-lg font-bold font-mono tracking-tight">STAGE_1: PREPARATION & CONNECTIVITY</h2>
          </div>
          
          <div className="p-6 md:p-8 space-y-12">
            {/* Step 1 */}
            <div className="grid lg:grid-cols-[1fr_350px] gap-8 items-center">
              <div className="relative pl-8 border-l border-zinc-800">
                <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <span className="text-blue-400 font-mono text-sm">STEP 01 //</span> Connect Wallet
                </h3>
                <p className="text-zinc-400 mb-4 text-sm leading-relaxed">
                  Initialize your session by clicking the Connect Wallet button (supporting Pera, Defly, or AlgoSigner). Ensure you are on the Algorand Mainnet and maintain a minimal ALGO balance for gas fees.
                </p>
              </div>
              {/* Graphic */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 relative overflow-hidden flex flex-col items-center justify-center h-40">
                <div className="absolute top-2 left-2 text-[8px] font-mono text-zinc-600">auth_module.tsx</div>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full max-w-[200px] shadow-[0_0_20px_rgba(37,99,235,0.3)] relative">
                  <Wallet className="mr-2 h-4 w-4" /> Connect Wallet
                  <MousePointer2 className="absolute -bottom-4 -right-2 h-6 w-6 text-zinc-300 drop-shadow-lg" />
                </Button>
                <div className="mt-4 flex items-center gap-2 text-xs font-mono text-emerald-400 opacity-50">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Mainnet Connected
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="grid lg:grid-cols-[1fr_350px] gap-8 items-center">
              <div className="relative pl-8 border-l border-zinc-800">
                <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <span className="text-blue-400 font-mono text-sm">STEP 02 //</span> Upload Your IP Asset
                </h3>
                <p className="text-zinc-400 mb-4 text-sm leading-relaxed">
                  From your Dashboard, click <span className="text-zinc-200 font-mono bg-blue-600/20 border border-blue-500/30 px-1 py-0.5 rounded">Upload New IP Asset</span>. Drag and drop your file. The system routes it to Pinata (IPFS) for immutable storage and Cloudinary for high-speed delivery.
                </p>
              </div>
              {/* Graphic */}
              <div className="bg-zinc-950 border-2 border-dashed border-blue-500/30 rounded-lg p-6 flex flex-col items-center justify-center h-40 bg-blue-500/5 relative">
                <div className="absolute top-2 left-2 text-[8px] font-mono text-blue-400/50">ipfs_uploader.tsx</div>
                <FileImage className="h-8 w-8 text-blue-400 mb-2" />
                <div className="text-xs text-blue-200 font-mono text-center">Drag & Drop IP Asset</div>
                <div className="text-[10px] text-zinc-500 font-mono mt-1">.PNG, .MP4, .GLB</div>
                <div className="absolute bottom-0 left-0 h-1 bg-blue-500 w-[65%] transition-all duration-1000" />
                <div className="absolute bottom-1 right-2 text-[8px] font-mono text-blue-400">65% PINNING...</div>
              </div>
            </div>
          </div>
        </div>

        {/* STAGE 2 */}
        <div className="border border-zinc-800 bg-zinc-900/20 rounded-xl overflow-hidden">
          <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-purple-500/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-purple-400" />
            </div>
            <h2 className="text-lg font-bold font-mono tracking-tight">STAGE_2: DEFINING THE ECONOMY (THE VAULT)</h2>
          </div>
          
          <div className="p-6 md:p-8 space-y-12">
            {/* Step 3 */}
            <div className="grid lg:grid-cols-[1fr_350px] gap-8 items-center">
              <div className="relative pl-8 border-l border-zinc-800">
                <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <span className="text-purple-400 font-mono text-sm">STEP 03 //</span> Set Stakeholders
                </h3>
                <p className="text-zinc-400 mb-4 text-sm leading-relaxed">
                  Input the wallet addresses of partners or artists. Assign ownership percentages (Total "Basis Points" must equal 10,000 / 100.00%). This generates your automated Revenue Pool smart contract.
                </p>
              </div>
              {/* Graphic */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3 relative">
                <div className="text-[9px] font-mono text-zinc-500 border-b border-zinc-800 pb-2">VAULT_CONFIG // BASIS_POINTS: 10000</div>
                <div className="flex justify-between items-center text-xs font-mono bg-zinc-900 p-2 rounded">
                  <span className="text-zinc-300">Creator Wallet</span>
                  <span className="text-purple-400 font-bold">65.00%</span>
                </div>
                <div className="flex justify-between items-center text-xs font-mono bg-zinc-900 p-2 rounded border border-purple-500/30">
                  <span className="text-zinc-300">Artist Wallet</span>
                  <span className="text-purple-400 font-bold">15.00%</span>
                </div>
                <div className="flex justify-between items-center text-xs font-mono bg-zinc-900 p-2 rounded">
                  <span className="text-zinc-300">Investor Pool</span>
                  <span className="text-purple-400 font-bold">20.00%</span>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="grid lg:grid-cols-[1fr_350px] gap-8 items-center">
              <div className="relative pl-8 border-l border-zinc-800">
                <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <span className="text-purple-400 font-mono text-sm">STEP 04 //</span> Execute the Mint
                </h3>
                <p className="text-zinc-400 mb-4 text-sm leading-relaxed">
                  Click <span className="text-zinc-200 font-mono bg-zinc-800 px-1 py-0.5 rounded">Mint IP Asset</span>. Your wallet will prompt you to sign the transaction, creating your Algorand Standard Asset (ASA).
                </p>
              </div>
              {/* Graphic */}
              <div className="bg-zinc-950 border border-purple-500/50 rounded-lg p-6 relative flex flex-col items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.1)]">
                <div className="text-xs text-zinc-400 mb-4 font-mono">Sign txn: ALGO_MAINNET</div>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white w-full shadow-[0_0_20px_rgba(168,85,247,0.4)] relative">
                  <Cpu className="mr-2 h-4 w-4" /> Execute Mint
                  <MousePointer2 className="absolute -bottom-4 -right-2 h-6 w-6 text-zinc-300 drop-shadow-lg" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* STAGE 3 */}
        <div className="border border-zinc-800 bg-zinc-900/20 rounded-xl overflow-hidden">
          <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-amber-500/10 flex items-center justify-center">
              <Store className="h-4 w-4 text-amber-400" />
            </div>
            <h2 className="text-lg font-bold font-mono tracking-tight">STAGE_3: GO-TO-MARKET</h2>
          </div>
          
          <div className="p-6 md:p-8">
            <div className="grid lg:grid-cols-[1fr_350px] gap-8 items-center">
              <div className="relative pl-8 border-l border-zinc-800">
                <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <span className="text-amber-400 font-mono text-sm">STEP 05 //</span> Manage Sales & Licensing
                </h3>
                <p className="text-zinc-400 mb-6 text-sm leading-relaxed">
                  Navigate to <span className="text-zinc-200 font-mono bg-zinc-800 px-1 py-0.5 rounded">Manage IP Assets</span>. Activate your Aisle, set pricing logic, and decide if external creators can curate your products for a commission.
                </p>
              </div>
              {/* Graphic */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono text-zinc-300">Aisle Status</span>
                  <ToggleRight className="h-8 w-8 text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono text-zinc-300">Base USDC Price</span>
                  <span className="text-sm font-mono text-zinc-100 bg-zinc-800 px-2 py-1 rounded">$24.00</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono text-zinc-300">Allow Curation</span>
                  <ToggleRight className="h-8 w-8 text-amber-500" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STAGE 4 */}
        <div className="border border-emerald-500/30 bg-emerald-950/10 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.05)] mb-8">
          <div className="bg-emerald-950/30 border-b border-emerald-500/20 px-6 py-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-emerald-500/20 flex items-center justify-center">
              <Coins className="h-4 w-4 text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold font-mono tracking-tight text-emerald-50">STAGE_4: AUTOMATED REVENUE</h2>
          </div>
          
          <div className="p-6 md:p-8 space-y-12">
            {/* Step 6 */}
            <div className="grid lg:grid-cols-[1fr_350px] gap-8 items-center">
              <div className="relative pl-8 border-l border-emerald-500/30">
                <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <span className="text-emerald-400 font-mono text-sm">STEP 06 //</span> Payout Rounds (Oracle)
                </h3>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  <strong>Zero action required.</strong> Our backend Oracle takes a snapshot of token holders upon sale, calculates USDC fractions, and injects data into an on-chain Round Box.
                </p>
              </div>
              {/* Graphic */}
              <div className="bg-black border border-emerald-500/30 rounded-lg p-4 font-mono text-[10px] text-emerald-500/70 h-32 overflow-hidden relative">
                <div className="opacity-50">
                  <p>&gt; sale_detected: txn_id_8f73b...</p>
                  <p>&gt; fetching_snapshot_v2...</p>
                  <p>&gt; calc_split [6500, 1500, 2000]</p>
                  <p className="text-emerald-400">&gt; routing_funds_to_round_box...</p>
                  <p className="text-emerald-400">&gt; round_box_sealed: SUCCESS</p>
                </div>
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-black" />
              </div>
            </div>

            {/* Step 7 */}
            <div className="grid lg:grid-cols-[1fr_350px] gap-8 items-center">
              <div className="relative pl-8 border-l border-emerald-500/30">
                <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <span className="text-emerald-400 font-mono text-sm">STEP 07 //</span> Claiming Revenue
                </h3>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  Navigate to your <span className="text-zinc-200 font-mono bg-zinc-800 px-1 py-0.5 rounded">Earnings</span> tab. Click Claim. The contract verifies your address against the Oracle and drops USDC directly into your wallet.
                </p>
              </div>
              {/* Graphic */}
              <div className="bg-emerald-950/20 border border-emerald-500/50 rounded-lg p-6 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.15)] relative">
                <div className="text-sm text-emerald-200/70 mb-1 font-mono">Available Balance</div>
                <div className="text-3xl font-bold text-emerald-400 mb-4 tracking-tighter">$1,204.50 USDC</div>
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-white w-full relative font-bold tracking-widest uppercase text-xs">
                  <Coins className="mr-2 h-4 w-4" /> Claim All
                  <MousePointer2 className="absolute -bottom-4 -right-2 h-6 w-6 text-zinc-300 drop-shadow-lg" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* SUCCESS SCREEN MOCK */}
        <div className="flex flex-col items-center justify-center p-12 bg-zinc-950 border border-emerald-500/20 rounded-2xl relative overflow-hidden mb-16">
          <div className="absolute inset-0 bg-emerald-500/5" />
          <CheckCircle2 className="h-20 w-20 text-emerald-500 mb-6 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)] relative z-10" />
          <h3 className="text-3xl font-bold tracking-tight mb-2 relative z-10 text-white">System Operational.</h3>
          <p className="text-zinc-400 font-mono text-sm relative z-10">Your IP is protected. Your storefront is live. Your economy is automated.</p>
        </div>

        {/* CALL TO ACTION */}
        <div className="text-center max-w-2xl mx-auto space-y-8">
          <h2 className="text-3xl font-bold tracking-tight">Ready to tokenize your ideas?</h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/upload-ip">
              <Button size="lg" className="h-14 px-10 text-lg bg-blue-600 hover:bg-blue-700 rounded-none font-bold shadow-[0_0_30px_rgba(37,99,235,0.3)] w-full sm:w-auto">
                Initialize Workspace
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="h-14 px-10 text-lg border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-none font-mono w-full sm:w-auto">
                <BarChart3 className="mr-2 h-4 w-4" /> Return to Dashboard
              </Button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}