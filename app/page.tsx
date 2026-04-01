import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ArrowRight, Coins, Briefcase, Palette, TrendingUp, Store, 
  Layers, Shield, Globe, Landmark, Users, GraduationCap,
  Dumbbell, Utensils, ShoppingBag, Box, CheckCircle2, Zap, 
  Cpu, Rocket, Sparkles, Gem
} from 'lucide-react';
import Link from 'next/link';

// Import the existing Trending Products component
import TrendingProductsSection from '@/components/showroom/TrendingProductsSection';

export default function WelcomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white selection:bg-green-500/30">
      
      {/* 1. MEGA HERO SECTION */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] bg-green-600/20 rounded-full blur-[120px] animate-pulse delay-700" />
        </div>

        <div className="relative z-10 px-8 text-center max-w-6xl mx-auto">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-6 py-2 text-sm font-medium text-green-400 mb-12 backdrop-blur-md">
            <Sparkles className="mr-2 h-4 w-4 animate-spin-slow" />
            The Future of RWA & Creator Commerce is here.
          </div>
          
          <h1 className="text-6xl md:text-9xl font-extrabold tracking-tighter mb-8 leading-[0.9]">
            Tokenize <span className="text-transparent bg-clip-text bg-gradient-to-b from-green-300 to-green-600">Anything.</span><br />
            <span className="text-white/90">Own the Future.</span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-3xl mx-auto leading-relaxed font-light">
            SECURE MetaWork is a blockchain ecosystem where physical assets, intellectual property, and creative vision transform into <span className="text-white font-medium">tokenized digital assets</span>. No intermediaries. No limits.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link href="/login" className="w-full sm:w-auto">
              <Button size="lg" className="h-16 px-10 text-xl w-full bg-green-600 hover:bg-green-500 hover:scale-105 transition-all duration-300 rounded-2xl shadow-[0_0_40px_rgba(34,197,94,0.3)]">
                Launch My Business
                <Rocket className="ml-2 h-6 w-6" />
              </Button>
            </Link>
            <Link href="/showroom" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="h-16 px-10 text-xl w-full border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl transition-all">
                <Store className="mr-2 h-6 w-6" />
                Enter Showroom
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. THE ECOSYSTEM BENTO GRID */}
      <section className="px-8 py-24 bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <h2 className="text-4xl md:text-6xl font-bold mb-6">Two Sides.<br /><span className="text-slate-500">One Infinite Loop.</span></h2>
            <p className="text-xl text-slate-400 max-w-xl">We’ve built the bridge between the digital economy and physical manufacturing.</p>
          </div>

          <div className="grid md:grid-cols-12 gap-6">
            {/* Business Side */}
            <Card className="md:col-span-7 bg-gradient-to-br from-slate-900 to-slate-950 border-white/10 overflow-hidden relative group">
              <div className="absolute -right-20 -bottom-20 opacity-10 group-hover:opacity-20 transition-opacity">
                <Cpu size={400} />
              </div>
              <CardContent className="p-12 relative z-10">
                <div className="h-14 w-14 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-8">
                  <Shield className="h-8 w-8 text-blue-400" />
                </div>
                <h3 className="text-4xl font-bold mb-4 text-white">Businesses & Creators</h3>
                <p className="text-slate-400 text-lg mb-8 max-w-md">Our pro-grade design engine allows you to mint IP, create 500+ products, and deploy a personal storefront (Aisle) in seconds.</p>
                <div className="grid grid-cols-2 gap-4 text-sm font-medium text-slate-300">
                  <div className="flex items-center gap-2"><CheckCircle2 className="text-green-500 h-4 w-4" /> Instant Licensing</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="text-green-500 h-4 w-4" /> 3D Sculpting Tools</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="text-green-500 h-4 w-4" /> Zero Inventory Risk</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="text-green-500 h-4 w-4" /> Global Fulfillment</div>
                </div>
              </CardContent>
            </Card>

            {/* Shopper Side */}
            <Card className="md:col-span-5 bg-gradient-to-br from-green-900/20 to-slate-950 border-white/10 overflow-hidden relative group">
              <div className="absolute -right-10 -top-10 opacity-10 group-hover:opacity-20 transition-opacity">
                <ShoppingBag size={300} />
              </div>
              <CardContent className="p-12 relative z-10">
                <div className="h-14 w-14 rounded-2xl bg-green-500/20 flex items-center justify-center mb-8">
                  <Store className="h-8 w-8 text-green-400" />
                </div>
                <h3 className="text-4xl font-bold mb-4 text-white">Shoppers & Fans</h3>
                <p className="text-slate-400 text-lg mb-8 font-light leading-relaxed">Discover decentralized brands and support creators directly. Every purchase is tracked on-chain.</p>
                <Link href="/showroom">
                  <Button variant="link" className="px-0 text-green-400 text-lg hover:gap-3 transition-all">
                    Explore the Showroom <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 3. INDUSTRY POWERHOUSE */}
      <section className="px-8 py-32 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-5xl md:text-7xl font-bold mb-8 italic tracking-tighter">Industries We <span className="text-green-500 uppercase">Dominate.</span></h2>
            <div className="h-1 w-24 bg-green-600 mx-auto" />
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              { icon: <Dumbbell />, title: "Gyms & Fitness", desc: "Monetize your community with 'Drop Culture'. Tokenize limited edition apparel and gear for your members." },
              { icon: <GraduationCap />, title: "Education", desc: "Enable students to learn entrepreneurship by launching real-world products with zero capital outlay." },
              { icon: <Utensils />, title: "Food & Beverage", desc: "Custom tap handles, merch, and branded glassware delivered directly to your fans. No warehouse needed." },
              { icon: <Users />, title: "Non-Profits", desc: "Transparent, blockchain-verified fundraising. Donors see the impact; you get the revenue." },
              { icon: <Palette />, title: "Creators & Artists", desc: "Your art belongs on more than just a screen. Tokenize your IP into 500+ physical product types." },
              { icon: <Gem />, title: "Retailers", desc: "Test new product lines without the risk of dead inventory. Scale instantly based on real demand." }
            ].map((industry, i) => (
              <div key={i} className="group p-8 rounded-3xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all">
                <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-green-500/20 transition-all duration-500">
                  {i === 0 ? <Dumbbell className="h-8 w-8 text-green-400" /> : 
                   i === 1 ? <GraduationCap className="h-8 w-8 text-purple-400" /> :
                   i === 2 ? <Utensils className="h-8 w-8 text-orange-400" /> :
                   i === 3 ? <Users className="h-8 w-8 text-blue-400" /> :
                   i === 4 ? <Palette className="h-8 w-8 text-pink-400" /> :
                             <Gem className="h-8 w-8 text-yellow-400" />}
                </div>
                <h3 className="text-2xl font-bold mb-4">{industry.title}</h3>
                <p className="text-slate-400 leading-relaxed font-light">{industry.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. MINIATURE SHOWROOM (NEW) */}
      <section className="px-8 py-32 bg-[#020617] border-y border-white/5 relative overflow-hidden">
        {/* Glow effect for the section */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[600px] bg-green-900/10 blur-[150px] pointer-events-none rounded-full" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12">
            <div className="max-w-2xl">
              <h2 className="text-4xl md:text-6xl font-bold mb-6">Live from the <span className="text-green-500">Showroom</span></h2>
              <p className="text-xl text-slate-400 font-light">
                Real products. Real IP. Real revenue. See what our community is building, tokenizing, and selling right now.
              </p>
            </div>
            <Link href="/showroom" className="hidden md:block shrink-0 mb-2">
              <Button variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 rounded-xl h-12 px-6">
                Explore Full Market <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          <div className="p-8 rounded-3xl border border-white/5 bg-black/40 backdrop-blur-xl shadow-2xl">
            {/* This integrates your existing TrendingProductsSection component directly!
              Because your component fetches from '/api/showroom', it works out of the box here.
            */}
            <TrendingProductsSection />
          </div>

          <div className="mt-10 text-center md:hidden">
            <Link href="/showroom">
              <Button variant="outline" className="w-full border-white/20 bg-white/5 hover:bg-white/10 rounded-xl h-14 text-lg">
                Explore Full Market <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 5. THE 5-STEP JOURNEY */}
      <section className="px-8 py-32 bg-slate-950 relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold text-center mb-24">The Path to <span className="text-green-500">MetaWealth</span></h2>
          
          <div className="space-y-24">
            {[
              { step: "01", title: "Mint & Price", desc: "Upload your IP. Set your per-use licensing fee. Your vision is now a tradeable asset on the Algorand blockchain.", icon: <Shield /> },
              { step: "02", title: "Design in 2D & 3D", desc: "Use our cloud-native creator. From custom t-shirts to 3D-sculpted tap handles, if you can dream it, we can make it.", icon: <Box /> },
              { step: "03", title: "Instant Aisle", desc: "Launch your storefront immediately. Your products are listed, indexed, and ready for global commerce with one click.", icon: <Zap /> },
              { step: "04", title: "Autonomous Fulfillment", desc: "When a customer buys, we manufacture locally and ship globally. You never touch a box. You never worry about stock.", icon: <Globe /> },
              { step: "05", title: "Stablecoin Payouts", desc: "Revenue is split automatically by smart contracts. Royalties for IP owners and margins for designers are paid instantly.", icon: <Coins /> }
            ].map((step, i) => (
              <div key={i} className="flex flex-col md:flex-row gap-12 items-start group">
                <div className="text-7xl font-black text-white/5 group-hover:text-green-500/20 transition-colors duration-500">
                  {step.step}
                </div>
                <div>
                  <h3 className="text-3xl font-bold mb-4 flex items-center gap-4">
                    {step.title} 
                    <ArrowRight className="h-6 w-6 text-green-500 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all" />
                  </h3>
                  <p className="text-xl text-slate-400 font-light leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. THE FINAL CALL */}
      <section className="px-8 py-40 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-green-600/10 blur-[150px] rounded-full" />
        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className="text-5xl md:text-8xl font-black mb-12 tracking-tighter italic">READY TO <span className="text-green-500">REIGN?</span></h2>
          <p className="text-2xl text-slate-400 mb-16 font-light">Join thousands of creators and organizations building the future of commerce.</p>
          
          <div className="flex flex-col md:flex-row gap-8 justify-center">
            <div className="p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl flex-1 text-left group hover:border-green-500/50 transition-all">
              <p className="text-green-500 font-bold uppercase tracking-widest text-xs mb-4">Creators</p>
              <h4 className="text-2xl font-bold mb-6">Build your empire from your art.</h4>
              <Link href="/login">
                <Button className="w-full h-14 bg-white text-black hover:bg-slate-200 rounded-xl text-lg font-bold">Start Designing</Button>
              </Link>
            </div>
            <div className="p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl flex-1 text-left group hover:border-blue-500/50 transition-all">
              <p className="text-blue-500 font-bold uppercase tracking-widest text-xs mb-4">Organizations</p>
              <h4 className="text-2xl font-bold mb-6">Turn your community into capital.</h4>
              <Link href="/login">
                <Button variant="outline" className="w-full h-14 border-white/20 hover:bg-white/10 rounded-xl text-lg font-bold">Register Org</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER MINI */}
      <footer className="px-8 py-12 border-t border-white/5 text-center text-slate-600 text-sm">
        <p>© 2026 SECURE MetaWork. Powered by Algorand. Designed for the Bold.</p>
      </footer>
    </div>
  );
}