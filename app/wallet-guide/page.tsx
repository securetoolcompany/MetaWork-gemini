'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Terminal, Wallet, Key, Coins, ShieldCheck, 
  ArrowRight, Smartphone, Building2, Zap, Info 
} from 'lucide-react';
import Link from 'next/link';

export default function WalletGuidePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-blue-500/30">
      
      {/* HEADER */}
      <section className="pt-24 pb-16 px-8 border-b border-zinc-800 bg-zinc-900/20 relative overflow-hidden">
        <div className="absolute top-0 right-10 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <Wallet className="h-6 w-6 text-blue-400" />
            <span className="font-mono text-sm text-blue-400 uppercase tracking-[0.3em]">
              Module // Authentication_&_Identity
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tighter mb-6">
            Your Keys to the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Economy.</span>
          </h1>
          <p className="text-zinc-400 text-lg font-light leading-relaxed mb-8">
            To publish products and receive automated payouts on MetaWork, you need a decentralized Wallet. Think of it as a highly secure, digital vault that acts as your login, your bank, and your signature all in one.
          </p>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-8 py-16 space-y-20">
        
        {/* SECTION 1: WHAT IS A WALLET? */}
        <section className="space-y-6">
          <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
            <span className="text-3xl font-mono font-bold text-zinc-700">01</span>
            <h2 className="text-2xl font-bold tracking-tight">The Cryptographic Vault</h2>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-lg">
              <ShieldCheck className="h-8 w-8 text-emerald-400 mb-4" />
              <h3 className="font-bold mb-2">Self-Custody</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                MetaWork does not hold your funds or your IP. Your wallet holds your cryptographic keys, meaning only you have the power to move your money or authorize new designs.
              </p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-lg">
              <Zap className="h-8 w-8 text-amber-400 mb-4" />
              <h3 className="font-bold mb-2">The Gas Fee (0.003 ALGO)</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Every time you mint an IP asset, the Algorand blockchain requires a micro-fee (a fraction of a cent) to process and secure the data permanently. This is a network fee, not a MetaWork fee.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2: INITIALIZATION (GETTING A WALLET) */}
        <section className="space-y-6">
          <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
            <span className="text-3xl font-mono font-bold text-zinc-700">02</span>
            <h2 className="text-2xl font-bold tracking-tight">Initializing Your Wallet</h2>
          </div>
          <p className="text-zinc-400 text-sm">We recommend using mobile-first wallets built specifically for the Algorand ecosystem for the easiest connection process via QR codes.</p>
          
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between p-6 border border-zinc-800 bg-zinc-950 rounded-lg gap-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-yellow-400/10 flex items-center justify-center shrink-0">
                  <Smartphone className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-white">Pera Wallet</h4>
                  <p className="text-sm text-zinc-500">The official, open-source Algorand wallet.</p>
                </div>
              </div>
              <a href="https://perawallet.app/" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 font-mono text-xs uppercase tracking-widest rounded-none">
                  Download Pera
                </Button>
              </a>
            </div>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg flex gap-4 mt-6">
            <Key className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h5 className="font-bold text-red-400 text-sm mb-1">CRITICAL SECURITY WARNING</h5>
              <p className="text-xs text-red-200/70 leading-relaxed">
                When you create your wallet, you will be given a 25-word recovery passphrase. <strong>Write it down on physical paper and hide it.</strong> If you lose this phrase, you lose access to your royalties forever. No one at MetaWork can recover it for you.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 3: FUNDING */}
        <section className="space-y-6">
          <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
            <span className="text-3xl font-mono font-bold text-zinc-700">03</span>
            <h2 className="text-2xl font-bold tracking-tight">Funding with ALGO</h2>
          </div>
          <p className="text-zinc-400 text-sm">To pay the ~0.003 network fee when minting, your wallet needs a small amount of ALGO. We recommend acquiring at least 5-10 ALGO to cover years of transactions.</p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-lg flex flex-col h-full">
              <Building2 className="h-6 w-6 text-blue-400 mb-4 shrink-0" />
              <h4 className="font-bold mb-2">Centralized Exchanges (CEX)</h4>
              <p className="text-xs text-zinc-500 mb-6 leading-relaxed flex-grow">
                The most cost-effective way to buy ALGO. Purchase with your bank account, then withdraw it to your Pera wallet address. <br/><br/>
                <strong className="text-zinc-300">Recommendation:</strong> We suggest using <a href="https://www.kraken.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Kraken</a>. Because it operates as a fully chartered bank in the US, it offers an additional layer of regulatory compliance and institutional security.
              </p>
              <div className="flex gap-2 flex-wrap mt-auto">
                <a href="https://www.kraken.com" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors rounded text-[10px] font-mono text-blue-400 flex items-center gap-1">
                  Kraken <ArrowRight className="h-3 w-3" />
                </a>
                <a href="https://www.coinbase.com" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors rounded text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                  Coinbase <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-lg flex flex-col h-full">
              <Coins className="h-6 w-6 text-amber-400 mb-4 shrink-0" />
              <h4 className="font-bold mb-2">Direct In-App On-Ramps</h4>
              <p className="text-xs text-zinc-500 mb-6 leading-relaxed flex-grow">
                Wallets like Pera allow you to buy ALGO directly inside the app using a debit or credit card via integrated third-party providers. This is the fastest method, but it carries higher processing fees from the providers.
              </p>
              <div className="flex gap-2 flex-wrap mt-auto">
                <a href="https://www.moonpay.com/" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors rounded text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                  MoonPay <ArrowRight className="h-3 w-3" />
                </a>
                <a href="https://www.sardine.ai/" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors rounded text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                  Sardine <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          {/* DISCLAIMER */}
          <div className="mt-4 p-4 border border-zinc-800/50 bg-black rounded-lg flex items-start gap-3">
            <Info className="h-4 w-4 text-zinc-600 shrink-0 mt-0.5" />
            <p className="text-[10px] font-mono text-zinc-600 leading-relaxed uppercase tracking-widest">
              Disclaimer: MetaWork is not affiliated with Kraken, Coinbase, MoonPay, Sardine, or Pera Wallet. We do not provide financial advice. Cryptocurrency transactions are irreversible. Always verify destination addresses before withdrawing funds from an exchange to your self-custody wallet.
            </p>
          </div>
        </section>

      </main>

      {/* FOOTER CTA */}
      <section className="border-t border-zinc-800 bg-zinc-900/50 py-16 text-center px-8">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Ready to initialize?</h2>
        <p className="text-zinc-500 text-sm mb-8">Once your wallet is funded, you can return to the design terminal and mint your IP.</p>
        <Link href="/products/creator">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-none px-8 font-bold uppercase tracking-tighter shadow-[0_0_20px_rgba(37,99,235,0.3)]">
            Return to Design Terminal <Terminal className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </section>
    </div>
  );
}