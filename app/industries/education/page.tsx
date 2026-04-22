import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, GraduationCap, ArrowRight, Library, PieChart, Lightbulb, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function EducationPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-indigo-500/30">
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
            <Link href="/industries" className="hover:text-indigo-400">INDUSTRIES</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-indigo-400">EDUCATION_SECTOR</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            Education & Campus Commerce. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">Zero budget required.</span>
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8 max-w-2xl">
            Replace theoretical business classes with actual commerce. Schools use MetaWork to let students design products, launch storefronts, and raise real funds for clubs and teams without touching school budgets.
          </p>
          <div className="flex gap-4">
            <Link href="/register">
              <Button size="lg" className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-none font-mono">
                <Terminal className="mr-2 h-4 w-4" /> Initialize Class Network
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6">
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-indigo-500/50">
            <CardHeader>
              <Lightbulb className="h-8 w-8 text-indigo-400 mb-2" />
              <CardTitle className="font-mono text-lg">Student Enterprises</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Students use the MetaManufacturing design engine to create school spirit wear. They publish live Aisles (storefronts) and run marketing campaigns, learning supply chain logistics safely.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-indigo-500/50">
            <CardHeader>
              <PieChart className="h-8 w-8 text-indigo-400 mb-2" />
              <CardTitle className="font-mono text-lg">Transparent Fundraising</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                No more door-to-door candy sales. Tokenize a project to raise funds. Parents and alumni buy digital tokens to support the marching band or robotics club, with all funds tracked transparently on the blockchain.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/40 border-zinc-800 rounded-none border-t-2 border-t-indigo-500/50">
            <CardHeader>
              <Library className="h-8 w-8 text-indigo-400 mb-2" />
              <CardTitle className="font-mono text-lg">Credential Verification</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Universities can tokenize student transcripts and diplomas as immutable digital assets on Algorand, making credential verification instantaneous and eliminating degree fraud.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
          <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between">
            <div className="flex gap-2"><div className="h-3 w-3 rounded-full bg-red-500/20" /><div className="h-3 w-3 rounded-full bg-yellow-500/20" /></div>
            <span className="text-[10px] font-mono text-indigo-400">/edu/fundraising-tracker</span>
          </div>
          <div className="p-8 font-mono text-sm space-y-4">
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>ACTIVE_CLASS_PROJECT:</span><span className="text-zinc-300">ROBOTICS_TEAM_MERCH</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>FUNDING_TARGET:</span><span className="text-indigo-400">$2,500.00</span>
            </div>
            <div className="flex justify-between text-zinc-500 border-b border-zinc-800 pb-2">
              <span>CAPITAL_GENERATED:</span><span className="text-emerald-400">$3,120.00 (124% FUNDED)</span>
            </div>
            <div className="w-full bg-zinc-900 h-2 rounded mt-4 overflow-hidden">
              <div className="bg-indigo-500 h-full w-full" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}