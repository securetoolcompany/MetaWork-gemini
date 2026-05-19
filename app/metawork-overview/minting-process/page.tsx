'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import {
  Cpu, Terminal, ArrowRight, Database,
  ShieldCheck, Fingerprint, Lock, Network, FileCheck
} from 'lucide-react';
import Link from 'next/link';

export default function MintingProcess() {
  const processNodes = [
    {
      id: 'NODE_01',
      status: 'INGESTION',
      icon: <Database className="h-5 w-5 text-purple-400" />,
      title: 'Data Payload Parsing',
      desc: 'Raw intellectual property data is ingested, encrypted, and compiled into a secure metadata matrix ready for chain inscription.',
      log: '[SYS] METADATA_COMPILED',
      color: 'border-purple-500/20 bg-purple-500/10 text-purple-400',
    },
    {
      id: 'NODE_02',
      status: 'IPFS PIN',
      icon: <Network className="h-5 w-5 text-blue-400" />,
      title: 'Decentralized Storage',
      desc: 'Metadata and source files are cryptographically hashed and pinned to the InterPlanetary File System. Permanent, tamper-proof, and server-independent.',
      log: '[SYS] CID_ASSIGNED',
      color: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
    },
    {
      id: 'NODE_03',
      status: 'VERIFICATION',
      icon: <ShieldCheck className="h-5 w-5 text-cyan-400" />,
      title: 'Provenance Check',
      desc: 'Ownership provenance is validated. Automated compliance nodes cross-check against global IP registries before any on-chain write.',
      log: '[SYS] PROVENANCE_VERIFIED',
      color: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400',
    },
    {
      id: 'NODE_04',
      status: 'EXECUTION',
      icon: <Cpu className="h-5 w-5 text-green-400" />,
      title: 'On-Chain Deployment',
      desc: 'The asset is formally minted onto the Algorand network as an ASA, establishing immutable, cryptographically permanent proof of ownership.',
      log: '[TXN] ASA_GENERATED',
      color: 'border-green-500/20 bg-green-500/10 text-green-400',
    },
    {
      id: 'NODE_05',
      status: 'COMPLETE',
      icon: <Fingerprint className="h-5 w-5 text-zinc-400" />,
      title: 'Identity Locked',
      desc: 'The asset receives a permanent on-chain identity. Ownership is immutably attributed. The IP is now provably yours, forever.',
      log: '[SYS] ASSET_AUTHENTICATED: TRUE',
      color: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
    },
  ];

  return (
    <div className="min-h-screen bg-[#131722] text-white selection:bg-cyan-500/30 font-sans pb-24">

      {/* 1. HEADER */}
      <section className="px-6 pt-24 pb-16 max-w-[1600px] mx-auto w-full border-b border-white/5">
        <div className="max-w-5xl">
          <div className="flex items-center gap-3 mb-6">
            <Terminal className="h-4 w-4 text-cyan-500" />
            <span className="font-mono text-[10px] text-slate-500 uppercase tracking-[0.3em]">
              System Architecture // Authentication_Protocol
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter uppercase mb-6 text-white">
            IP Minting <br />
            <span className="text-cyan-400">Authentication.</span>
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed font-mono max-w-3xl mb-10 uppercase tracking-widest">
            Minting is proof of ownership — nothing more, nothing less. Register your intellectual
            property on-chain as an immutable Algorand Standard Asset. Establish provenance before
            anyone else can.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/upload-ip">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-none px-8 uppercase tracking-tighter shadow-lg shadow-blue-900/20">
                Authenticate My IP
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/metawork-overview/tokenization">
              <Button variant="outline" size="lg" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-none px-8 text-xs uppercase font-mono tracking-widest bg-transparent">
                Next: Revenue Tokenization →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. WHAT MINTING IS / ISN'T */}
      <section className="px-6 py-16 max-w-[1600px] mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-300">What Minting Does</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-black border border-white/10 p-8 rounded-xl hover:border-cyan-500/50 transition-all group flex flex-col">
            <div className="h-12 w-12 rounded-lg bg-[#131722] flex items-center justify-center mb-6 border border-white/5 group-hover:border-cyan-500/30 transition-colors">
              <Fingerprint className="h-6 w-6 text-cyan-400" />
            </div>
            <h4 className="font-black text-sm uppercase tracking-widest mb-3 text-white">Proves Ownership</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Creates an immutable on-chain record attributing the IP to your wallet address. Timestamped, permanent, and globally verifiable.
            </p>
          </div>
          <div className="bg-black border border-white/10 p-8 rounded-xl hover:border-purple-500/50 transition-all group flex flex-col">
            <div className="h-12 w-12 rounded-lg bg-[#131722] flex items-center justify-center mb-6 border border-white/5 group-hover:border-purple-500/30 transition-colors">
              <Network className="h-6 w-6 text-purple-400" />
            </div>
            <h4 className="font-black text-sm uppercase tracking-widest mb-3 text-white">Pins to IPFS</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Your IP metadata and source files are stored on a decentralized network. No central server can delete or modify them.
            </p>
          </div>
          <div className="bg-black border border-white/10 p-8 rounded-xl hover:border-green-500/50 transition-all group flex flex-col">
            <div className="h-12 w-12 rounded-lg bg-[#131722] flex items-center justify-center mb-6 border border-white/5 group-hover:border-green-500/30 transition-colors">
              <FileCheck className="h-6 w-6 text-green-400" />
            </div>
            <h4 className="font-black text-sm uppercase tracking-widest mb-3 text-white">Enables What's Next</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              A minted asset can then be tokenized for revenue sharing. You must authenticate before you can monetize.
            </p>
          </div>
        </div>
      </section>

      {/* 3. EXECUTION PIPELINE */}
      <section className="px-6 py-16 max-w-[1600px] mx-auto border-t border-white/5">
        <div className="mb-12 flex items-center justify-between">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-300">Authentication Pipeline</h2>
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
              <div className="mb-4">{node.icon}</div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-2 text-white">{node.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed flex-grow font-mono mb-6">{node.desc}</p>
              <div className="mt-auto pt-4 border-t border-white/5 font-mono text-[10px] text-slate-400">
                {node.log}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. TERMINAL + CTA */}
      <section className="px-6 py-16 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="bg-black border border-white/10 rounded-xl overflow-hidden h-[420px] flex flex-col shadow-2xl">
          <div className="py-3 px-4 border-b border-white/5 bg-slate-950 flex justify-between items-center">
            <CardTitle className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Live Telemetry // Mint_Monitor</CardTitle>
            <span className="flex items-center gap-2 text-[9px] font-mono text-green-400 uppercase">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Network Sync
            </span>
          </div>
          <div className="p-6 font-mono text-[11px] text-slate-400 leading-relaxed flex-grow overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black pointer-events-none z-10" />
            <p className="text-slate-500">Initializing secure connection to Algorand node...</p>
            <p className="text-cyan-400">[OK] Mainnet connection established.</p>
            <p className="text-slate-500">Receiving IP payload...</p>
            <p className="text-purple-400">Hashing: /ip/design/blueprint_v4.obj → SHA-256</p>
            <p className="text-slate-500">Pinning to IPFS cluster...</p>
            <p className="text-cyan-400">[SYS] CID: QmYwAPJzv5CZsnA625s3Xf2sm5Dya</p>
            <br />
            <p className="text-slate-500">Running provenance check...</p>
            <p className="text-cyan-400">[OK] No prior claims found on registry.</p>
            <p className="text-slate-500">Broadcasting ASA creation to Algorand Mainnet...</p>
            <p className="text-slate-500">Awaiting block confirmation...</p>
            <p className="text-green-400 font-bold mt-2">[TXN] SUCCESS: ASA-8891 MINTED.</p>
            <p className="text-green-400 font-bold">[SYS] OWNERSHIP AUTHENTICATED ON-CHAIN.</p>
            <p className="text-slate-500 animate-pulse mt-2">_</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded">
            <Lock className="h-3 w-3 text-cyan-400" />
            <span className="font-mono text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Algorand Mainnet Ready</span>
          </div>

          <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white">
            Your IP. <br />
            <span className="text-cyan-400">Proven.</span>
          </h2>

          <p className="text-sm text-slate-400 leading-relaxed font-mono max-w-md">
            The blockchain is the ultimate source of truth. Mint your IP to establish immutable
            provenance. Once authenticated, you can tokenize it for revenue sharing.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link href="/upload-ip">
              <Button size="lg" className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-none px-10 py-6 uppercase tracking-tighter shadow-lg shadow-cyan-900/20 text-lg">
                <Fingerprint className="mr-3 h-5 w-5" />
                Authenticate My IP
              </Button>
            </Link>
            <Link href="/metawork-overview/tokenization">
              <Button variant="outline" size="lg" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-none px-8 text-xs uppercase font-mono tracking-widest bg-transparent">
                How Tokenization Works →
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}