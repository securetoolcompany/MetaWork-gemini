'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';

export default function CityHighPresentation() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 1,
      title: "Turn Your Ideas Into Income",
      subtitle: "(And Actually Own Them)",
      visual: "hero",
      color: "text-blue-400",
      content: "How many of you have posted a great piece of art online for free, making a massive platform money instead of yourself?",
      metric: "THE FUTURE OF ENTREPRENEURSHIP"
    },
    {
      id: 2,
      title: "Meet Adam-Paul Smolak",
      subtitle: "CEO & Serial Entrepreneur",
      visual: "adam", 
      color: "text-purple-400",
      content: "Founder of 20+ companies across the globe. Built 4 factories. Executed international government consulting in Haiti, Mexico, and China.",
      metric: "EXPERIENCE AT SCALE"
    },
    {
      id: 3,
      title: "The SECURE Origin Story",
      subtitle: "Physical Products are Brutal.",
      visual: "products",
      color: "text-amber-400",
      content: "We invented the SuperRatchet, AnyStrike, and Anymount. The reality? Manufacturing requires overseas factories, shipping containers, and massive upfront cash.",
      metric: "THE BARRIER TO ENTRY"
    },
    {
      id: 4,
      title: "If You Don't Own It...",
      subtitle: "Someone else will profit from it.",
      visual: "ownership",
      color: "text-red-500",
      content: "An idea in your head is worthless. Your art, your logo, your 3D design—these are assets, but only if you legally and digitally secure them.",
      metric: "TRUE OWNERSHIP"
    },
    {
      id: 5,
      title: "Tokenization",
      subtitle: "The Digital Vault",
      visual: "token",
      color: "text-cyan-400",
      content: "A digital certificate of authenticity on the blockchain. Once your design is tokenized, it acts like a digital deed. No one can dispute that YOU are the creator.",
      metric: "IMMUTABLE ASSETS"
    },
    {
      id: 6,
      title: "MetaManufacturing",
      subtitle: "Digital Ideas → Physical Reality",
      visual: "manufacturing",
      color: "text-indigo-400",
      content: "Take your tokenized IP and instantly inject it into a catalog of over 400 blank physical products (hoodies, skateboards, 3D printed statues) without paying a dime for inventory.",
      metric: "ZERO UPFRONT COST"
    },
    {
      id: 7,
      title: "The Aisle",
      subtitle: "Your Digital Storefront",
      visual: "aisle",
      color: "text-pink-400",
      content: "Curate your custom products. Set your own profit margins. Post the link to your social media, and let the decentralized system handle the rest.",
      metric: "GLOBAL REACH"
    },
    {
      id: 8,
      title: "Automated Royalties",
      subtitle: "No Waiting for a Check",
      visual: "royalties",
      color: "text-emerald-400",
      content: "When a customer buys, the factory prints and ships. A Smart Contract instantly calculates your profit and drops the USDC directly into your digital wallet.",
      metric: "INSTANT PAYOUTS"
    },
    {
      id: 9,
      title: "Watch This.",
      subtitle: "Live Demonstration",
      visual: "terminal",
      color: "text-blue-500",
      content: "Let's take a graphic, tokenize the IP, place it on a backpack, and publish it live to an Aisle in under 3 minutes.",
      metric: "PROOF OF CONCEPT"
    },
    {
      id: 10,
      title: "Your Keys to the Economy",
      subtitle: "The Decentralized Wallet",
      visual: "wallet",
      color: "text-yellow-400",
      content: "To get paid, you need a digital vault. It acts as your login, your bank account, and your digital signature.",
      metric: "SELF-CUSTODY"
    },
    {
      id: 11,
      title: "Let's Get Started",
      subtitle: "Scan to begin.",
      visual: "qr",
      color: "text-green-400",
      content: "You don't need a factory. You don't need a loan. Own your ideas.",
      metric: "SECUREMETAWORK.COM/CITYHIGHSCHOOL"
    }
  ];

  const nextSlide = useCallback(() => setCurrentSlide((prev) => (prev === slides.length - 1 ? prev : prev + 1)), [slides.length]);
  const prevSlide = useCallback(() => setCurrentSlide((prev) => (prev === 0 ? 0 : prev - 1)), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  const current = slides[currentSlide];

  // --- CUSTOM VISUAL RENDERER ---
  const renderVisual = () => {
    switch (current.visual) {
      
      case "hero":
        return (
          <div className="relative w-full max-w-[400px] aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-blue-900 to-black border border-blue-500/30 flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.3)]">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay"></div>
            <div className="text-center z-10 p-8 border border-white/10 bg-black/50 backdrop-blur-md rounded-xl">
               <div className="text-4xl mb-2">💡 → 💵</div>
               <div className="font-mono text-xs text-blue-300">IDEA_TO_INCOME.EXE</div>
            </div>
          </div>
        );

      case "adam":
        return (
          <div className="relative aspect-square w-full max-w-[400px] rounded-full overflow-hidden border-[8px] border-zinc-900 shadow-[0_0_50px_rgba(168,85,247,0.3)]">
            <img src="/adam-paul.jpg" alt="Adam-Paul Smolak" className="w-full h-full object-cover" />
          </div>
        );

      case "products":
        return (
          <div className="w-full max-w-[450px] grid grid-cols-2 gap-4 p-4 bg-zinc-900/50 rounded-[2rem] border border-zinc-800 shadow-[0_0_50px_rgba(251,191,36,0.15)] backdrop-blur-sm">
            
            {/* Slot 1: SuperRatchet */}
            <div className="aspect-square rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950 shadow-lg relative group">
              <img src="/superratchet.jpg" alt="SuperRatchet" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?q=80&w=400&auto=format&fit=crop"}/>
              <div className="absolute bottom-0 inset-x-0 bg-black/70 p-2 text-[10px] font-mono text-center text-amber-400 font-bold backdrop-blur-md">SUPERRATCHET</div>
            </div>

            {/* Slot 2: Anymount */}
            <div className="aspect-square rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950 shadow-lg relative group">
              <img src="/anymount.avif" alt="Anymount" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?q=80&w=400&auto=format&fit=crop"}/>
              <div className="absolute bottom-0 inset-x-0 bg-black/70 p-2 text-[10px] font-mono text-center text-amber-400 font-bold backdrop-blur-md">ANYMOUNT</div>
            </div>

            {/* Slot 3: SECURE Glove */}
            <div className="aspect-square rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950 shadow-lg relative group">
              <img src="/glove.jpg" alt="SECURE Glove" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1556888335-95371827d5e4?q=80&w=400&auto=format&fit=crop"}/>
              <div className="absolute bottom-0 inset-x-0 bg-black/70 p-2 text-[10px] font-mono text-center text-amber-400 font-bold backdrop-blur-md">MAGNETIC GLOVE</div>
            </div>

            {/* Slot 4: AnyStrike */}
            <div className="aspect-square rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950 shadow-lg relative group">
               <img src="/anystrike.jpg" alt="AnyStrike" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1580983546594-f28876c4fb80?q=80&w=400&auto=format&fit=crop"}/>
               <div className="absolute bottom-0 inset-x-0 bg-black/70 p-2 text-[10px] font-mono text-center text-amber-400 font-bold backdrop-blur-md">ANYSTRIKE</div>
            </div>

          </div>
        );

      case "ownership":
        return (
          <div className="relative w-full max-w-[450px] h-[400px] md:h-[450px] flex items-center justify-center">
            
            {/* IP 1: Music / Beats */}
            <div className="absolute top-0 left-0 md:left-4 bg-zinc-900 border border-purple-500/50 p-4 md:p-5 rounded-2xl shadow-lg transform -rotate-6 hover:rotate-0 hover:scale-105 transition-all duration-300 z-10 w-40 md:w-48 backdrop-blur-sm bg-opacity-90">
              <div className="text-3xl md:text-4xl mb-2 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">🎧</div>
              <div className="text-[10px] md:text-xs font-black tracking-widest text-purple-400 mb-1">BEATS / AUDIO</div>
              <div className="text-xs text-zinc-300 font-mono">Original Lofi Track</div>
            </div>

            {/* IP 2: Gaming Asset */}
            <div className="absolute top-[15%] right-0 md:right-4 bg-zinc-900 border border-green-500/50 p-4 md:p-5 rounded-2xl shadow-lg transform rotate-6 hover:rotate-0 hover:scale-105 transition-all duration-300 z-20 w-40 md:w-48 backdrop-blur-sm bg-opacity-90">
              <div className="text-3xl md:text-4xl mb-2 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]">🕹️</div>
              <div className="text-[10px] md:text-xs font-black tracking-widest text-green-400 mb-1">GAMING ASSET</div>
              <div className="text-xs text-zinc-300 font-mono">Custom 3D Avatar</div>
            </div>

            {/* IP 3: Comic / Art */}
            <div className="absolute bottom-[20%] left-2 md:left-8 bg-zinc-900 border border-red-500/50 p-4 md:p-5 rounded-2xl shadow-lg transform -rotate-3 hover:rotate-0 hover:scale-105 transition-all duration-300 z-30 w-40 md:w-48 backdrop-blur-sm bg-opacity-90">
              <div className="text-3xl md:text-4xl mb-2 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">📖</div>
              <div className="text-[10px] md:text-xs font-black tracking-widest text-red-400 mb-1">COMIC / MANGA</div>
              <div className="text-xs text-zinc-300 font-mono">Character Design</div>
            </div>

            {/* IP 4: Social / Video */}
            <div className="absolute bottom-0 right-2 md:right-8 bg-zinc-900 border border-blue-500/50 p-4 md:p-5 rounded-2xl shadow-lg transform rotate-3 hover:rotate-0 hover:scale-105 transition-all duration-300 z-40 w-40 md:w-48 backdrop-blur-sm bg-opacity-90">
              <div className="text-3xl md:text-4xl mb-2 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">🕺</div>
              <div className="text-[10px] md:text-xs font-black tracking-widest text-blue-400 mb-1">SOCIAL / VIDEO</div>
              <div className="text-xs text-zinc-300 font-mono">Viral Choreography</div>
            </div>

            {/* Center Overlay Lock */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
              <div className="bg-black/90 backdrop-blur-xl border border-zinc-600 text-white p-6 rounded-full shadow-[0_0_50px_rgba(255,255,255,0.15)] flex flex-col items-center hover:scale-110 transition-transform duration-500 cursor-default">
                 <div className="text-5xl drop-shadow-2xl">🔒</div>
                 <div className="text-[10px] font-black uppercase tracking-widest mt-2 text-zinc-300">Secured IP</div>
              </div>
            </div>
          </div>
        );

      case "token":
        return (
          <div className="relative w-[300px] h-[300px] flex items-center justify-center">
            <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-full animate-ping"></div>
            <div className="absolute inset-4 border border-cyan-500/50 rounded-full animate-spin-slow"></div>
            <div className="z-10 bg-black/80 backdrop-blur-md border border-cyan-500 p-8 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.4)] text-center">
              <div className="text-5xl mb-4">💎</div>
              <div className="text-cyan-400 font-mono text-sm font-bold tracking-widest">ASSET #8824</div>
              <div className="text-zinc-500 font-mono text-[10px] mt-2">MINTED ON ALGORAND</div>
            </div>
          </div>
        );

      case "manufacturing":
        return (
          <div className="w-full max-w-[500px] bg-zinc-950 border border-zinc-800 rounded-[2rem] p-6 md:p-8 shadow-[0_0_60px_rgba(99,102,241,0.2)] flex flex-col relative overflow-hidden flex-shrink-0">
            {/* Background Blueprint Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />

            {/* Header */}
            <div className="relative z-10 border-b border-zinc-800 pb-4 mb-8 flex justify-between items-center">
              <div>
                <h3 className="font-black italic text-indigo-400 text-2xl tracking-widest uppercase">Creator Engine</h3>
                <p className="text-[10px] md:text-xs text-zinc-500 font-mono tracking-widest mt-1">SUPPLY_CHAIN.INIT()</p>
              </div>
              <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
            </div>

            {/* The Engine Math: IP + Blank = Product */}
            <div className="relative z-10 flex items-center justify-between bg-zinc-900/80 backdrop-blur-sm p-4 md:p-6 rounded-2xl border border-zinc-700 mb-10 shadow-lg">
              
              {/* Input 1: IP */}
              <div className="flex flex-col items-center w-20">
                <div className="h-12 w-12 md:h-14 md:w-14 bg-blue-500/10 border border-blue-500/50 rounded-xl flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(59,130,246,0.3)]">💎</div>
                <span className="text-[9px] md:text-[10px] font-mono text-blue-400 mt-2 text-center leading-tight">TOKENIZED IP</span>
              </div>

              <div className="text-zinc-500 font-black text-xl">+</div>

              {/* Input 2: Blank Canvas */}
              <div className="flex flex-col items-center w-20">
                <div className="h-12 w-12 md:h-14 md:w-14 bg-zinc-800 border border-zinc-600 rounded-xl flex items-center justify-center text-2xl">👕</div>
                <span className="text-[9px] md:text-[10px] font-mono text-zinc-400 mt-2 text-center leading-tight">BLANK CANVAS</span>
              </div>

              <div className="text-indigo-500 font-black text-xl animate-pulse">→</div>

              {/* Output: Product */}
              <div className="flex flex-col items-center w-24">
                <div className="h-16 w-16 md:h-20 md:w-20 bg-indigo-500/20 border-2 border-indigo-500 rounded-xl flex items-center justify-center text-4xl shadow-[0_0_25px_rgba(99,102,241,0.5)]">🔥</div>
                <span className="text-[10px] md:text-xs font-black text-indigo-400 mt-2 uppercase tracking-wider text-center leading-tight">Ready to Sell</span>
              </div>
            </div>

            {/* Supply Chain Flow */}
            <div className="relative z-10 bg-black/50 p-5 rounded-2xl border border-zinc-800">
              <h4 className="text-[10px] font-mono text-zinc-500 tracking-widest mb-4 text-center">AUTOMATED GLOBAL SUPPLY CHAIN</h4>
              
              <div className="flex justify-between items-center relative px-2">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-6 right-6 h-0.5 bg-zinc-800 -translate-y-1/2 z-0" />
                
                {/* Flow steps */}
                <div className="relative z-10 flex flex-col items-center gap-2 bg-zinc-950">
                  <div className="h-8 w-8 md:h-10 md:w-10 flex items-center justify-center rounded-full border-2 border-green-500/50 bg-green-500/10 text-green-400 text-sm shadow-[0_0_10px_rgba(34,197,94,0.2)]">🛒</div>
                  <span className="text-[8px] md:text-[9px] font-mono text-zinc-400 font-bold">ORDER</span>
                </div>
                
                <div className="relative z-10 flex flex-col items-center gap-2 bg-zinc-950">
                  <div className="h-8 w-8 md:h-10 md:w-10 flex items-center justify-center rounded-full border-2 border-indigo-500/50 bg-indigo-500/10 text-indigo-400 text-sm shadow-[0_0_10px_rgba(99,102,241,0.2)]">🏭</div>
                  <span className="text-[8px] md:text-[9px] font-mono text-zinc-400 font-bold">PRINT</span>
                </div>
                
                <div className="relative z-10 flex flex-col items-center gap-2 bg-zinc-950">
                  <div className="h-8 w-8 md:h-10 md:w-10 flex items-center justify-center rounded-full border-2 border-amber-500/50 bg-amber-500/10 text-amber-400 text-sm shadow-[0_0_10px_rgba(245,158,11,0.2)]">📦</div>
                  <span className="text-[8px] md:text-[9px] font-mono text-zinc-400 font-bold">SHIP</span>
                </div>
                
                <div className="relative z-10 flex flex-col items-center gap-2 bg-zinc-950">
                  <div className="h-8 w-8 md:h-10 md:w-10 flex items-center justify-center rounded-full border-2 border-purple-500/50 bg-purple-500/10 text-purple-400 text-sm shadow-[0_0_10px_rgba(168,85,247,0.2)]">🏠</div>
                  <span className="text-[8px] md:text-[9px] font-mono text-zinc-400 font-bold">DELIVER</span>
                </div>
              </div>
            </div>

          </div>
        );

      case "aisle":
        return (
          <div className="relative w-[280px] md:w-[320px] h-[550px] bg-zinc-950 border-[6px] border-zinc-800 rounded-[3rem] overflow-hidden shadow-[0_0_50px_rgba(236,72,153,0.2)] flex flex-col flex-shrink-0">
            <div className="absolute top-0 inset-x-0 h-5 bg-zinc-800 rounded-b-2xl w-32 mx-auto z-20" />
            <div className="h-32 bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500" />
            <div className="absolute top-20 left-6 h-20 w-20 bg-zinc-900 border-4 border-zinc-950 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-3xl">🚀</span>
            </div>
            <div className="pt-12 px-6 pb-6 flex-1 flex flex-col">
              <h3 className="font-bold text-xl text-white">CityHigh_Creator</h3>
              <p className="text-xs text-pink-400 mb-6 font-mono">metawork.com/creator</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 flex flex-col items-center">
                  <div className="aspect-square w-full bg-black rounded-lg mb-3 flex items-center justify-center text-3xl">👕</div>
                  <div className="h-2 w-3/4 bg-zinc-700 rounded mb-2" />
                  <div className="h-2 w-1/2 bg-zinc-800 rounded text-[10px] text-green-400 text-center font-mono">+$14.00</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 flex flex-col items-center">
                  <div className="aspect-square w-full bg-black rounded-lg mb-3 flex items-center justify-center text-3xl">🛹</div>
                  <div className="h-2 w-3/4 bg-zinc-700 rounded mb-2" />
                  <div className="h-2 w-1/2 bg-zinc-800 rounded text-[10px] text-green-400 text-center font-mono">+$22.50</div>
                </div>
              </div>
            </div>
          </div>
        );

      case "royalties":
        return (
          <div className="w-full max-w-[350px] bg-black border border-emerald-500/30 rounded-2xl p-6 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
            <div className="font-mono text-emerald-500 text-xs mb-6 uppercase tracking-widest border-b border-emerald-500/20 pb-2">Live Royalty Feed</div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between items-center bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                   <div className="flex items-center gap-3">
                     <div className="h-8 w-8 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">💰</div>
                     <div>
                       <div className="text-white text-sm">Product Sold</div>
                       <div className="text-zinc-500 text-[10px] font-mono">Customer in TX, USA</div>
                     </div>
                   </div>
                   <div className="text-emerald-400 font-mono font-bold">+18.50 USDC</div>
                </div>
              ))}
            </div>
          </div>
        );

      case "terminal":
        return (
          <div className="w-full max-w-[600px] bg-zinc-900/50 backdrop-blur-xl border border-zinc-700 rounded-[2rem] p-6 md:p-8 shadow-[0_0_50px_rgba(59,130,246,0.2)] flex-shrink-0">
            
            {/* The 4-Step Pipeline Flow */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-2 relative">

              {/* Step 1: Select Product */}
              <div className="flex flex-col items-center gap-3 w-24 relative z-10">
                 <div className="h-14 w-14 bg-purple-500/20 border-2 border-purple-500 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                    <span className="text-xl">👕</span>
                 </div>
                 <div className="text-center">
                   <div className="text-[9px] font-black text-purple-400 tracking-widest mb-1">STEP 1</div>
                   <div className="text-[11px] text-white font-bold leading-tight">Select Product</div>
                 </div>
              </div>

              {/* Flow Connector 1 */}
              <div className="hidden md:block flex-1 h-0.5 bg-zinc-800 relative -mt-8 mx-2">
                 <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 opacity-50"></div>
                 <div className="absolute top-1/2 left-0 h-1.5 w-1.5 bg-purple-400 rounded-full -translate-y-1/2 animate-[ping_2s_linear_infinite]"></div>
              </div>
              <div className="md:hidden w-0.5 h-6 bg-gradient-to-b from-purple-500 to-blue-500 opacity-50 my-1"></div>

              {/* Step 2: Upload Art */}
              <div className="flex flex-col items-center gap-3 w-24 relative z-10">
                 <div className="h-14 w-14 bg-blue-500/20 border-2 border-blue-500 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)]">
                    <span className="text-xl">🖼️</span>
                 </div>
                 <div className="text-center">
                   <div className="text-[9px] font-black text-blue-400 tracking-widest mb-1">STEP 2</div>
                   <div className="text-[11px] text-white font-bold leading-tight">Upload IP</div>
                 </div>
              </div>

              {/* Flow Connector 2 */}
              <div className="hidden md:block flex-1 h-0.5 bg-zinc-800 relative -mt-8 mx-2">
                 <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-50"></div>
                 <div className="absolute top-1/2 left-0 h-1.5 w-1.5 bg-blue-400 rounded-full -translate-y-1/2 animate-[ping_2s_linear_infinite_0.5s]"></div>
              </div>
              <div className="md:hidden w-0.5 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 opacity-50 my-1"></div>

              {/* Step 3: Mint */}
              <div className="flex flex-col items-center gap-3 w-24 relative z-10">
                 <div className="h-14 w-14 bg-cyan-500/20 border-2 border-cyan-500 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                    <span className="text-xl">🔐</span>
                 </div>
                 <div className="text-center">
                   <div className="text-[9px] font-black text-cyan-400 tracking-widest mb-1">STEP 3</div>
                   <div className="text-[11px] text-white font-bold leading-tight">Tokenize</div>
                 </div>
              </div>

              {/* Flow Connector 3 */}
              <div className="hidden md:block flex-1 h-0.5 bg-zinc-800 relative -mt-8 mx-2">
                 <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-pink-500 opacity-50"></div>
                 <div className="absolute top-1/2 left-0 h-1.5 w-1.5 bg-cyan-400 rounded-full -translate-y-1/2 animate-[ping_2s_linear_infinite_1s]"></div>
              </div>
              <div className="md:hidden w-0.5 h-6 bg-gradient-to-b from-cyan-500 to-pink-500 opacity-50 my-1"></div>

              {/* Step 4: Deploy */}
              <div className="flex flex-col items-center gap-3 w-24 relative z-10">
                 <div className="h-14 w-14 bg-pink-500/20 border-2 border-pink-500 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(236,72,153,0.4)]">
                    <span className="text-xl">🛍️</span>
                 </div>
                 <div className="text-center">
                   <div className="text-[9px] font-black text-pink-400 tracking-widest mb-1">STEP 4</div>
                   <div className="text-[11px] text-white font-bold leading-tight">Publish Aisle</div>
                 </div>
              </div>

            </div>

            {/* Simulated UI Progress Bar below the flow */}
            <div className="mt-8 bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
               <div className="flex items-center gap-4">
                 <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                 <div>
                   <div className="text-sm font-bold text-white">System Processing...</div>
                   <div className="text-[10px] font-mono text-zinc-500">Syncing to blockchain & generating 3D mockups</div>
                 </div>
               </div>
               <div className="text-xs font-mono font-bold text-green-400 animate-pulse">98%</div>
            </div>
            
          </div>
        );

      case "wallet":
        return (
          <div className="relative w-[280px] h-[500px] bg-zinc-900 border-[6px] border-zinc-800 rounded-[3rem] p-6 flex flex-col justify-between shadow-[0_0_50px_rgba(250,204,21,0.2)]">
             <div>
               <div className="flex justify-between items-center mb-8">
                 <div className="h-8 w-8 bg-yellow-400 rounded-lg"></div>
                 <div className="text-xs font-mono text-zinc-500">Mainnet</div>
               </div>
               <div className="text-zinc-400 text-sm mb-1">Total Balance</div>
               <div className="text-4xl font-bold text-white tracking-tighter">$1,240.50</div>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="bg-black py-3 rounded-xl border border-zinc-800 text-center text-sm font-bold">Send</div>
               <div className="bg-yellow-400 text-black py-3 rounded-xl text-center text-sm font-bold">Receive</div>
             </div>
          </div>
        );

      case "qr":
        return (
          <div className="flex flex-col items-center space-y-8 bg-zinc-900/50 p-8 md:p-12 rounded-[40px] border border-zinc-800 backdrop-blur-sm w-full max-w-sm shadow-[0_0_50px_rgba(74,222,128,0.2)]">
            <div className="bg-white p-4 rounded-2xl shadow-2xl w-full aspect-square">
              <img 
                src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://securemetawork.com/cityhighschool" 
                alt="QR Code" 
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-center text-lg md:text-xl text-zinc-400 font-light">
              Scan to set up your vault and start tokenizing.
            </p>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans flex flex-col overflow-hidden selection:bg-blue-500/30">
      
      {/* HEADER / PROGRESS BAR */}
      <header className="p-6 md:p-8 flex justify-between items-center z-10 relative">
        <div className="font-black italic tracking-tighter text-xl md:text-2xl flex items-center gap-2">
          <div className="h-6 w-6 bg-white text-black flex items-center justify-center rounded-sm text-xs">M</div>
          METAWORK
        </div>
        <div className="hidden md:flex gap-2">
          {slides.map((s, i) => (
            <div 
              key={s.id} 
              className={`h-1.5 rounded-full transition-all duration-500 ${i === currentSlide ? 'w-8 bg-white' : i < currentSlide ? 'w-4 bg-zinc-600' : 'w-4 bg-zinc-800'}`}
            />
          ))}
        </div>
        <div className="font-mono text-[10px] md:text-xs text-zinc-500 uppercase tracking-widest">
          Slide {currentSlide + 1} // {slides.length}
        </div>
      </header>

      {/* MAIN SLIDE CONTENT */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-8 relative z-10">
        <div 
          key={current.id} 
          className="max-w-7xl w-full flex flex-col lg:flex-row gap-12 lg:gap-16 items-center justify-between animate-in fade-in slide-in-from-bottom-12 duration-700"
        >
          {/* Left Column: Text */}
          <div className="flex-1 space-y-4 md:space-y-6">
            <div className={`font-mono text-xs md:text-sm font-bold uppercase tracking-[0.3em] ${current.color}`}>
              {current.metric}
            </div>
            <h1 className="text-5xl md:text-7xl xl:text-8xl font-black tracking-tighter leading-[0.9]">
              {current.title}
            </h1>
            <h2 className="text-2xl md:text-4xl text-zinc-400 font-light italic">
              {current.subtitle}
            </h2>
            {current.id !== 11 && (
              <p className="text-lg md:text-2xl text-zinc-300 leading-relaxed max-w-2xl mt-8 border-l-4 border-zinc-800 pl-6 py-2">
                {current.content}
              </p>
            )}
          </div>

          {/* Right Column: Visual / Graphic */}
          <div className="flex-1 flex justify-center lg:justify-end items-center w-full">
            {renderVisual()}
          </div>
        </div>
      </main>

      {/* FOOTER CONTROLS */}
      <footer className="p-6 md:p-8 flex justify-between items-center z-10 relative border-t border-zinc-900">
        <button 
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors disabled:opacity-20 font-mono text-xs uppercase tracking-widest"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </button>

        <div className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest hidden md:block">
          Use Arrow Keys or Spacebar to navigate
        </div>

        <button 
          onClick={nextSlide}
          disabled={currentSlide === slides.length - 1}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors disabled:opacity-20 font-mono text-xs uppercase tracking-widest"
        >
          Next <ArrowRight className="h-4 w-4" />
        </button>
      </footer>

      {/* BACKGROUND GLOW EFFECTS */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-1/4 -right-1/4 w-[500px] h-[500px] md:w-[800px] md:h-[800px] rounded-full blur-[100px] md:blur-[150px] opacity-20 transition-colors duration-1000 ${
          currentSlide % 3 === 0 ? 'bg-blue-500' : currentSlide % 3 === 1 ? 'bg-purple-500' : 'bg-emerald-500'
        }`} />
        <div className={`absolute -bottom-1/4 -left-1/4 w-[400px] h-[400px] md:w-[600px] md:h-[600px] rounded-full blur-[100px] md:blur-[150px] opacity-10 transition-colors duration-1000 delay-500 ${
          currentSlide % 2 === 0 ? 'bg-amber-500' : 'bg-cyan-500'
        }`} />
      </div>
    </div>
  );
}