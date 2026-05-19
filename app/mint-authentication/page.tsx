// app/mint-authentication/page.tsx
import Link from "next/link";
import {
  ShieldCheck,
  FileSignature,
  FileText,
  Stamp,
  ArrowRight,
  Upload,
  ListPlus,
  Link2,
  CheckCircle,
  History,
  Lock
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MintAuthenticationPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 py-8 px-4 sm:px-6">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-background p-8 md:p-12 text-center md:text-left flex flex-col md:flex-row items-center gap-8 shadow-sm">
        <div className="flex-1 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            Prove Authenticity
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">
            Minting Authentication
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Create a tamper‑evident, time‑stamped record for important documents. Perfect for diplomas, contracts, deeds, and establishing immutable provenance.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
            <Button asChild size="lg" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Link href="/upload-ip?mode=auth">
                Start Authentication <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
        
        {/* Abstract Graphic Representation */}
        <div className="hidden md:flex flex-1 justify-center relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 blur-3xl rounded-full" />
          <div className="relative flex items-center justify-center">
            {/* Background elements */}
            <div className="absolute -left-6 top-4 h-20 w-20 rounded-lg bg-background border shadow-sm flex items-center justify-center rotate-[-12deg]">
               <FileSignature className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="absolute -right-6 bottom-4 h-20 w-20 rounded-lg bg-background border shadow-sm flex items-center justify-center rotate-[12deg]">
               <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            {/* Center piece */}
            <div className="relative z-10 flex flex-col items-center justify-center h-40 w-32 rounded-xl bg-background border-2 border-emerald-500 shadow-xl shadow-emerald-500/20">
              <Stamp className="h-12 w-12 text-emerald-500 mb-2" />
              <div className="h-1 w-12 bg-muted rounded-full mb-1" />
              <div className="h-1 w-8 bg-muted rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-none border-muted/60">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-500" />
              What You Can Authenticate
            </CardTitle>
            <CardDescription>Secure your most critical documents</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[
                { icon: FileSignature, text: "Academic records, degrees, and diplomas" },
                { icon: FileText, text: "Legal contracts, NDAs, and formal agreements" },
                { icon: Stamp, text: "Property deeds, title documents, and patents" },
                { icon: ShieldCheck, text: "Certificates, licenses, and professional credentials" },
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
              <Lock className="h-5 w-5 text-teal-500" />
              What You Get
            </CardTitle>
            <CardDescription>The benefits of an on-chain record</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[
                { icon: ShieldCheck, text: "A verifiable on‑chain hash tied directly to your document" },
                { icon: History, text: "An immutable timestamp and unique cryptographic identifier" },
                { icon: Link2, text: "A simple, secure way for third parties to verify authenticity" },
                { icon: CheckCircle, text: "Clean provenance—no revenue tokens or complex splits involved" },
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
              { step: 1, icon: Upload, title: "Upload", desc: "Upload a secure copy of your document or file." },
              { step: 2, icon: ListPlus, title: "Detail", desc: "Add basic details like the title, description, and owner." },
              { step: 3, icon: Stamp, title: "Mint", desc: "Confirm and mint an immutable authentication record." },
              { step: 4, icon: Link2, title: "Verify", desc: "Share the public verification link with anyone." },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center p-4 rounded-xl bg-card border shadow-sm relative group hover:border-emerald-500/50 transition-colors">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-4 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
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
            Looking to earn from your IP?
          </h3>
          <p className="text-sm text-muted-foreground">
            If you want to share, sell, or split future revenue from your Intellectual Property (like a 3D model or music track), use the Revenue Tokenization flow instead.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/revenue-tokenization">Switch to Tokenization</Link>
        </Button>
      </section>
    </div>
  );
}