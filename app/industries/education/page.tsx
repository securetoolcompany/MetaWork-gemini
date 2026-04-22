import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Terminal, GraduationCap, ArrowRight, Library, PieChart, 
  Lightbulb, ChevronRight, BookOpen, Clock, Home, Zap,
  CheckCircle2, Target
} from 'lucide-react';
import Link from 'next/link';

export default function EducationPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-indigo-500/30">
      
      {/* HERO SECTION */}
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-8">
            <Link href="/industries" className="hover:text-indigo-400 transition-colors">INDUSTRIES</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-indigo-400">EDUCATION_AND_ACADEMY_MODULE</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
            Real-world commerce. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">Zero budget required.</span>
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed font-light mb-8 max-w-2xl">
            Replace theoretical business classes with actual commerce. Schools use MetaWork to let students design products, launch storefronts, and raise real funds for clubs and teams—without touching district budgets.
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

      {/* CORE CAPABILITIES */}
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
                No more door-to-door candy sales. Tokenize a project to raise funds. Parents and alumni buy digital tokens to support the marching band or robotics club, with all funds tracked transparently.
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

      {/* ROBUST DEPLOYMENT TRACKS */}
      <section className="px-8 py-24 bg-zinc-900/20 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">MetaWork Academy Deployment Tracks</h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-3xl">
              We provide comprehensive, turn-key educational pipelines adapted for public school districts, independent co-ops, and youth organizations. Every track is engineered to deliver measurable financial literacy and entrepreneurial self-sufficiency.
            </p>
          </div>

          <div className="space-y-12">
            
            {/* TRACK 1: Classroom Curriculum */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-indigo-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <BookOpen className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-indigo-500/10 px-2 py-1 text-xs font-mono text-indigo-400 mb-4 border border-indigo-500/20">
                    TRACK_01: IN_SCHOOL
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Classroom Curriculum (CTE)</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Designed for Career and Technical Education (CTE) and business electives in public school districts. Students bypass theoretical business plans and launch live, compliant Web3 brands over a 16-week semester.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-indigo-400" /> Educational Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-indigo-400 mr-2">-</span> Grasp end-to-end supply chain mechanics.</li>
                      <li className="flex items-start"><span className="text-indigo-400 mr-2">-</span> Calculate retail margins, COGS, and profit splits.</li>
                      <li className="flex items-start"><span className="text-indigo-400 mr-2">-</span> Understand IP ownership and cryptographic licensing.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Standardized Operating Procedures (SOPs) for teachers.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Sandboxed MetaWork environments for student safety.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Administrator dashboard for district-level analytics.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 2: After-School Programs */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-indigo-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Clock className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-indigo-500/10 px-2 py-1 text-xs font-mono text-indigo-400 mb-4 border border-indigo-500/20">
                    TRACK_02: EXTRACURRICULAR
                  </div>
                  <h3 className="text-2xl font-bold mb-4">After-School Programs</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Empowers extracurricular clubs, sports teams, and student organizations to become financially self-sustaining. Students build their own merchandising Aisles to fund travel, equipment, and events without relying on school budgets.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-indigo-400" /> Educational Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-indigo-400 mr-2">-</span> Real-world project management and leadership.</li>
                      <li className="flex items-start"><span className="text-indigo-400 mr-2">-</span> Grassroots community marketing and digital sales.</li>
                      <li className="flex items-start"><span className="text-indigo-400 mr-2">-</span> Financial independence and resource allocation.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Club onboarding kits and fast-launch templates.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Live crowdfunding progress trackers.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Automated treasury routing to secure club bank accounts.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 3: Homeschool & ESA */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-indigo-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Home className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-indigo-500/10 px-2 py-1 text-xs font-mono text-indigo-400 mb-4 border border-indigo-500/20">
                    TRACK_03: INDEPENDENT
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Homeschool & ESA Programs</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Tailor-made for Empowerment Scholarship Account (ESA) networks and homeschool co-ops. Parents facilitate micro-economies from home, teaching children practical business mechanics inside a secure, monitored dashboard.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-indigo-400" /> Educational Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-indigo-400 mr-2">-</span> Foster independent digital design skills.</li>
                      <li className="flex items-start"><span className="text-indigo-400 mr-2">-</span> Teach foundational Web3 and blockchain literacy.</li>
                      <li className="flex items-start"><span className="text-indigo-400 mr-2">-</span> Connect creativity directly to economic value.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Parent-educator pacing guides and rubrics.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> At-home IP creation and copyright tutorials.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Compliant financial reporting tools for state ESA audits.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* TRACK 4: Workshops & Bootcamps */}
            <div className="border border-zinc-800 bg-zinc-950 p-8 hover:border-indigo-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Zap className="w-48 h-48" />
              </div>
              <div className="relative z-10 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="inline-flex items-center rounded bg-indigo-500/10 px-2 py-1 text-xs font-mono text-indigo-400 mb-4 border border-indigo-500/20">
                    TRACK_04: INTENSIVE
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Workshops & Bootcamps</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    High-impact, short-term deployments ideal for summer camps, weekend seminars, or youth initiatives (e.g., Boys & Girls Clubs). A rapid accelerator for youth entrepreneurship.
                  </p>
                </div>
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <Target className="mr-2 h-4 w-4 text-indigo-400" /> Educational Goals
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-indigo-400 mr-2">-</span> Rapid prototyping and "Design-to-Sale" ideation.</li>
                      <li className="flex items-start"><span className="text-indigo-400 mr-2">-</span> Familiarization with digital wallets and asset security.</li>
                      <li className="flex items-start"><span className="text-indigo-400 mr-2">-</span> Quick-cycle iteration based on market feedback.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-white mb-3">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Platform Deliverables
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400">
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Compressed 48-hour sprint curriculums.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Pre-loaded IP blank templates for immediate design.</li>
                      <li className="flex items-start"><span className="text-emerald-400 mr-2">-</span> Cryptographically verified NFT certificates of completion.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Terminal View / Live Data Mockup */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto rounded-md border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-2xl">
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
            <div className="w-full bg-zinc-950 h-2 rounded mt-4 overflow-hidden border border-zinc-800">
              <div className="bg-indigo-500 h-full w-[100%]" />
            </div>
            <div className="mt-4 text-xs text-zinc-400 pt-4">
              <p className="text-indigo-400 mb-2">SMART_CONTRACT_LOG &gt;</p>
              <p>&gt; Target exceeded. Hardware purchasing unlocked.</p>
              <p>&gt; 15% revenue split activated for student creator wallets.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}