import { Palette, Box, CheckCircle, Truck, Wallet } from 'lucide-react';

export default function ProductProcess() {
  const steps = [
    { icon: <Palette />, title: "Start with IP", desc: "Upload artwork or 3D files. Once approved, the IP is minted as an NFT and ready for licensing." },
    { icon: <Box />, title: "Design Products", desc: "Use our drag-and-drop editor to create from a catalog of 500+ items using your IP." },
    { icon: <CheckCircle />, title: "Review & List", desc: "Approved products appear in your personal storefront (Aisle) and our marketplace." },
    { icon: <Truck />, title: "Auto-Fulfillment", desc: "We manufacture locally and ship globally. You never handle stock or logistics." },
    { icon: <Wallet />, title: "Automatic Earnings", desc: "Smart contracts split revenue between designers and IP owners instantly." }
  ];

  return (
    <div className="bg-black text-white min-h-screen">
      <header className="pt-32 pb-20 text-center px-8 bg-slate-950">
        <h1 className="text-5xl md:text-7xl font-black mb-6">From Idea to <span className="text-green-500">Product</span></h1>
        <p className="text-xl text-slate-400 italic">In just a few clicks.</p>
      </header>

      <section className="py-24 px-8 max-w-6xl mx-auto">
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-px bg-white/10 hidden md:block" />
          <div className="space-y-20">
            {steps.map((step, idx) => (
              <div key={idx} className="relative flex flex-col md:flex-row gap-12 items-start">
                <div className="h-16 w-16 rounded-2xl bg-green-600 flex items-center justify-center shrink-0 z-10 shadow-[0_0_20px_rgba(34,197,94,0.4)]">
                  {step.icon}
                </div>
                <div>
                  <h3 className="text-3xl font-bold mb-4">{idx + 1}. {step.title}</h3>
                  <p className="text-xl text-slate-400 font-light leading-relaxed max-w-2xl">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}