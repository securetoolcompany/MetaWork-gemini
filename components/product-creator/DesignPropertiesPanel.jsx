"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Layers, Info, X, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { debounce } from "lodash";
import { useRouter } from 'next/navigation';

export default function DesignPropertiesPanel({
  selectedIPs,
  onRemoveIP,
  product,
  baseProductPrice,
  externalProductId,
  printfulTemplateId,
  onTriggerEdmSave,
  refreshNonce,
}) {
  const [variants, setVariants] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [pendingTitle, setPendingTitle] = useState("");
  const router = useRouter();

  const costAnalysis = useMemo(() => {
    let currentBasePrice = Number(baseProductPrice || 0);
    let selectedSize = "Standard";

    if (variants.length > 0 && selectedVariantId) {
      const v = variants.find(
        (i) => (i.id || i.variant_id) === selectedVariantId
      );
      if (v) {
        currentBasePrice = Number(v.retail_price || v.price || 0);
        selectedSize = v.size;
      }
    }

    const ipFees = selectedIPs.reduce(
      (sum, ip) => sum + (Number(ip.licensingFee) || 2.00),
      0
    );

    return {
      base: currentBasePrice,
      ip: ipFees,
      total: currentBasePrice + ipFees,
      size: selectedSize,
    };
  }, [baseProductPrice, variants, selectedVariantId, selectedIPs]);

  console.log('Frontend sending selectedIPs:', JSON.stringify(selectedIPs, null, 2));
  
  const handleConfirmSave = useCallback(
    async (titleOverride) => {
      const title = titleOverride || pendingTitle.trim();
      if (!title) {
        toast.error("Please enter a working title");
        return;
      }

      console.log("🧵 Save Draft clicked (confirm)", {
        externalProductId,
        printfulTemplateId,
        hasOnTriggerEdmSave: !!onTriggerEdmSave,
      });

      const finalTemplateId = printfulTemplateId || null;

      setSaving(true);
      setShowNameDialog(false);

      try {
        console.log('RAW selectedIPs:', JSON.stringify(selectedIPs, null, 2));
        const res = await fetch("/api/products/save-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            externalProductId,
            printfulTemplateId: finalTemplateId,
            selectedIPs,
            baseProduct: {
              ...product,
              selectedVariantId,
              productOptions: [],
            },
            name: title,
            costAnalysis,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Save failed");
        }

        toast.success("Draft saved successfully", {
          description: title,
        });

        router.refresh();

        setPendingTitle(title);
      } catch (err) {
        console.error(err);
        toast.error(err.message || "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [
      pendingTitle,
      externalProductId,
      printfulTemplateId,
      onTriggerEdmSave,
      selectedIPs,
      product,
      costAnalysis,
    ]
  );

  const handleSaveDraft = useCallback(
    debounce(async () => {
      if (saving || !onTriggerEdmSave || selectedIPs.length === 0) return;

      console.log("🧵 Save Draft clicked", {
        externalProductId,
        printfulTemplateId,
        selectedIPs: selectedIPs.length,
      });

      setSaving(true);
try {
      console.log('Triggering EDM save directly (no pre-refresh)');
      await onTriggerEdmSave();
      
      if (printfulTemplateId) {
        await handleConfirmSave(pendingTitle.trim() || product?.name || 'Updated Design');
      } else {
        setShowNameDialog(true);
      }
    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Design save failed");
    } finally {
      setSaving(false);
    }
  }, 1000),
    [
      saving,
      onTriggerEdmSave,
      selectedIPs.length,
      externalProductId,
      printfulTemplateId,
      handleConfirmSave,
      refreshNonce,
    ]
  );

  useEffect(() => {
     if (printfulTemplateId) return;
    setVariants([]);
    setSelectedVariantId(null);

    const loadVariants = async () => {
      if (!product) return;

      if (product.variants && product.variants.length > 0) {
        setVariants(product.variants);
        return;
      }

      const id = product.catalogProductId || product.id;
      if (!id) return;

      try {
        setLoadingVariants(true);
        const res = await fetch(`/api/metawork/products/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.product?.variants) {
            setVariants(data.product.variants);
          }
        }
      } catch (error) {
        console.error("Failed to load variants:", error);
      } finally {
        setLoadingVariants(false);
      }
    };

    loadVariants();
  }, [product]);

  useEffect(() => {
    if (variants.length > 0 && !selectedVariantId) {
      const defaultVar =
        variants.find((v) => v.size === "L") ||
        variants.find((v) => v.size === "M") ||
        variants[0];
      setSelectedVariantId(defaultVar.id || defaultVar.variant_id);
    }
  }, [variants, selectedVariantId]);

  // Add this new effect - syncs pendingTitle from product.name on mount/update
  useEffect(() => {
    if (product?.name && pendingTitle === "") {
      setPendingTitle(product.name);
    }
  }, [product?.name, pendingTitle]);


  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800 text-slate-100">
      <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
        <div className="min-w-0 flex-1 mr-2">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Layers className="w-4 h-4" /> Design Layers
          </h2>
          <p className="text-xs text-slate-500 mt-1 truncate" title={product?.name || 'Product'}>
            {product?.name || 'Product'}
          </p>
        </div>
        <Badge variant="outline" className="text-xs border-slate-700 text-slate-400 flex-shrink-0">
          {selectedIPs.length} {selectedIPs.length === 1 ? 'Asset' : 'Assets'}
        </Badge>
      </div>

      <ScrollArea className="flex-1 p-4">
        {selectedIPs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500 border border-dashed border-slate-700 rounded-lg bg-slate-800/30">
            <Layers className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs">No IP assets selected</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedIPs.map((ip, index) => (
              <div key={ip.id || index} className="group relative flex items-start gap-3 p-3 rounded-md bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors">
                <div className="w-10 h-10 bg-slate-950 rounded border border-slate-700 overflow-hidden flex-shrink-0">
                  <img src={ip.imageUrl || ip.thumbnailUrl} alt={ip.title || ip.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-200 truncate pr-6">{ip.title || ip.name || 'Untitled Asset'}</h4>
                  <div className="mt-1"><span className="text-[10px] font-mono text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">+${(Number(ip.licensingFee) || 2.00).toFixed(2)} cost</span></div>
                </div>
                <button onClick={() => onRemoveIP(ip.id)} className="absolute top-2 right-2 text-slate-500 hover:text-red-400 p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50 space-y-3">
        <div className="flex justify-between items-center h-8">
           <span className="text-xs text-slate-400">Base Product</span>
           {loadingVariants ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading...
              </div>
           ) : variants.length > 1 ? (
              <Select value={selectedVariantId ? String(selectedVariantId) : ''} onValueChange={(val) => setSelectedVariantId(Number(val))}>
                <SelectTrigger className="w-[140px] h-7 text-xs bg-slate-800 border-slate-700 text-slate-200">
                  <SelectValue placeholder="Select Size" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200 max-h-[200px]">
                  {variants.map((v, index) => (
                    <SelectItem key={v.id || v.variant_id || index} value={String(v.id || v.variant_id || index)} className="text-xs">
                      <span className="flex justify-between w-full gap-4">
                        <span>{v.size} {v.color && `/ ${v.color}`}</span>
                        <span className="font-mono">${Number(v.retail_price || v.price).toFixed(2)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
           ) : <span className="text-xs text-slate-300 font-mono">${costAnalysis.base.toFixed(2)}</span>}
        </div>
        <div className="flex justify-between text-xs text-slate-400">
           <span className="flex items-center gap-1">
             IP Licensing 
             <TooltipProvider>
               <Tooltip>
                 <TooltipTrigger>
                   <Info className="w-3 h-3 text-slate-600" />
                 </TooltipTrigger>
                 <TooltipContent side="top" className="text-xs bg-slate-800 text-slate-300">
                   Fees go directly to creators.
                 </TooltipContent>
               </Tooltip>
             </TooltipProvider>
           </span>
           <span>+${costAnalysis.ip.toFixed(2)}</span>
        </div>

        <Separator className="bg-slate-700" />
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold uppercase text-slate-500">Est. Cost</span>
          <span className="text-sm font-bold text-slate-200 font-mono">${costAnalysis.total.toFixed(2)}</span>
        </div>

        <Separator className="my-4 bg-slate-700" />
        <div className="space-y-2">
          <Button 
            size="lg" 
            className="w-full mt-4" 
            onClick={handleSaveDraft}
            disabled={saving || !selectedIPs.length}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Draft'
            )}
          </Button>
          <p className={`text-xs text-center transition-opacity ${selectedIPs.length === 0 ? 'opacity-100' : 'opacity-50'}`}>
            {selectedIPs.length === 0 
              ? 'Add IP assets to enable saving' 
              : 'Drafts appear in your dashboard'
            }
          </p>
        </div>
      </div>

      {/* Working Title Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Name Your Product</DialogTitle>
            <DialogDescription className="text-slate-400">
              Give this design a working title so you can find it later in your dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="e.g., Summer Beach Tee"
              value={pendingTitle}
              onChange={(e) => setPendingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pendingTitle.trim() && !saving) {
                  handleConfirmSave();
                }
              }}
              className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowNameDialog(false)}
              disabled={saving}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleConfirmSave()}
              disabled={saving || !pendingTitle.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Draft'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}