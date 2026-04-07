import { Shield, Users, Globe, Landmark, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function AboutUs() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 px-8 text-center max-w-5xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6">
            Opening the Global Economy <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-green-300 to-green-600">to Everyone</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto font-light leading-relaxed">
            A blockchain-powered ecosystem for workers, creators, and investors.
          </p>
        </div>
      </section>

      <section className="px-8 py-20 bg-slate-950">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Users className="text-green-500" /> Who We Are
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              MetaWork is a blockchain-powered platform that helps people earn income, own assets, and grow wealth from anywhere in the world. We connect everyday workers, creators, and investors in one simple, transparent ecosystem.
            </p>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Shield className="text-blue-500" /> The Problem We Solve
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Billions of people are unbanked, underpaid, or shut out of traditional finance and entrepreneurship. They have skills and ideas, but lack access to fair work, tools, and capital. MetaWork exists to close that gap.
            </p>
          </div>
          <div className="grid gap-6">
            <Card className="bg-white/5 border-white/10 p-8">
              <h3 className="text-xl font-bold mb-4 text-green-400">How MetaWork Works</h3>
              <ul className="space-y-4 text-slate-300">
                <li className="flex gap-3 text-sm italic"><Zap className="shrink-0 h-5 w-5 text-yellow-500" /> <strong>Workers:</strong> Earn through MetaJobs completing tasks like surveys for crypto.</li>
                <li className="flex gap-3 text-sm italic"><Landmark className="shrink-0 h-5 w-5 text-blue-500" /> <strong>Creators:</strong> Use MetaManufacturing to design products with no inventory.</li>
                <li className="flex gap-3 text-sm italic"><Globe className="shrink-0 h-5 w-5 text-green-500" /> <strong>Investors:</strong> Access tokenized, real-world revenue streams.</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      <section className="px-8 py-20 bg-black text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-8">Trust & Transparency</h2>
          <p className="text-xl text-slate-400 font-light mb-12">
            All earnings, assets, and payouts are tracked on secure blockchains like Algorand. Smart contracts automate payments so people are paid fairly and on time, without middlemen.
          </p>
          <div className="p-1 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl inline-block">
            <div className="bg-black px-8 py-4 rounded-[14px]">
              <p className="font-bold text-xl italic tracking-widest">MISSION: ECONOMIC OPPORTUNITY FOR ALL</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}