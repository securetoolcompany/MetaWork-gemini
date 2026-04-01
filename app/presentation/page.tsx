"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Zap, Shield, Target, Rocket, Cpu } from 'lucide-react';
import Link from 'next/link';

const slides = [
  // SLIDE 1: AGENDA
  {
    title: "Agenda",
    content: (
      <div className="space-y-6 md:space-y-10 text-xl md:text-3xl font-bold tracking-tight">
        <div className="flex flex-col border-l-4 border-primary pl-4 md:pl-8 py-2 bg-white/5">
          <span className="text-primary">The SECURE MetaWork Story</span>
          <span className="text-sm md:text-xl font-mono text-muted-foreground mt-1">Adam-Paul Smolak - CEO</span>
        </div>
        <div className="flex flex-col border-l-4 border-blue-500 pl-4 md:pl-8 py-2">
          <span>Income-generating assets, at no cost</span>
          <span className="text-sm md:text-xl font-mono text-muted-foreground mt-1">Scott Holbrook - COO</span>
        </div>
        <div className="flex flex-col border-l-4 border-green-500 pl-4 md:pl-8 py-2">
          <span>Live Demonstration - Design & List</span>
          <span className="text-sm md:text-xl font-mono text-muted-foreground mt-1">Scott Holbrook - COO</span>
        </div>
        <div className="flex flex-col border-l-4 border-purple-500 pl-4 md:pl-8 py-2">
          <span>Creating your blockchain wallet</span>
          <span className="text-sm md:text-xl font-mono text-muted-foreground mt-1">Zak Yim - Director of Combat Sports</span>
        </div>
      </div>
    )
  },
  // SLIDE 2: ADAM-PAUL SMOLAK
  {
    title: "Adam-Paul",
    subtitle: "Founder of 20+ companies",
    content: (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 text-lg md:text-2xl leading-relaxed">
        <div className="bg-white/5 p-6 md:p-8 rounded-3xl border border-white/10">
          <h3 className="text-primary font-black uppercase text-[10px] mb-4 tracking-widest flex items-center gap-2">
            <Target size={14} /> Enterprise History
          </h3>
          <ul className="space-y-2 opacity-90 text-sm md:text-xl">
            <li>• 4 Factories & 3 Consulting Firms</li>
            <li>• Education Corp & University Institute</li>
            <li>• Nightclub & Restaurant</li>
          </ul>
        </div>
        <div className="space-y-4 md:space-y-8">
          <div className="p-4 md:p-6 border-b border-white/10">
            <h3 className="font-bold text-blue-500 uppercase tracking-widest text-[10px] mb-2">Gov Consulting</h3>
            <p className="font-medium text-white text-sm md:text-lg">Haiti, Mexico, China</p>
          </div>
          <div className="p-4 md:p-6 border-b border-white/10">
            <h3 className="font-bold text-blue-500 uppercase tracking-widest text-[10px] mb-2">Education</h3>
            <p className="font-medium text-sm md:text-lg">President of EI Institute</p>
          </div>
        </div>
      </div>
    )
  },
  // SLIDE 3: OUR INVENTIONS
  {
    title: "Inventions",
    subtitle: "Hardware innovation",
    content: (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
        {[
          { name: "AnyStrike", icon: <Zap size={16} /> },
          { name: "SuperRatchet", icon: <Cpu size={16} /> },
          { name: "Cut-proof", icon: <Shield size={16} /> },
          { name: "Anymount", icon: <Target size={16} /> },
          { name: "Shoe Tattoo", icon: <Zap size={16} /> },
          { name: "Magnetic", icon: <Shield size={16} /> }
        ].map((item) => (
          <div key={item.name} className="aspect-square md:aspect-video bg-neutral-900 border border-white/10 rounded-xl flex flex-col items-center justify-center p-2 text-center">
            <div className="text-primary mb-2">{item.icon}</div>
            <span className="font-black text-[10px] md:text-xl tracking-tighter uppercase italic">{item.name}</span>
          </div>
        ))}
      </div>
    )
  },
  // SLIDE 4: PLATFORM
  {
    title: "Platform",
    content: (
      <div className="space-y-8 md:space-y-12">
        <div className="grid grid-cols-3 gap-2 font-mono">
          {["1. SETUP", "2. PLAN", "3. EXEC"].map(step => (
            <div key={step} className="p-4 md:p-10 bg-primary text-black flex items-center justify-center text-xs md:text-4xl font-black italic md:skew-x-[-12deg]">
              {step}
            </div>
          ))}
        </div>
        <div className="space-y-4 text-sm md:text-3xl font-bold tracking-tight">
          <p className="flex gap-4 items-center"><Rocket className="text-primary shrink-0" /> Low-cost entry</p>
          <p className="flex gap-4 items-center"><Shield className="text-primary shrink-0" /> Management tools</p>
          <p className="flex gap-4 items-center"><Cpu className="text-primary shrink-0" /> Global Investment</p>
        </div>
      </div>
    )
  },
  // SLIDE 5: EARNINGS (Symmetrical with 3D Wireframe)
  {
    title: "Earnings",
    subtitle: "MetaManufacturing Revenue Streams",
    content: (
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        {/* 3D WIREFRAME OBJECT (Top Right) */}
        <div className="absolute -top-16 -right-8 w-32 h-32 md:w-48 md:h-48 pointer-events-none opacity-40">
          <div className="relative w-full h-full animate-spin-slow" style={{ transformStyle: 'preserve-3d' }}>
            <div className="absolute inset-0 border-[1px] border-primary/50 bg-primary/5" style={{ transform: 'rotateX(90deg) translateZ(40px)' }} />
            <div className="absolute inset-0 border-[1px] border-primary/50 bg-primary/5" style={{ transform: 'rotateX(-90deg) translateZ(40px)' }} />
            <div className="absolute inset-0 border-[1px] border-primary/50 bg-primary/5" style={{ transform: 'translateZ(40px)' }} />
            <div className="absolute inset-0 border-[1px] border-primary/50 bg-primary/5" style={{ transform: 'rotateY(180deg) translateZ(40px)' }} />
            <div className="absolute inset-0 border-[1px] border-primary/50 bg-primary/5" style={{ transform: 'rotateY(-90deg) translateZ(40px)' }} />
            <div className="absolute inset-0 border-[1px] border-primary/50 bg-primary/5" style={{ transform: 'rotateY(90deg) translateZ(40px)' }} />
          </div>
        </div>

        <div className="group relative bg-white/5 border border-white/10 rounded-[32px] p-6 md:p-10 transition-all hover:border-blue-500/50">
          <div className="relative z-10 space-y-6">
            <div>
              <h3 className="text-4xl md:text-6xl font-black text-blue-500 italic uppercase tracking-tighter">Standard</h3>
              <p className="text-[10px] md:text-sm font-mono uppercase tracking-widest text-muted-foreground">Print-on-Demand</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {["Apparel", "Home Decor", "Backpacks", "Wallpaper", "Stationery", "Textiles"].map((i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-black/40 border border-white/5 rounded-xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs md:text-lg font-bold">{i}</span>
                </div>
              ))}
            </div>
            <p className="pt-4 border-t border-white/10 text-[10px] md:text-xs opacity-60">
              Apply designs to physical templates instantly. High-margin, zero-inventory fulfillment.
            </p>
          </div>
        </div>

        <div className="group relative bg-white/5 border border-white/10 rounded-[32px] p-6 md:p-10 transition-all hover:border-green-500/50">
          <div className="relative z-10 space-y-6">
            <div>
              <h3 className="text-4xl md:text-6xl font-black text-green-500 italic uppercase tracking-tighter">3D Printed</h3>
              <p className="text-[10px] md:text-sm font-mono uppercase tracking-widest text-muted-foreground">Additive Manufacturing</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {["Figurines", "Horology", "Prototyping", "Art Pieces", "Gadgets", "Organizers"].map((i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-black/40 border border-white/5 rounded-xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-xs md:text-lg font-bold">{i}</span>
                </div>
              ))}
            </div>
            <p className="pt-4 border-t border-white/10 text-[10px] md:text-xs opacity-60">
              Transform digital files into complex physical objects via decentralized production nodes.
            </p>
          </div>
        </div>
      </div>
    )
  },
  // SLIDE 6: THE AISLE (The "Money" Slide)
{
  title: "The Aisle",
  subtitle: "Your Digital Storefront & Revenue Engine",
  content: (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
      {/* Left Side: The "Why" (2 Columns) */}
      <div className="lg:col-span-2 space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-500">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest">Live Marketplace</span>
        </div>

        <div className="space-y-4">
          {[
            { 
              title: "Digital-to-Physical IP", 
              desc: "Your designs become tangible assets instantly.",
              icon: <Shield size={18} /> 
            },
            { 
              title: "Full Price Control", 
              desc: "You define the margins; we handle the math.",
              icon: <Target size={18} /> 
            },
            { 
              title: "Global Fulfillment", 
              desc: "Orders are printed and shipped automatically.",
              icon: <Rocket size={18} /> 
            },
            { 
              title: "Viral Integration", 
              desc: "Optimized for Instagram, TikTok, and X.",
              icon: <Zap size={18} /> 
            }
          ].map((item, idx) => (
            <motion.div 
              key={idx}
              whileHover={{ x: 10 }}
              className="group flex gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-primary/50 transition-all"
            >
              <div className="text-primary mt-1 opacity-60 group-hover:opacity-100 transition-opacity">
                {item.icon}
              </div>
              <div>
                <h4 className="text-sm md:text-lg font-black uppercase italic tracking-tighter">{item.title}</h4>
                <p className="text-[10px] md:text-sm text-muted-foreground leading-tight">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right Side: The Visual "Aisle" Mockup (3 Columns) */}
      <div className="lg:col-span-3 relative group">
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full group-hover:bg-primary/30 transition-all duration-700" />
        
        <div className="relative bg-neutral-900 border border-white/20 rounded-[40px] p-2 shadow-2xl overflow-hidden">
          {/* Mock Browser Header */}
          <div className="flex items-center gap-2 px-6 py-4 border-b border-white/10 bg-black/40">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
            </div>
            <div className="mx-auto bg-white/5 px-4 py-1 rounded-full text-[8px] font-mono opacity-40">
              metawork.com/your-brand-aisle
            </div>
          </div>

          {/* Mock Store Content */}
          <div className="p-6 space-y-6">
            <div className="h-40 md:h-64 bg-gradient-to-br from-neutral-800 to-black rounded-2xl flex items-center justify-center border border-white/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=400')] opacity-30 bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-700" />
              <div className="relative z-10 text-center">
                <div className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter drop-shadow-2xl">Your IP</div>
                <div className="text-[10px] font-mono tracking-[0.4em] opacity-60">READY FOR PURCHASE</div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2">
                  <div className="aspect-square bg-white/5 rounded-xl border border-white/10" />
                  <div className="h-1.5 w-full bg-white/10 rounded-full" />
                  <div className="h-1.5 w-2/3 bg-primary/20 rounded-full" />
                </div>
              ))}
            </div>

            <button className="w-full py-4 bg-primary text-black font-black uppercase italic rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:scale-[1.02] active:scale-95 transition-all">
              Withdraw Earnings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
},
  // SLIDE 7: THE FLOW (Robust 4-Step)
  {
    title: "The Flow",
    subtitle: "From Idea to Monetization",
    content: (
      <div className="relative w-full py-12">
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-gradient-to-r from-primary via-blue-500 to-green-500 opacity-20 hidden md:block" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4 relative">
          {[
            { step: "01", label: "IDEA", desc: "Design standard or 3D products", icon: <Target className="text-primary" size={32} />, color: "border-primary" },
            { step: "02", label: "PROTECT", desc: "Blockchain tokenization & Secure IP", icon: <Shield className="text-blue-500" size={32} />, color: "border-blue-500" },
            { step: "03", label: "LIST", desc: "Instant 'Aisle' page creation", icon: <Cpu className="text-purple-500" size={32} />, color: "border-purple-500" },
            { step: "04", label: "EARN", desc: "Automated royalties & global sales", icon: <Rocket className="text-green-500" size={32} />, color: "border-green-500" }
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center text-center space-y-4 group">
              <div className={`relative z-10 w-24 h-24 rounded-3xl bg-neutral-900 border-2 ${item.color} flex items-center justify-center transition-transform group-hover:scale-110 duration-300`}>
                <span className="absolute -top-3 -left-3 font-mono text-xs font-black px-2 py-1 bg-white text-black rounded">{item.step}</span>
                {item.icon}
              </div>
              <div className="space-y-1">
                <h4 className="font-black italic text-xl uppercase tracking-tighter">{item.label}</h4>
                <p className="text-[10px] md:text-sm text-muted-foreground max-w-[140px] leading-tight">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },
  // SLIDE 8: WALLET
  {
    title: "Wallet",
    subtitle: "Blockchain integration",
    content: (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-12">
        <div className="space-y-3">
          <div className="p-6 bg-white/5 rounded-2xl border border-primary/20">
            <ul className="space-y-4 font-bold text-xl md:text-3xl italic tracking-tighter">
              <li>1. Download Pera Wallet</li>
              <li>2. Create New Wallet</li>
              <li>3. Name Your Wallet</li>
            </ul>
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="font-black text-xs md:text-xl uppercase tracking-[0.3em] text-muted-foreground border-b border-white/10 pb-2 flex items-center gap-3">
            <Shield className="text-red-500" size={16} /> Security
          </h3>
          <ul className="space-y-2 text-sm md:text-2xl font-medium opacity-80">
            <li>• Select ‘More’</li>
            <li>• Select ‘View root wallet’</li>
            <li>• Acknowledge warnings</li>
          </ul>
        </div>
      </div>
    )
  }
];

export default function UnabridgedPresentation() {
  const [current, setCurrent] = useState(0);

  const next = () => current < slides.length - 1 && setCurrent(current + 1);
  const prev = () => current > 0 && setCurrent(current - 1);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [current]);

  return (
    <div className="fixed inset-0 bg-neutral-950 text-white selection:bg-primary touch-none flex flex-col overflow-hidden">
      
      {/* BACKGROUND EFFECTS */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] bg-blue-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        {/* HEADER */}
        <header className="shrink-0 p-6 md:px-10 md:py-8 flex justify-end items-center">
          <Link href="/dashboard" className="px-4 py-2 border border-white/10 rounded-full text-[10px] font-bold tracking-[0.3em] uppercase hover:bg-white hover:text-black transition-all">
            Exit
          </Link>
        </header>

        {/* MAIN SLIDE CONTENT */}
        <motion.main 
          className="flex-1 min-h-0 flex items-center justify-center px-6 md:px-20"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={(_, info) => {
            if (info.offset.x < -50) next();
            if (info.offset.x > 50) prev();
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-7xl max-h-full flex flex-col"
            >
              <div className="mb-6 md:mb-10 shrink-0">
                <h1 className="text-5xl md:text-8xl lg:text-9xl font-black italic uppercase tracking-tighter leading-[0.8]">
                  {slides[current].title}
                </h1>
                {slides[current].subtitle && (
                  <div className="flex items-center gap-4 text-primary mt-4">
                    <div className="h-[2px] w-12 bg-primary" />
                    <span className="text-xs md:text-xl font-mono uppercase tracking-[0.2em]">{slides[current].subtitle}</span>
                  </div>
                )}
              </div>

              {/* Dynamic Content Area with scroll safety */}
              <div className="min-h-0 overflow-y-auto no-scrollbar">
                {slides[current].content}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.main>

        {/* FOOTER */}
        <footer className="shrink-0 p-8 md:px-12 md:py-10 flex flex-col md:flex-row justify-between items-center gap-6 md:items-end">
          <div className="flex flex-col gap-4 items-center md:items-start w-full md:w-auto">
             <div className="text-[10px] font-mono opacity-40 uppercase tracking-[0.5em]">Frame_0{current+1}</div>
             <div className="flex gap-1">
                {slides.map((_, i) => (
                  <div key={i} className={`h-1 transition-all duration-500 ${i === current ? 'w-16 bg-primary' : 'w-4 bg-white/10'}`} />
                ))}
             </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={prev} disabled={current === 0} className="flex-1 md:flex-none p-5 border border-white/10 rounded-2xl disabled:opacity-5 transition-opacity">
              <ChevronLeft size={24} />
            </button>
            <button onClick={next} disabled={current === slides.length - 1} className="flex-[3] md:flex-none group flex items-center justify-center gap-4 px-10 py-5 bg-primary text-black font-black rounded-2xl active:scale-95 disabled:opacity-10 transition-all">
              <span className="text-sm tracking-tighter uppercase italic">Next Step</span>
              <ChevronRight size={24} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}