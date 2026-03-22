import React, { useMemo, useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Palette, Ruler, DollarSign, Layers, Info, CheckCircle, 
  AlertTriangle, XCircle, Paintbrush, Loader2, Shapes 
} from 'lucide-react';

export default function BlankProductDetailsDialog({ open, onOpenChange, product, onSelect }) {
  const [detailedProduct, setDetailedProduct] = useState(null);
  const [loading, setLoading] = useState(false);

  // Reset state on close
  useEffect(() => {
    if (!open) { setDetailedProduct(null); setLoading(false); }
  }, [open]);

  // Fetch full details (variants) on open
  useEffect(() => {
    if (open && product && !detailedProduct) {
      const fetchDetails = async () => {
        setLoading(true);
        try {
          const id = product.catalogProductId || product.id;
          
          // Use the dynamic Metawork handler
          const res = await fetch(`/api/metawork/products/${id}`); 
          
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.product) {
              // FLATTEN: Merge the live specs directly into a single object
              setDetailedProduct({
                ...product,
                ...data.product
              }); 
            }
          }
        } catch (error) {
          console.error("Failed to fetch variants:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchDetails();
    }
  }, [open, product, detailedProduct]);

  // Single source of truth
  const activeProduct = detailedProduct || product;

  // --- DATA ANALYSIS (The "Report" Logic) ---
  const report = useMemo(() => {
    if (!activeProduct) return null;

    const rawVariants = activeProduct.variants || [];
    const seen = new Set();
    
    // 1. PRIMARY FILTER: Remove redundant objects based on Size and Price
    const variants = rawVariants.filter(v => {
      const price = Number(v.retail_price || v.price || 0).toFixed(2);
      const size = v.size || 'One size';
      const key = `${size}|${price}`; 
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 2. COLORS: Aggregate unique colors from the raw list
    const uniqueColors = new Map();
    rawVariants.forEach(v => {
      if (v.color) uniqueColors.set(v.color, v.color_code || '#e2e8f0');
    });

    // 3. PRICING: Build strict Size-to-Price mapping
    const prices = new Map(); 
    const priceSeen = new Set(); // SECOND GUARD: Ensures "One size" appears once per price row

    variants.forEach(v => {
      const p = Number(v.retail_price || v.price || 0).toFixed(2);
      const sizeLabel = v.size || "One size";
      const priceKey = `${p}|${sizeLabel}`;

      if (Number(p) > 0 && !priceSeen.has(priceKey)) {
        if (!prices.has(p)) prices.set(p, new Set());
        prices.get(p).add(sizeLabel);
        priceSeen.add(priceKey);
      }
    });

    // 4. TABLE GENERATION: Format the Map into an array for UI
    const priceTable = Array.from(prices.entries()).map(([price, optSet]) => ({
      price,
      options: Array.from(optSet).join(', ')
    })).sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

    return {
      colors: Array.from(uniqueColors.entries()).map(([name, hex]) => ({ name, hex })),
      priceTable,
      technique: activeProduct.technique || 'Standard Print',
      stockStatus: { 
        isOutOfStock: rawVariants.length > 0 && rawVariants.every(v => !v.in_stock) 
      }
    };
  }, [activeProduct]);

  if (!product || !report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] p-0 bg-slate-950 border-slate-800 text-slate-100 overflow-hidden flex flex-col">
        
        <DialogHeader className="p-6 border-b border-slate-800 bg-slate-900/50 flex-shrink-0">
          <DialogTitle className="text-xl font-bold">{product.name}</DialogTitle>
          <Badge variant="outline" className="mt-2 text-slate-400 border-slate-700">
            {report.technique}
          </Badge>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="grid md:grid-cols-12 min-h-full">
            {/* Image Preview */}
            <div className="md:col-span-5 bg-white p-8 border-r border-slate-800/50 flex items-center justify-center">
              <img 
                src={activeProduct.image || product.thumbnailUrl} 
                alt={product.name} 
                className="max-h-full object-contain" 
              />
            </div>

            {/* Details & Pricing */}
            <div className="md:col-span-7 p-6 space-y-8 bg-slate-950/50">
              <div className="space-y-4">
                 <h3 className="font-semibold text-white">Description</h3>
                 <p className="text-sm text-slate-400 leading-relaxed">
                   {activeProduct.description || "No description available."}
                 </p>
                 
                 {report.colors.length > 0 && (
                   <div className="pt-2">
                     <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Available Colors</h4>
                     <div className="flex flex-wrap gap-2">
                       {report.colors.map((c, i) => (
                         <div key={i} className="w-6 h-6 rounded-full border border-slate-700" style={{ backgroundColor: c.hex }} title={c.name} />
                       ))}
                     </div>
                   </div>
                 )}
              </div>

              <Separator className="bg-slate-800" />

              <div className="space-y-3">
                 <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                   <DollarSign className="w-4 h-4 text-green-500" /> Pricing Matrix
                 </h4>
                 <div className="rounded-md border border-slate-800 overflow-hidden text-sm bg-slate-900/50">
                    <div className="grid grid-cols-12 p-2 bg-slate-900 border-b border-slate-800 font-medium text-slate-400">
                       <div className="col-span-8">Size</div>
                       <div className="col-span-4 text-right">Your Cost</div>
                    </div>
                    {loading ? (
                        <div className="p-4 flex justify-center"><Loader2 className="animate-spin h-5 w-5 text-slate-500" /></div>
                    ) : report.priceTable.map((row, idx) => (
                       <div key={idx} className="grid grid-cols-12 p-2 border-b border-slate-800/50 last:border-0 hover:bg-slate-900/30">
                          <div className="col-span-8 text-slate-300">{row.options}</div>
                          <div className="col-span-4 text-right text-green-400 font-mono font-bold">${row.price}</div>
                       </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t border-slate-800 bg-slate-900/50 flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800">
            Close
          </Button>
          <Button 
            onClick={() => onSelect(activeProduct)} 
            disabled={loading || report.stockStatus.isOutOfStock} 
            className="bg-blue-600 hover:bg-blue-500 text-white min-w-[140px]"
          >
             {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paintbrush className="w-4 h-4 mr-2" />}
             Design Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}