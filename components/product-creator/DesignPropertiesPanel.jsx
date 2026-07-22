"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Layers, X, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export default function DesignPropertiesPanel({
  selectedIPs,
  onRemoveIP,
  product,
  baseProductPrice,
  externalProductId,
  printfulTemplateId,
  onTriggerEdmSave,
  refreshNonce, // currently unused but kept for API compatibility
  originalPlacementAssets, // raw EDM placement data from ProductCreatorInner
  isExpanded,
  setIsExpanded,
}) {
  const [variants, setVariants] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [pendingTitle, setPendingTitle] = useState("");
  const [resolvedTemplateId, setResolvedTemplateId] = useState(null);

  const router = useRouter();
  const isMobile = useIsMobile();

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
      (sum, ip) => sum + (Number(ip.licensingFee) || 2.0),
      0
    );

    return {
      base: currentBasePrice,
      ip: ipFees,
      total: currentBasePrice + ipFees,
      size: selectedSize,
    };
  }, [baseProductPrice, variants, selectedVariantId, selectedIPs]);

  const handleConfirmSave = useCallback(
    async ({ titleOverride, resolvedTemplateId: resolvedTemplateIdArg } = {}) => {
      const title = titleOverride || pendingTitle.trim();
      if (!title) {
        toast.error("Please enter a working title");
        return;
      }

      const finalTemplateId =
        resolvedTemplateIdArg ||
        resolvedTemplateId ||
        printfulTemplateId ||
        null;

      if (!finalTemplateId) {
        toast.error("Template ID missing after EDM save");
        return;
      }

      try {
        const res = await fetch("/api/products/save-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            externalProductId,
            printfulTemplateId: finalTemplateId,
            selectedIPs,
            originalPlacementAssets, // send EDM placement data to backend
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

        toast.success("Draft saved successfully");
        router.refresh();
        setPendingTitle(title);
        setShowNameDialog(false);
      } catch (error) {
        toast.error(error.message || "Draft save database synchronization failed");
      }
    },
    [
      pendingTitle,
      resolvedTemplateId,
      printfulTemplateId,
      externalProductId,
      selectedIPs,
      product,
      selectedVariantId,
      costAnalysis,
      router,
    ]
  );

  // Removed debounce wrapper entirely to make the async execution fully awaitable
  const handleSaveDraft = useCallback(async () => {
    if (saving || !onTriggerEdmSave || selectedIPs.length === 0) return;

    setSaving(true);

    try {
      // Correctly block execution until the iframe postMessage callback resolves with a template ID
      const edmResult = await onTriggerEdmSave();
      const freshTemplateId =
        typeof edmResult === "string"
          ? edmResult
          : edmResult?.templateId || null;

      if (!freshTemplateId) {
        throw new Error(
          "EDM save completed but no template ID was returned"
        );
      }

      setResolvedTemplateId(freshTemplateId);
      setShowNameDialog(true);
    } catch (error) {
      toast.error(error.message || "Design save failed");
    } finally {
      setSaving(false);
    }
  }, [saving, onTriggerEdmSave, selectedIPs.length]);

  useEffect(() => {
    setResolvedTemplateId(null);
  }, [externalProductId, product?.id, product?.catalogProductId]);

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
          if (data.success && data.product?.variants)
            setVariants(data.product.variants);
        }
      } catch (error) {
        console.error("Failed to load variants:", error);
      } finally {
        setLoadingVariants(false);
      }
    };
    loadVariants();
  }, [product, printfulTemplateId]);

  useEffect(() => {
    if (variants.length > 0 && !selectedVariantId) {
      const defaultVar =
        variants.find((v) => v.size === "L") ||
        variants.find((v) => v.size === "M") ||
        variants[0];
      setSelectedVariantId(defaultVar.id || defaultVar.variant_id);
    }
  }, [variants, selectedVariantId]);

  useEffect(() => {
    if (product?.name && pendingTitle === "") setPendingTitle(product.name);
  }, [product?.name, pendingTitle]);

  return (
    <div
      className={cn(
        "flex flex-col bg-slate-900 border-slate-800 text-slate-100 transition-all duration-300",
        isMobile
          ? "relative border-t rounded-t-2xl shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
          : "h-full border-l w-80",
        isMobile && !isExpanded ? "h-16" : isMobile ? "h-[70vh]" : "h-full"
      )}
    >
      {/* Header / Mobile Toggle Handle */}
      <div
        className="p-4 border-b border-slate-800 flex justify-between items-center cursor-pointer md:cursor-default"
        onClick={() => isMobile && setIsExpanded(!isExpanded)}      >
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-400">
            Layers
          </h2>
          <Badge
            variant="outline"
            className="text-[10px] h-5 border-slate-700 text-slate-400"
          >
            {selectedIPs.length}
          </Badge>
        </div>
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500"
          >
            {isExpanded ? <ChevronDown /> : <ChevronUp />}
          </Button>
        )}
      </div>

      {/* Main Content Area */}
      <div
        className={cn(
          "flex-1 flex flex-col min-h-0",
          isMobile && !isExpanded && "hidden"
        )}
      >
        <ScrollArea className="flex-1 p-4">
          {selectedIPs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-500 border border-dashed border-slate-700 rounded-lg bg-slate-800/30">
              <p className="text-xs">No IP assets selected</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedIPs.map((ip, index) => (
                <div
                  key={ip.id || index}
                  className="relative flex items-center gap-3 p-2 rounded-md bg-slate-800/50 border border-slate-700"
                >
                  <div className="w-8 h-8 bg-slate-950 rounded border border-slate-700 overflow-hidden shrink-0">
                    <img
                      src={ip.imageUrl || ip.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-medium text-slate-200 truncate pr-6">
                      {ip.title || ip.name}
                    </h4>
                    <p className="text-[9px] text-green-400 font-mono">
                      +$
                      {(Number(ip.licensingFee) || 2.0).toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemoveIP(ip.id)}
                    className="text-slate-500 hover:text-red-400 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Pricing & Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Size/Variant</span>
              {loadingVariants ? (
                <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
              ) : variants.length > 1 ? (
                <Select
                  value={selectedVariantId ? String(selectedVariantId) : ""}
                  onValueChange={(val) => setSelectedVariantId(Number(val))}
                >
                  <SelectTrigger className="w-[120px] h-7 text-[10px] bg-slate-800 border-slate-700">
                    <SelectValue placeholder="Size" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {variants.map((v, i) => (
                      <SelectItem
                        key={v.id || v.variant_id || i}
                        value={String(v.id || v.variant_id || i)}
                        className="text-[10px]"
                      >
                        {v.size} - $
                        {Number(v.retail_price || v.price).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="font-mono text-slate-300">
                  ${costAnalysis.base.toFixed(2)}
                </span>
              )}
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Est. Total</span>
              <span className="text-sm font-bold text-blue-400 font-mono">
                ${costAnalysis.total.toFixed(2)}
              </span>
            </div>
          </div>

          <Button
            size={isMobile ? "default" : "lg"}
            className="w-full shadow-lg bg-blue-600 hover:bg-blue-700"
            onClick={handleSaveDraft}
            disabled={saving || !selectedIPs.length}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Save Draft"
            )}
          </Button>
        </div>
      </div>

      {/* Name Product Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-[90vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>Name Product</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Working title..."
            value={pendingTitle}
            onChange={(e) => setPendingTitle(e.target.value)}
            className="bg-slate-800 border-slate-700 mt-2"
          />
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowNameDialog(false)}
              className="flex-1 border-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                handleConfirmSave({
                  resolvedTemplateId,
                })
              }
              className="flex-1 bg-blue-600"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}