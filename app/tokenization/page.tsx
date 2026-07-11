import { Coins, Layers, Eye, Scale } from 'lucide-react';

export default function TokenizationPage() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white selection:bg-blue-500/30">
      <section className="pt-32 pb-20 px-8 text-center bg-gradient-to-b from-blue-950/20 to-black">
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 italic uppercase">
          What is <span className="text-blue-500">Tokenization?</span>
        </h1>
        <p className="text-2xl text-slate-400 font-light max-w-3xl mx-auto">
          Turning real-world value into digital assets anyone can own.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-8 py-20 grid md:grid-cols-2 gap-8">
        <div className="bg-slate-900/50 border border-white/10 p-10 rounded-3xl">
          <div className="h-12 w-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-6">
            <Coins className="text-blue-400" />
          </div>
          <h3 className="text-2xl font-bold mb-4">Simple Definition</h3>
          <p className="text-slate-400 leading-relaxed text-lg">
            Tokenization is the process of turning real-world value into digital tokens on a blockchain. A token works like a digital receipt that proves you own something or have rights to a share of its income.
          </p>
        </div>

        <div className="bg-slate-900/50 border border-white/10 p-10 rounded-3xl">
          <div className="h-12 w-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-6">
            <Layers className="text-green-400" />
          </div>
          <h3 className="text-2xl font-bold mb-4">What gets tokenized?</h3>
          <p className="text-slate-400 leading-relaxed text-lg">
            On MetaWork, tokens represent small business revenue, merchandise royalties, or rewards from play-to-earn games. This turns everyday work into investable assets.
          </p>
        </div>
      </section>

      <section className="px-8 py-20 bg-slate-950 border-y border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-12">Why It Matters</h2>
          <div className="grid md:grid-cols-2 gap-12 text-left">
            <div className="flex gap-6">
               <Scale className="text-blue-500 h-10 w-10 shrink-0" />
               <div>
                 <h4 className="text-xl font-bold mb-2">Fractional Ownership</h4>
                 <p className="text-slate-400">Invest very small amounts in high-value assets that were previously inaccessible.</p>
               </div>
            </div>
            <div className="flex gap-6">
               <Eye className="text-green-500 h-10 w-10 shrink-0" />
               <div>
                 <h4 className="text-xl font-bold mb-2">On-Chain Transparency</h4>
                 <p className="text-slate-400">Every transaction and payout is visible and verifiable by anyone at any time.</p>
               </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}