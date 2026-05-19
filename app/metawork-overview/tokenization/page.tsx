'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import {
  Terminal, ArrowRight, Layers, Coins,
  PieChart, Zap, Lock, GitBranch, TrendingUp
} from 'lucide-react';
import Link from 'next/link';

export default function TokenizationPage() {
  const processNodes = [
    {
      id: 'NODE_01',
      status: 'PREREQUISITE',
      icon: <Layers className="h-5 w-5 text-cyan-400" />,
      title: 'Authenticated IP Required',
      desc: 'Only minted IP assets can be tokenized. The ASA must exist on-chain before revenue parameters can be attached.',
      log: '[SYS] ASA_VERIFIED',
      color: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400',
    },
    {
      id: 'NODE_02',
      status: 'CONFIGURATION',
      icon: <PieChart className="h-5 w-5 text-purple-400" />,
      title: 'Split Configuration',
      desc: 'Define royalty splits between stakeholders — creator, collaborators, and the platform pool — encoded directly into the smart contract.',
      log: '[SYS] SPLITS_DEFINED',
      color: 'border-purple-500/20 bg-purple-500/10 text-purple-400',
    },
    {
      id: 'NODE_03',
      status: 'SUPPLY',
      icon: <GitBranch className="h-5 w-5 text-blue-400" />,
      title: 'Fractional Supply',
      desc: 'Set the total token supply representing your IP. Each unit represents a fractional ownership share eligible for yield distribution.',
      log: '[SYS] SUPPLY_LOCKED',
      color: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
    },
    {
      id: 'NODE_04',
      status: 'CONTRACT',
      icon: <Zap className="h-5 w-5 text-yellow-400" />,
      title: 'Smart Contract Deploy',
      desc: 'Royalty logic, escrow routes, and payout triggers are compiled and deployed to Algorand. Self-executing. No intermediaries.',
      log: '[TXN] CONTRACT_DEPLOYED',
      color: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400',
    },
    {
      id: 'NODE_05',
      status: 'LIVE_YIELD',
      icon: <TrendingUp className="h-5 w-5 text-green-400" />,
      title: 'Yield Activation',
      desc: 'The tokenized IP enters the MetaWork ecosystem. Every commercial activity triggers instant, automatic royalty routing to stakeholder wallets.',
      log: '[SYS] ASSET_YIELDING: TRUE',
      color: 'border-green-500/20 bg-green-500/10 text-green-400',
    },
  ];

  return (
    <div className="min-h-screen bg-[#131722] text-white selection:bg-purple-500/30 font-sans pb-24">

      {/* 1. HEADER */}
      <section className="px-6 pt-24 pb-16 max-w-[1600px] mx-auto w-full border-b border-white/5">
        <div className="max-w-5xl">
          <div className="flex items-center gap-3 mb-6">
            <Terminal className="h-4 w-4 text-purple-500" />
            <span className="font-mono text-[10px] text-slate-500 uppercase tracking-[0.3em]">
              System Architecture // Revenue_Protocol
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter uppercase mb-6 text-white">
            Revenue <br />
            <span className="text-purple-400">Tokenization.</span>
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed font-mono max-w-3xl mb-10 uppercase tracking-widest">
            Tokenization turns authenticated IP into a yield-bearing asset. Configure royalty splits,
            set fractional supply, and deploy smart contract logic that automatically routes revenue
            to every stakeholder — forever.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/tokenize-ip">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-none px-8 uppercase tracking-tighter shadow-lg shadow-purple-900/20">
                Tokenize My IP
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/metawork-overview/minting-process">
              <Button variant="outline" size="lg" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-none px-8 text-xs uppercase font-mono tracking-widest bg-transparent">
                ← First: Mint Authentication
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. WHAT TOKENIZATION ADDS */}
      <section className="px-6 py-16 max-w-[1600px] mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-300">What Tokenization Adds</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-black border border-white/10 p-8 rounded-xl hover:border-purple-500/50 transition-all group flex flex-col">
            <div className="h-12 w-12 rounded-lg bg-[#131722] flex items-center justify-center mb-6 border border-white/5 group-hover:border-purple-500/30 transition-colors">
              <PieChart className="h-6 w-6 text-purple-400" />
            </div>
            <h4 className="font-black text-sm uppercase tracking-widest mb-3 text-white">Royalty Splits</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Define exactly who gets what percentage. Splits are encoded in the smart contract — no manual payments, no disputes, no delays.
            </p>
          </div>
          <div className="bg-black border border-white/10 p-8 rounded-xl hover:border-yellow-500/50 transition-all group flex flex-col">
            <div className="h-12 w-12 rounded-lg bg-[#131722] flex items-center justify-center mb-6 border border-white/5 group-hover:border-yellow-500/30 transition-colors">
              <Zap className="h-6 w-6 text-yellow-400" />
            </div>
            <h4 className="font-black text-sm uppercase tracking-widest mb-3 text-white">Automatic Yield</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              The instant commercial activity occurs, the contract executes. Earnings are deposited to stakeholder wallets without any manual action required.
            </p>
          </div>
          <div className="bg-black border border-white/10 p-8 rounded-xl hover:border-green-500/50 transition-all group flex flex-col">
            <div className="h-12 w-12 rounded-lg bg-[#131722] flex items-center justify-center mb-6 border border-white/5 group-hover:border-green-500/30 transition-colors">
              <Coins className="h-6 w-6 text-green-400" />
            </div>
            <h4 className="font-black text-sm uppercase tracking-widest mb-3 text-white">Fractional Ownership</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Divide your IP into tradeable fractional tokens. Each token represents a stake in the revenue stream — transferable and market-priced.
            </p>
          </div>
        </div>
      </section>

      {/* 3. PIPELINE */}
      <section className="px-6 py-16 max-w-[1600px] mx-auto border-t border-white/5">
        <div className="mb-12 flex items-center justify-between">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-300">Tokenization Pipeline</h2>
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
            <CardTitle className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Live Telemetry // Yield_Monitor</CardTitle>
            <span className="flex items-center gap-2 text-[9px] font-mono text-green-400 uppercase">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Network Sync
            </span>
          </div>
          <div className="p-6 font-mono text-[11px] text-slate-400 leading-relaxed flex-grow overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black pointer-events-none z-10" />
            <p className="text-slate-500">Loading authenticated ASA-8891...</p>
            <p className="text-cyan-400">[OK] Minted asset confirmed on-chain.</p>
            <p className="text-slate-500">Constructing revenue contract logic...</p>
            <p className="text-slate-400 ml-4">&gt; Total Supply: 10,000 tokens</p>
            <p className="text-slate-400 ml-4">&gt; Creator Split: 70%</p>
            <p className="text-slate-400 ml-4">&gt; Collaborator: 20%</p>
            <p className="text-slate-400 ml-4">&gt; Platform Pool: 10%</p>
            <p className="text-slate-400 ml-4">&gt; Escrow Route: META.POOL.A</p>
            <br />
            <p className="text-slate-500">Compiling smart contract...</p>
            <p className="text-slate-500">Deploying to Algorand Mainnet...</p>
            <p className="text-green-400 font-bold mt-2">[TXN] CONTRACT DEPLOYED: APP-4421.</p>
            <p className="text-green-400 font-bold">[SYS] ASSET_YIELDING: TRUE</p>
            <p className="text-slate-500 animate-pulse mt-2">_</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded">
            <Lock className="h-3 w-3 text-purple-400" />
            <span className="font-mono text-[9px] font-bold text-purple-400 uppercase tracking-widest">Smart Contract Ready</span>
          </div>

          <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white">
            Lock In Your <br />
            <span className="text-purple-400">Legacy.</span>
          </h2>

          <p className="text-sm text-slate-400 leading-relaxed font-mono max-w-md">
            Configure your splits once. The contract executes forever. Every sale, every license,
            every commercial use — revenue routes automatically to every stakeholder.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link href="/tokenize-ip">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-none px-10 py-6 uppercase tracking-tighter shadow-lg shadow-purple-900/20 text-lg">
                <Layers className="mr-3 h-5 w-5" />
                Tokenize My IP
              </Button>
            </Link>
            <Link href="/metawork-overview/minting-process">
              <Button variant="outline" size="lg" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-none px-8 text-xs uppercase font-mono tracking-widest bg-transparent">
                ← Mint First
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}