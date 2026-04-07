import { Dumbbell, GraduationCap, Utensils, Palette, Gem } from 'lucide-react';

export default function IndustriesPage() {
  const industries = [
    { icon: <Dumbbell className="text-green-400" />, title: "Gyms & Fitness", desc: "Launch limited-edition gear. Tokenize perks so members feel genuinely invested." },
    { icon: <GraduationCap className="text-purple-400" />, title: "Education", desc: "Teach entrepreneurship by selling real products with zero upfront cost." },
    { icon: <Utensils className="text-orange-400" />, title: "Food & Beverage", desc: "Sell branded glassware or tokenize revenue to raise capital from fans." },
    { icon: <Palette className="text-pink-400" />, title: "Creators & Artists", desc: "Turn art into licensed assets that earn royalties on every physical sale." },
    { icon: <Gem className="text-blue-400" />, title: "Retailers", desc: "Test product lines with no inventory risk. Scale instantly based on demand." }
  ];

  return (
    <div className="bg-black text-white min-h-screen">
      <section className="pt-32 pb-20 px-8 text-center">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 italic uppercase tracking-tighter">Built for <span className="text-green-500">Real-World</span> Industries</h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
          From gyms and schools to artists and bakeries. MetaWork tools support digital creators and traditional local businesses.
        </p>
      </section>

      <section className="px-8 py-20 bg-slate-950">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {industries.map((ind, i) => (
            <div key={i} className="p-10 rounded-[40px] border border-white/5 bg-black hover:border-white/20 transition-all flex flex-col items-center text-center">
              <div className="h-20 w-20 rounded-3xl bg-white/5 flex items-center justify-center mb-8">
                {ind.icon}
              </div>
              <h3 className="text-2xl font-bold mb-4">{ind.title}</h3>
              <p className="text-slate-400 font-light leading-relaxed">{ind.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}