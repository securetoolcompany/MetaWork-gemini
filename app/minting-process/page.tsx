import { Sparkles, FileSearch, Cpu, Settings, Rocket } from 'lucide-react';

export default function MintingProcess() {
  const process = [
    { icon: <Sparkles />, title: "What is Minting?", desc: "Converting IP or revenue into digital tokens (NFTs) on the blockchain to verify ownership." },
    { icon: <FileSearch />, title: "Submit & Review", desc: "We verify rights and revenue models to ensure quality and compliance." },
    { icon: <Cpu />, title: "On-Chain Creation", desc: "Minting occurs on the Algorand blockchain for security and energy efficiency." },
    { icon: <Settings />, title: "Set Terms", desc: "Owners define licensing fees and revenue splits inside the smart contract." },
    { icon: <Rocket />, title: "List & Earn", desc: "Revenue is released automatically as sales happen within the ecosystem." }
  ];

  return (
    <div className="bg-black text-white min-h-screen selection:bg-green-500/30">
      <section className="pt-32 pb-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-500/5 blur-[120px] rounded-full" />
        <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter mb-4 italic">THE <span className="text-green-500">MINTING</span> PROCESS</h1>
        <p className="text-slate-400 text-xl">Turn your ideas into on-chain assets.</p>
      </section>

      <section className="px-8 py-20 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-5 gap-4">
          {process.map((item, idx) => (
            <div key={idx} className="p-6 bg-slate-900/50 border border-white/5 rounded-3xl hover:border-green-500/50 transition-all group">
              <div className="text-slate-700 font-black text-4xl mb-4 group-hover:text-green-500/20">0{idx + 1}</div>
              <div className="text-green-400 mb-4">{item.icon}</div>
              <h4 className="text-lg font-bold mb-2">{item.title}</h4>
              <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}