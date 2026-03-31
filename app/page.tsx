import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Globe, Shield, Coins, Briefcase, Palette, TrendingUp, Store, Layers } from 'lucide-react';
import Link from 'next/link';

export default function WelcomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Hero Section */}
      <section className="px-8 py-24 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-sm font-medium text-green-500 mb-8">
          <Coins className="mr-2 h-4 w-4" />
          The World's First Universal RWA Platform
        </div>
        <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 tracking-tight">
          Tokenize <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">Anything.</span><br />
          Own the Future.
        </h1>
        <p className="text-xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
          MetaWork is the first platform built for everyone to tokenize Real-World Assets (RWAs). Turn your business revenue, intellectual property, and real estate into tradeable digital assets. No banks required.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/login">
            <Button size="lg" className="h-12 px-8 text-lg w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
              Start Tokenizing
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/showroom">
            <Button size="lg" variant="outline" className="h-12 px-8 text-lg w-full sm:w-auto border-blue-500/50 text-blue-500 hover:bg-blue-500/10">
              <Store className="mr-2 h-5 w-5" />
              Browse the Showroom
            </Button>
          </Link>
        </div>
      </section>

      {/* Tokenization Callout Section */}
      <section className="px-8 py-16 bg-green-500/5 border-y border-green-500/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">What Can You Tokenize?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              If it generates value, it can be tokenized. We break physical assets and revenue streams into digital tokens, enabling fractional ownership for everyone.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-background border-green-500/20">
              <CardContent className="pt-6">
                <Briefcase className="h-10 w-10 text-green-500 mb-4" />
                <h3 className="text-xl font-bold mb-2">Business Revenue</h3>
                <p className="text-muted-foreground text-sm">
                  Tokenize a percentage of your local business's future earnings. Get immediate capital while investors earn a passive micro-yield.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-background border-purple-500/20">
              <CardContent className="pt-6">
                <Palette className="h-10 w-10 text-purple-500 mb-4" />
                <h3 className="text-xl font-bold mb-2">Intellectual Property</h3>
                <p className="text-muted-foreground text-sm">
                  Mint your art and designs as NFTs. License them globally and let smart contracts automatically route per-sale royalties to your wallet.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-background border-blue-500/20">
              <CardContent className="pt-6">
                <Layers className="h-10 w-10 text-blue-500 mb-4" />
                <h3 className="text-xl font-bold mb-2">Physical Assets</h3>
                <p className="text-muted-foreground text-sm">
                  From real estate to agricultural yields, tokenize heavy assets into affordable fractions so anyone, anywhere can invest.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Four Pillars Section */}
      <section className="px-8 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">A Tokenized Ecosystem</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A decentralized economy where creators, investors, workers, and shoppers interact directly—secured by the Algorand blockchain.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-border bg-card hover:shadow-xl transition-all duration-300 hover:border-green-500/50">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
                <CardTitle className="text-xl">Investors</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-6">
                  Build a portfolio of yield-bearing RWA tokens. Earn passive income from real-world business activities instantly and transparently.
                </p>
                <Link href="/login">
                  <Button variant="link" className="px-0 text-green-500 hover:text-green-400">
                    Start Investing <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-border bg-card hover:shadow-xl transition-all duration-300 hover:border-purple-500/50">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle className="text-xl">Creators</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-6">
                  Protect your creations on IPFS. Tokenize your art, launch merchandise on your Aisle, and earn automated royalties.
                </p>
                <Link href="/login">
                  <Button variant="link" className="px-0 text-purple-500 hover:text-purple-400">
                    Monetize IP <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-border bg-card hover:shadow-xl transition-all duration-300 hover:border-blue-500/50">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4">
                  <Store className="h-6 w-6 text-blue-500" />
                </div>
                <CardTitle className="text-xl">Consumers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-6">
                  Shop unique, decentralized brands in the public Showroom. Support artists and tokenized businesses directly with every purchase.
                </p>
                <Link href="/showroom">
                  <Button variant="link" className="px-0 text-blue-500 hover:text-blue-400">
                    Visit Showroom <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-border bg-card hover:shadow-xl transition-all duration-300 hover:border-orange-500/50">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-4">
                  <Briefcase className="h-6 w-6 text-orange-500" />
                </div>
                <CardTitle className="text-xl">Workers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-6">
                  Complete surveys and flexible micro-jobs. Get paid instantly in crypto. No bank account or geographical restrictions.
                </p>
                <Link href="/login">
                  <Button variant="link" className="px-0 text-orange-500 hover:text-orange-400">
                    Explore MetaJobs <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}