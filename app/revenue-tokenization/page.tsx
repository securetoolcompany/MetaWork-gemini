// app/revenue-tokenization/page.tsx
import Link from "next/link";
import {
  Coins,
  ImageIcon,
  Music,
  Box,
  Share2,
  Users,
  LineChart,
  ArrowRight,
  Upload,
  FileEdit,
  CheckCircle,
  Link2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RevenueTokenizationPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 py-8 px-4 sm:px-6">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-background p-8 md:p-12 text-center md:text-left flex flex-col md:flex-row items-center gap-8 shadow-sm">
        <div className="flex-1 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-600 dark:text-indigo-400">
            <Coins className="h-4 w-4" />
            Monetize Your IP
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">
            Revenue Tokenization
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Turn your intellectual property into revenue‑sharing tokens. Perfect for product designs, media, or digital files that generate yield over time.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
            <Button asChild size="lg" className="gap-2">
              <Link href="/upload-ip?mode=token">
                Start Tokenization <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
        
        {/* Abstract Graphic Representation */}
        <div className="hidden md:flex flex-1 justify-center relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 blur-3xl rounded-full" />
          <div className="relative grid grid-cols-2 gap-4">
            <div className="flex items-center justify-center h-24 w-24 rounded-2xl bg-background border shadow-lg rotate-[-6deg] hover:rotate-0 transition-transform">
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-center h-24 w-24 rounded-2xl bg-background border shadow-lg mt-8 rotate-[6deg] hover:rotate-0 transition-transform">
              <Music className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-center h-24 w-24 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 col-span-2 mx-auto -mt-4 z-10 scale-110">
              <Coins className="h-12 w-12" />
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-none border-muted/60">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Box className="h-5 w-5 text-indigo-500" />
              What You Can Tokenize
            </CardTitle>
            <CardDescription>Assets that generate ongoing value</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[
                { icon: ImageIcon, text: "Images, artwork, and media for your IP Library" },
                { icon: Box, text: "3D print files, schematics, and CAD assets" },
                { icon: Music, text: "Music, audio, video content, and digital rights" },
                { icon: LineChart, text: "Product designs and other monetizable inventions" },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <div className="mt-0.5 rounded-full bg-secondary p-1">
                    <item.icon className="h-3 w-3 text-foreground" />
                  </div>
                  {item.text}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-none border-muted/60">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Share2 className="h-5 w-5 text-purple-500" />
              What Tokenization Does
            </CardTitle>
            <CardDescription>The power of on-chain revenue sharing</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[
                { icon: Coins, text: "Creates on‑chain tokens representing future revenue shares" },
                { icon: Users, text: "Lets you effortlessly define stakeholders and split percentages" },
                { icon: Share2, text: "Enables trading or transferring revenue rights over time" },
                { icon: Link2, text: "Connects directly to your products for automated tracking and payouts" },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <div className="mt-0.5 rounded-full bg-secondary p-1">
                    <item.icon className="h-3 w-3 text-foreground" />
                  </div>
                  {item.text}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Visual Flowchart / Process */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight text-center">How It Works</h2>
        <div className="relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-1/2 left-[10%] right-[10%] h-0.5 -translate-y-1/2 bg-border z-0" />
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
            {[
              { step: 1, icon: Upload, title: "Upload", desc: "Upload the IP asset you want to tokenize securely." },
              { step: 2, icon: FileEdit, title: "Describe", desc: "Detail the asset and how it generates revenue." },
              { step: 3, icon: Users, title: "Split", desc: "Add stakeholders and define fair revenue shares." },
              { step: 4, icon: CheckCircle, title: "Mint", desc: "Mint tokens and connect them to your sales pools." },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center p-4 rounded-xl bg-card border shadow-sm relative group hover:border-indigo-500/50 transition-colors">
                <div className="h-12 w-12 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mb-2">Step {s.step}: {s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cross-navigation / Comparison Footer */}
      <section className="mt-12 rounded-2xl bg-secondary/50 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 max-w-xl">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            Looking for Minting Authentication?
          </h3>
          <p className="text-sm text-muted-foreground">
            If you don't need revenue sharing and simply want to prove a document, certificate, or file is authentic and unaltered, use the standard Minting Authentication flow.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/mint-authentication">Switch to Authentication</Link>
        </Button>
      </section>
    </div>
  );
}