'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Cpu, Settings, Rocket, Terminal, 
  ArrowRight, Database, ShieldCheck, Zap, Lock, Box, Network
} from 'lucide-react';
import Link from 'next/link';

export default function MintingProcess() {
  const processNodes = [
    { 
      id: "NODE_01",
      status: "INGESTION",
      icon: <Database className="h-5 w-5 text-purple-400" />, 
      title: "Data Payload Parsing", 
      desc: "Raw intellectual property and commercial data are ingested, encrypted, and compiled into a secure metadata matrix.",
      log: "[SYS] METADATA_COMPILED",
      color: "border-purple-500/20 bg-purple-500/10 text-purple-400"
    },
    { 
      id: "NODE_02",
      status: "VERIFICATION",
      icon: <ShieldCheck className="h-5 w-5 text-blue-400" />, 
      title: "Consensus & Rights", 
      desc: "System validation of ownership provenance. Automated compliance nodes execute cross-checks against global IP registries.",
      log: "[SYS] PROVENANCE_VERIFIED",
      color: "border-blue-500/20 bg-blue-500/10 text-blue-400"
    },
    { 
      id: "NODE_03",
      status: "EXECUTION",
      icon: <Cpu className="h-5 w-5 text-cyan-400" />, 
      title: "On-Chain Deployment", 
      desc: "The asset is formally minted onto the Algorand network, establishing an immutable, cryptographically permanent state.",
      log: "[TXN] ASA_GENERATED",
      color: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400"
    },
    { 
      id: "NODE_04",
      status: "CONFIGURATION",
      icon: <Settings className="h-5 w-5 text-zinc-400" />, 
      title: "Contract Logic", 
      desc: "Royalty routing, supply parameters, and distribution splits are permanently locked into the smart contract architecture.",
      log: "[SYS] PARAMETERS_LOCKED",
      color: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400"
    },
    { 
      id: "NODE_05",
      status: "LIVE_YIELD",
      icon: <Rocket className="h-5 w-5 text-green-400" />, 
      title: "Global Distribution", 
      desc: "The fractionalized IP enters the MetaWork ecosystem. Smart contracts automatically execute yield routing upon market activity.",
      log: "[SYS] ASSET_YIELDING: TRUE",
      color: "border-green-500/20 bg-green-500/10 text-green-400"
    }
  ];

  return (
    <div className="min-h-screen bg-[#131722] text-white selection:bg-cyan-500/30 font-sans pb-24">
      
      {/* 1. PROTOCOL HEADER */}
      <section className="px-6 pt-24 pb-16 max-w-[1600px] mx-auto w-full border-b border-white/5">
        <div className="max-w-5xl">
          <div className="flex items-center gap-3 mb-6">
            <Terminal className="h-4 w-4 text-cyan-500" />
            <span className="font-mono text-[10px] text-slate-500 uppercase tracking-[0.3em]">System Architecture // Core_Protocol</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter uppercase mb-6 text-white">
            Asset Tokenization <br />
            <span className="text-cyan-400">Protocol.</span>
          </h1>
          
          <p className="text-sm text-slate-400 leading-relaxed font-mono max-w-3xl mb-10 uppercase tracking-widest">
            Minting is the foundational infrastructure of the decentralized economy. Transition physical revenue streams and digital intellectual property into immutable, yield-bearing network assets.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/upload-ip">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-none px-8 uppercase tracking-tighter shadow-lg shadow-blue-900/20">
                Initialize Vault Protocol
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/whitepaper">
              <Button variant="outline" size="lg" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-none px-8 text-xs uppercase font-mono tracking-widest bg-transparent">
                View Architecture Docs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. CORE INFRASTRUCTURE BENTO GRID */}
      <section className="px-6 py-16 max-w-[1600px] mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-300">Infrastructure Specs</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-black border border-white/10 p-8 rounded-xl hover:border-cyan-500/50 transition-all group flex flex-col">
            <div className="h-12 w-12 rounded-lg bg-[#131722] flex items-center justify-center mb-6 border border-white/5 group-hover:border-cyan-500/30 transition-colors">
              <Network className="h-6 w-6 text-cyan-400" />
            </div>
            <h4 className="font-black text-sm uppercase tracking-widest mb-3 text-white">Algorand Mainnet</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Engineered for quantum-proof permanence. Transactions execute in under 3 seconds with absolute finality, bypassing the network congestion and gas-fee volatility of legacy blockchains.
            </p>
          </div>

          <div className="bg-black border border-white/10 p-8 rounded-xl hover:border-purple-500/50 transition-all group flex flex-col">
            <div className="h-12 w-12 rounded-lg bg-[#131722] flex items-center justify-center mb-6 border border-white/5 group-hover:border-purple-500/30 transition-colors">
              <Database className="h-6 w-6 text-purple-400" />
            </div>
            <h4 className="font-black text-sm uppercase tracking-widest mb-3 text-white">IPFS Ledger Storage</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Metadata and high-resolution source files are cryptographically hashed and pinned to the InterPlanetary File System. Decentralized data redundancy immune to central server failures.
            </p>
          </div>

          <div className="bg-black border border-white/10 p-8 rounded-xl hover:border-green-500/50 transition-all group flex flex-col">
            <div className="h-12 w-12 rounded-lg bg-[#131722] flex items-center justify-center mb-6 border border-white/5 group-hover:border-green-500/30 transition-colors">
              <Zap className="h-6 w-6 text-green-400" />
            </div>
            <h4 className="font-black text-sm uppercase tracking-widest mb-3 text-white">Smart Contract Yield</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Self-executing logic parameters dictate royalty routing. The exact millisecond commercial activity occurs within the Aisle, fractions of revenue are instantly deposited into stakeholder wallets.
            </p>
          </div>
        </div>
      </section>

      {/* 3. THE EXECUTION PIPELINE */}
      <section className="px-6 py-16 max-w-[1600px] mx-auto border-t border-white/5">
        <div className="mb-12 flex items-center justify-between">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-300">Execution Pipeline</h2>
          <span className="px-3 py-1 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            System Sequence
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {processNodes.map((node, idx) => (
            <div key={idx} className="bg-black border border-white/10 rounded-xl p-6 flex flex-col relative overflow-hidden group hover:bg-zinc-900/80 transition-colors">
              <div className="flex justify-between items-start mb-6">
                <div className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border ${node.color}`}>
                  {node.status}
                </div>
                <span className="font-mono text-[10px] text-slate-600">{node.id}</span>
              </div>
              
              <div className="mb-4">
                {node.icon}
              </div>
              
              <h3 className="text-sm font-black uppercase tracking-widest mb-2 text-white">{node.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed flex-grow font-mono mb-6">
                {node.desc}
              </p>
              
              <div className="mt-auto pt-4 border-t border-white/5 font-mono text-[10px] text-slate-400">
                {node.log}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. SYSTEM TELEMETRY (TERMINAL) & CTA */}
      <section className="px-6 py-16 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* Terminal Log */}
        <div className="bg-black border border-white/10 rounded-xl overflow-hidden h-[450px] flex flex-col shadow-2xl">
          <div className="py-3 px-4 border-b border-white/5 bg-slate-950 flex justify-between items-center">
            <CardTitle className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Live Telemetry // Node_Monitor</CardTitle>
            <span className="flex items-center gap-2 text-[9px] font-mono text-green-400 uppercase">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Network Sync
            </span>
          </div>
          <div className="p-6 font-mono text-[11px] text-slate-400 leading-relaxed flex-grow overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black pointer-events-none z-10" />
            <p className="text-slate-500">Initializing secure connection to protocol node...</p>
            <p className="text-cyan-400">[OK] Connection established.</p>
            <p className="text-slate-500">Awaiting user asset payload...</p>
            <p className="text-purple-400">Receiving: /ip/design/blueprint_v4.obj</p>
            <p className="text-slate-500">Encrypting and hashing via SHA-256...</p>
            <p className="text-slate-500">Pinning to IPFS cluster...</p>
            <p className="text-cyan-400">[SYS] CID: QmYwAPJzv5CZsnA625s3Xf2sm5Dya</p>
            <br />
            <p className="text-slate-500">Constructing Asset Logic...</p>
            <p className="text-slate-400 ml-4">&gt; Total Units: 10,000</p>
            <p className="text-slate-400 ml-4">&gt; Base Yield: 8.5%</p>
            <p className="text-slate-400 ml-4">&gt; Escrow Route: META.POOL.A</p>
            <br />
            <p className="text-slate-500">Broadcasting transaction to Algorand Mainnet...</p>
            <p className="text-slate-500">Awaiting block validation...</p>
            <p className="text-green-400 font-bold mt-2">[TXN] SUCCESS: ASSET ASA-8891 DEPLOYED.</p>
            <p className="text-green-400 font-bold">[SYS] SYSTEM READY FOR YIELD GENERATION.</p>
            <p className="text-slate-500 animate-pulse mt-2">_</p>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded">
            <Lock className="h-3 w-3 text-purple-400" />
            <span className="font-mono text-[9px] font-bold text-purple-400 uppercase tracking-widest">Cryptography Ready</span>
          </div>
          
          <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white">
            Lock In Your <br />
            <span className="text-purple-400">Legacy.</span>
          </h2>
          
          <p className="text-sm text-slate-400 leading-relaxed font-mono max-w-md">
            The blockchain is the ultimate source of truth. Protect your intellectual property, establish immutable provenance, and begin routing global yield directly to your decentralized vault.
          </p>
          
          <div className="pt-4">
            <Link href="/upload-ip">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-none px-10 py-6 uppercase tracking-tighter shadow-lg shadow-purple-900/20 text-lg">
                <Box className="mr-3 h-5 w-5" />
                Initialize Asset Injection
              </Button>
            </Link>
          </div>
        </div>

      </section>
    </div>
  );
}