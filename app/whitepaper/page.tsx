'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Terminal, FileText, FolderOpen, ChevronRight, 
  ShieldCheck, Database, Zap, ArrowRight, Lock,
  Globe, Users, Cpu, FileCode2, Network
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function WhitepaperViewer() {
  const [activeChapter, setActiveChapter] = useState('01');

  // Whitepaper Content Data Structure
  const chapters = [
    {
      id: '01',
      filename: '01_executive_summary.md',
      title: 'Executive Summary',
      icon: <Terminal className="h-4 w-4" />,
      content: (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-zinc-100">1. Executive Summary</h2>
          <p className="text-zinc-400 leading-relaxed">
            MetaWork is a blockchain-powered platform designed to democratize global economic opportunities. By addressing systemic barriers to financial inclusion and employment, MetaWork empowers individuals to earn income, own assets, and manage resources securely.
          </p>
          <p className="text-zinc-400 leading-relaxed">
            This Whitepaper highlights the platform's features, real-world applications, and competitive advantages, showcasing why MetaWork is a transformative solution for investors, creators, and workers worldwide. We replace centralized gatekeepers with cryptographic trust, transforming the global supply chain into an open-access protocol.
          </p>
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded font-mono text-sm text-emerald-400 mt-6">
            &gt; SYSTEM_GOAL: Eradicate economic exclusion via decentralized infrastructure.
          </div>
        </div>
      )
    },
    {
      id: '02',
      filename: '02_the_problem.md',
      title: 'The Global Problem',
      icon: <Globe className="h-4 w-4" />,
      content: (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-zinc-100">2. Barriers to Economic Opportunity</h2>
          <p className="text-zinc-400 leading-relaxed">
            Despite advancements in technology, significant global challenges persist that lock billions out of the modern economy.
          </p>
          <ul className="space-y-4 mt-6">
            <li className="flex items-start gap-4">
              <span className="text-red-500 mt-1">[!]</span>
              <div>
                <strong className="text-zinc-200">Financial Exclusion:</strong>
                <p className="text-zinc-400 text-sm mt-1">Over 1.7 billion adults globally remain unbanked as of 2023. Without access to banks, they cannot save, invest, or transact securely.</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="text-red-500 mt-1">[!]</span>
              <div>
                <strong className="text-zinc-200">Extreme Poverty:</strong>
                <p className="text-zinc-400 text-sm mt-1">The average daily wage of workers in low-income countries is estimated at just $3.70 per day—far below the UN's poverty threshold of $6.85. Nearly 40% of workers in these countries live in extreme poverty.</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="text-red-500 mt-1">[!]</span>
              <div>
                <strong className="text-zinc-200">Youth Unemployment:</strong>
                <p className="text-zinc-400 text-sm mt-1">Global youth unemployment sits at 15.6%, leaving a generation of digitally native individuals without viable pathways to monetization.</p>
              </div>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: '03',
      filename: '03_the_solution.md',
      title: 'The MetaWork Solution',
      icon: <ShieldCheck className="h-4 w-4" />,
      content: (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-zinc-100">3. A Decentralized, Inclusive Platform</h2>
          <p className="text-zinc-400 leading-relaxed">
            Poverty is not a resource problem; it is an access problem. MetaWork executes the Universal Access Protocol through four distinct pillars:
          </p>
          <div className="grid sm:grid-cols-2 gap-6 mt-6">
            <div className="bg-zinc-900/50 p-6 border border-zinc-800">
              <h4 className="text-emerald-400 font-bold mb-2">Access to Work</h4>
              <p className="text-sm text-zinc-400">Breaking down geographical borders. Users anywhere can access MetaJobs, complete digital tasks, and earn crypto instantly.</p>
            </div>
            <div className="bg-zinc-900/50 p-6 border border-zinc-800">
              <h4 className="text-blue-400 font-bold mb-2">Access to Ownership</h4>
              <p className="text-sm text-zinc-400">Through Algorand tokenization, we transform art, physical businesses, and digital IP into verifiable, fractionalized assets.</p>
            </div>
            <div className="bg-zinc-900/50 p-6 border border-zinc-800">
              <h4 className="text-amber-400 font-bold mb-2">Access to Tools</h4>
              <p className="text-sm text-zinc-400">A smartphone is the only hardware required. We provide a full suite of business tools, from global manufacturing to automated smart contracts.</p>
            </div>
            <div className="bg-zinc-900/50 p-6 border border-zinc-800">
              <h4 className="text-purple-400 font-bold mb-2">Access to Training</h4>
              <p className="text-sm text-zinc-400">MetaWork Academy integrates vocational-style educational modules, equipping users with the digital literacy required to thrive.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: '04',
      filename: '04_key_features.md',
      title: 'Key Functionality',
      icon: <Cpu className="h-4 w-4" />,
      content: (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-zinc-100">4. Engine Features & Infrastructure</h2>
          <p className="text-zinc-400 leading-relaxed mb-6">
            MetaWork replaces Web2 SaaS subscriptions with a unified, blockchain-native utility belt.
          </p>
          
          <div className="space-y-8">
            <div>
              <h4 className="text-xl font-bold text-zinc-200 mb-2">Immutable Metadata (IPFS)</h4>
              <p className="text-zinc-400 text-sm leading-relaxed">
                When you upload IP or design a product, the data is cryptographically hashed and pinned to the InterPlanetary File System (IPFS). This ensures your source files and SEO metadata can never be altered or deleted by a central authority.
              </p>
            </div>
            <div>
              <h4 className="text-xl font-bold text-zinc-200 mb-2">Smart Contract Settlement (TEAL)</h4>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Margin control is programmable money. We utilize Algorand Smart Contracts to codify your pricing logic. Upon checkout, the payment is instantly fractured. The manufacturer, the IP artist, and the seller receive their exact splits simultaneously.
              </p>
            </div>
            <div>
              <h4 className="text-xl font-bold text-zinc-200 mb-2">Quantum-Safe Ledger</h4>
              <p className="text-zinc-400 text-sm leading-relaxed">
                We mint exclusively on the Algorand blockchain. Featuring advanced cryptographic protocols, your tokenized assets and revenue streams are protected against future quantum-computing threats.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: '05',
      filename: '05_use_cases.md',
      title: 'Real-World Use Cases',
      icon: <Users className="h-4 w-4" />,
      content: (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-zinc-100">5. MetaWork in Action</h2>
          <p className="text-zinc-400 leading-relaxed">
            The protocol adapts to the user, not the other way around. Here is how different sectors utilize the network:
          </p>
          <ul className="space-y-6 mt-6">
            <li className="p-4 border-l-2 border-emerald-500 bg-zinc-900/30">
              <strong className="text-emerald-400 block mb-1">The Creator (Nigeria)</strong>
              <p className="text-sm text-zinc-400">Mints digital artwork to the IP vault. A boutique in Berlin licenses the art for a t-shirt line. The creator earns USDC royalties instantly while they sleep, without ever dealing with international wire transfers.</p>
            </li>
            <li className="p-4 border-l-2 border-blue-500 bg-zinc-900/30">
              <strong className="text-blue-400 block mb-1">The Gym Owner (USA)</strong>
              <p className="text-sm text-zinc-400">Tokenizes 15% of the gym's merchandise revenue pool to raise capital for new mats. Gym members buy the tokens, funding the expansion while earning a micro-yield every time a hoodie is sold.</p>
            </li>
            <li className="p-4 border-l-2 border-amber-500 bg-zinc-900/30">
              <strong className="text-amber-400 block mb-1">The Student (India)</strong>
              <p className="text-sm text-zinc-400">Completes global MetaJob surveys and data tagging. Earns crypto directly to their phone to pay for tuition, bypassing predatory remittance fees.</p>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: '06',
      filename: '06_competitive_landscape.md',
      title: 'Competitive Landscape',
      icon: <Network className="h-4 w-4" />,
      content: (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-zinc-100">6. Why MetaWork Stands Out</h2>
          <p className="text-zinc-400 leading-relaxed">
            Legacy Web2 marketplaces (Amazon, Etsy, Shopify) treat creators as renters. MetaWork treats creators as owners.
          </p>
          
          <div className="grid md:grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 mt-8">
            <div className="bg-zinc-950 p-6">
              <h4 className="text-red-400 font-bold mb-4 font-mono">LEGACY_WEB2</h4>
              <ul className="space-y-3 text-sm text-zinc-400">
                <li>- 15% to 25% predatory listing fees.</li>
                <li>- Platform owns and hides customer data.</li>
                <li>- Algorithms suppress original goods in favor of cheap knock-offs.</li>
                <li>- 30-day payout holding periods.</li>
              </ul>
            </div>
            <div className="bg-zinc-900/80 p-6">
              <h4 className="text-emerald-400 font-bold mb-4 font-mono">METAWORK_PROTOCOL</h4>
              <ul className="space-y-3 text-sm text-zinc-400">
                <li>- Zero listing fees. You set the exact margin.</li>
                <li>- Cryptographic attribution & complete ownership of traffic.</li>
                <li>- Cross-pollination via localized Aisles.</li>
                <li>- Instantaneous, algorithmic payout settlement.</li>
              </ul>
            </div>
          </div>
        </div>
      )
    }
  ];

  const activeContent = chapters.find(c => c.id === activeChapter);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-emerald-500/30 font-sans">
      
      {/* HEADER OVERLAY */}
      <div className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-mono text-zinc-400 hidden sm:inline-block">root@metawork:/docs/whitepaper</span>
            <span className="text-xs font-mono text-zinc-400 sm:hidden">/whitepaper</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500">
            <span className="flex items-center gap-1"><Lock className="h-3 w-3 text-emerald-500" /> v2.0.4</span>
            <Link href="/tools" className="hover:text-emerald-400 transition-colors hidden sm:inline-block">EXIT_DOCS</Link>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row max-w-[1400px] mx-auto w-full">
        
        {/* SIDEBAR: FILE DIRECTORY */}
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-950/50 flex-shrink-0">
          <div className="p-6 border-b border-zinc-800">
            <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <FolderOpen className="h-4 w-4" /> DIRECTORY_TREE
            </h2>
          </div>
          <nav className="p-4 space-y-1">
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                onClick={() => setActiveChapter(chapter.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-3 rounded-md text-sm transition-all text-left font-mono",
                  activeChapter === chapter.id 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 border border-transparent"
                )}
              >
                <div className="flex items-center gap-3">
                  <FileCode2 className={cn("h-4 w-4 shrink-0", activeChapter === chapter.id ? "text-emerald-400" : "text-zinc-600")} />
                  <span className="truncate">{chapter.filename}</span>
                </div>
                {activeChapter === chapter.id && <ChevronRight className="h-4 w-4" />}
              </button>
            ))}
          </nav>
        </aside>

        {/* MAIN CONTENT: TERMINAL VIEWER */}
        <main className="flex-1 p-4 md:p-8 lg:p-12 xl:p-16 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-zinc-950 to-zinc-950">
          <div className="max-w-3xl">
            
            {/* Document Header */}
            <div className="mb-12 pb-6 border-b border-zinc-800 flex items-end justify-between">
              <div>
                <div className="text-emerald-500 text-[10px] font-mono mb-2 uppercase tracking-widest">
                  READING_FILE: {activeContent?.filename}
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-100">
                  {activeContent?.title}
                </h1>
              </div>
              <div className="hidden md:block h-12 w-12 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                {activeContent?.icon}
              </div>
            </div>

            {/* Document Body */}
            <div className="prose prose-invert prose-emerald max-w-none">
              {activeContent?.content}
            </div>

            {/* Pagination / Next File */}
            <div className="mt-20 pt-8 border-t border-zinc-800 flex justify-between items-center">
              {parseInt(activeChapter) > 1 ? (
                <button 
                  onClick={() => setActiveChapter(String(parseInt(activeChapter) - 1).padStart(2, '0'))}
                  className="text-sm font-mono text-zinc-500 hover:text-emerald-400 transition-colors"
                >
                  &lt; PREV_FILE
                </button>
              ) : <div />}

              {parseInt(activeChapter) < chapters.length ? (
                <button 
                  onClick={() => setActiveChapter(String(parseInt(activeChapter) + 1).padStart(2, '0'))}
                  className="text-sm font-mono text-emerald-500 hover:text-emerald-300 transition-colors flex items-center gap-2"
                >
                  NEXT_FILE <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <Link href="/register">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono rounded-none">
                    Initialize Workspace
                  </Button>
                </Link>
              )}
            </div>

          </div>
        </main>
      </div>

    </div>
  );
}