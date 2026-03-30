// app/admin/dashboard/page.js
'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminDashboard() {
  return (
    <div className="p-10 space-y-10 bg-[#020617] min-h-screen text-slate-100">
      <header className="space-y-2">
        <h1 className="text-4xl font-black tracking-tighter uppercase italic">Platform Command</h1>
        <p className="text-slate-400">Manage sitewide configurations, ads, and network status.</p>
      </header>
      
      <Tabs defaultValue="ads" className="w-full">
        <TabsList className="bg-slate-900 border border-white/5 p-1">
          <TabsTrigger value="stats">Sitewide Stats</TabsTrigger>
          <TabsTrigger value="ads">Global Ads</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
        </TabsList>

        <TabsContent value="ads" className="mt-8 space-y-6">
          <Card className="bg-slate-900/50 border-white/5">
            <CardHeader>
              <CardTitle>Global Ad Placements</CardTitle>
              <CardDescription>Upload ads to appear on all non-Verified user aisles.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-8">
              {['topBanner', 'sidebar', 'inGrid'].map((slot) => (
                <div key={slot} className="space-y-4 p-4 rounded-xl bg-slate-950 border border-white/5">
                  <Label className="capitalize font-bold text-sky-400">{slot.replace(/([A-Z])/g, ' $1')}</Label>
                  <Input type="file" className="bg-slate-900 border-white/10" />
                  <Input placeholder="Ad Title" className="bg-slate-900 border-white/10" />
                  <Input placeholder="CTA URL" className="bg-slate-900 border-white/10" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network">
          <Card className="bg-slate-900/50 border-white/5">
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Production Mainnet</h3>
                <p className="text-sm text-slate-400">Toggle between Algorand Testnet and Mainnet.</p>
              </div>
              <Switch />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}