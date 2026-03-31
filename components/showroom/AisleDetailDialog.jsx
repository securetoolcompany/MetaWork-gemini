'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Eye, 
  Package, 
  Image as ImageIcon, 
  TrendingUp, 
  ShoppingCart,
  Store,
  ArrowRight,
  BarChart3
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export default function AisleDetailDialog({ aisle, open, onOpenChange }) {
  if (!aisle) return null;

  const creatorName = aisle.name || aisle.username || 'Creator';
  
  // Stats mapping from your existing data structures
  const stats = [
    { label: "Aisle Views", value: aisle.stats?.views || 0, icon: Eye, color: "text-blue-500" },
    { label: "Products", value: aisle.stats?.totalProducts || 0, icon: Package, color: "text-purple-500" },
    { label: "IP Assets", value: aisle.stats?.totalIPAssets || 0, icon: ImageIcon, color: "text-orange-500" },
    { label: "Total Sales", value: aisle.stats?.sales || 0, icon: ShoppingCart, color: "text-green-500" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-4 mb-2">
             <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <Store className="h-8 w-8 text-primary" />
             </div>
             <div>
                <DialogTitle className="text-2xl font-bold">{creatorName}'s Aisle</DialogTitle>
                <p className="text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> 
                  Aisle Performance Metrics
                </p>
             </div>
          </div>
        </DialogHeader>

        <Separator className="my-6" />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="p-4 rounded-xl bg-accent/30 border border-border/50 flex flex-col items-center text-center transition-colors hover:bg-accent/50">
              <stat.icon className={`h-5 w-5 mb-2 ${stat.color}`} />
              <span className="text-2xl font-bold tracking-tight">{stat.value.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Top Product Section */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 font-semibold text-lg text-foreground">
              <TrendingUp className="h-5 w-5 text-primary" />
              Most Popular Product
            </h3>
            {aisle.topProduct ? (
              <div className="group relative rounded-xl border border-border bg-muted/20 p-4 flex gap-4 items-center">
                <img src={aisle.topProduct.image} className="h-20 w-20 rounded-lg object-cover shadow-sm" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{aisle.topProduct.name}</p>
                  <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {aisle.topProduct.views}</span>
                    <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> {aisle.topProduct.sales}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground italic">
                Awaiting first product sale...
              </div>
            )}
          </div>

          {/* Top IP Section */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 font-semibold text-lg text-foreground">
              <ImageIcon className="h-5 w-5 text-purple-500" />
              Highest Licensed IP
            </h3>
            {aisle.topIp ? (
              <div className="group relative rounded-xl border border-border bg-muted/20 p-4 flex gap-4 items-center">
                <img src={aisle.topIp.image} className="h-20 w-20 rounded-lg object-cover shadow-sm" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{aisle.topIp.name}</p>
                  <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 text-purple-400">
                      <TrendingUp className="h-3 w-3" /> 
                      {aisle.topIp.licenses || 0} Licenses
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground italic">
                No IP licensing data yet.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
           <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">Aisle Status</span>
              <Badge variant="outline" className="mt-1 text-green-500 border-green-500/20 bg-green-500/5 px-3 py-1">
                Verified MetaWork Creator
              </Badge>
           </div>
           <Button 
             size="lg"
             onClick={() => window.location.href = `/aisle/${aisle.username || aisle.id}`}
             className="w-full sm:w-auto px-8 bg-primary hover:scale-105 transition-transform"
           >
             Enter Aisle <ArrowRight className="ml-2 h-4 w-4" />
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}