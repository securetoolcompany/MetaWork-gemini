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

  const getLicensingFeeDollars = (ip) => {
  const licensingFeeCents = Number(ip?.licensingFeeCents);

    if (Number.isFinite(licensingFeeCents)) {
      return Math.max(0, licensingFeeCents) / 100;
    }

    const legacyLicensingFee = Number(ip?.licensingFee);

    return Number.isFinite(legacyLicensingFee)
      ? Math.max(0, legacyLicensingFee)
      : 0;
  };

  const costAnalysis = useMemo(() => {
    // 1. Raw Printful base cost from the selected variant
    let printfulBase = Number(baseProductPrice || 0);
    let selectedSize = "Standard";

    if (variants.length > 0 && selectedVariantId) {
      const v = variants.find(
        (i) =>
          (i.id || i.variant_id || i.variantId) === selectedVariantId
      );
      if (v) {
        printfulBase = Number(v.retail_price || v.price || 0);
        selectedSize = v.size || selectedSize;
      }
    }

    // 2. Determine which placements are used in this design
    const EDM_TO_PRINTFUL_PLACEMENT = {
      front: ["front", "default", "dtg_front", "embroidery_front"],
      back: ["back", "dtg_back", "embroidery_back"],
      sleeve_right: [
        "sleeve_right",
        "right_sleeve",
        "embroidery_right",
        "front_sleeve_right",
      ],
      sleeve_left: [
        "sleeve_left",
        "left_sleeve",
        "embroidery_left",
        "front_sleeve_left",
      ],
    };

    const placementConfigs =
      product?.printfulPlacementConfigs?.length
        ? product.printfulPlacementConfigs
        : product?.baseProduct?.printfulPlacementConfigs || [];

    const printFiles =
      product?.baseProduct?.printFiles ||
      product?.printFiles ||
      [];

    const hasPrintFiles = Array.isArray(printFiles) && printFiles.length > 0;

    // If we have placements but no printFiles, fall back to persisted cost.
    if (!hasPrintFiles && placementConfigs.length > 0) {
      const ipFees = selectedIPs.reduce(
        (sum, ip) => sum + getLicensingFeeDollars(ip),
        0
      );

      const fallbackPlacementCost =
        Number(product?.costAnalysis?.placementCost) || 0;

      const platformBase = printfulBase * 1.2 + 2 + fallbackPlacementCost;
      const userPrice = platformBase + ipFees;

      return {
        printfulBase,
        placementCost: fallbackPlacementCost,
        platformBase,
        ip: ipFees,
        total: userPrice,
        size: selectedSize,
        hasEdmPlacements: true,
      };
    }

    // DEBUG: inspect what EDM and catalog are actually sending
    if (process.env.NODE_ENV !== "production") {
      console.log("[DesignPropertiesPanel] placementConfigs", placementConfigs);
      console.log("[DesignPropertiesPanel] printFiles", printFiles);
    }

    // If EDM hasn't reported any placements being used yet,
    // placement cost should be $0.00.
    if (!placementConfigs.length) {
      const ipFees = selectedIPs.reduce(
        (sum, ip) => sum + getLicensingFeeDollars(ip),
        0
      );
      const platformBase = printfulBase * 1.2 + 2;

      return {
        printfulBase,
        placementCost: 0,
        platformBase,
        ip: ipFees,
        total: platformBase + ipFees,
        size: selectedSize,
        hasEdmPlacements: false,
      };
    }

    // Otherwise, expand EDM placement keys into file types and charge per used area.
    const usedPlacementTypes = new Set();
    placementConfigs
      .map((p) => p.placement)
      .filter(Boolean)
      .forEach((edmKey) => {
        const mappedTypes = EDM_TO_PRINTFUL_PLACEMENT[edmKey] || [];
        mappedTypes.forEach((t) => usedPlacementTypes.add(t));
      });

    const placementCost = printFiles.reduce((sum, pf) => {
      if (pf.type === "mockup") return sum;
      if (!usedPlacementTypes.has(pf.type)) return sum;
      const extra = Number(pf.additional_price || 0);
      return sum + (Number.isFinite(extra) ? extra : 0);
    }, 0);

    const ipFees = selectedIPs.reduce(
      (sum, ip) => sum + getLicensingFeeDollars(ip),
      0
    );

    const platformBase = printfulBase * 1.2 + 2 + placementCost;
    const userPrice = platformBase + ipFees;

    return {
      printfulBase,
      placementCost,
      platformBase,
      ip: ipFees,
      total: userPrice,
      size: selectedSize,
      hasEdmPlacements: true,
    };
  }, [baseProductPrice, variants, selectedVariantId, selectedIPs, product]);

  // --- Unified asset flags for Save gating ---

  const hasLibraryIPs = (selectedIPs ?? []).length > 0;

  const designAssets =
    product?.designAssets ??
    product?.originalPlacementAssets ??
    [];

  const hasEdmAssets =
    Array.isArray(designAssets) && designAssets.length > 0;

  const hasEdmPlacements = !!costAnalysis.hasEdmPlacements;

  const handleConfirmSave = useCallback(
    async (options = {}) => {
      const { titleOverride, resolvedTemplateId: resolvedTemplateIdArg } =
        options;
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
        toast.error(
          error?.message || "Draft save database synchronization failed"
        );
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
      originalPlacementAssets,
    ]
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[DesignPropertiesPanel] product", product);
      console.log("[DesignPropertiesPanel] designAssets", designAssets);
      console.log("[DesignPropertiesPanel] hasLibraryIPs", hasLibraryIPs);
      console.log("[DesignPropertiesPanel] hasEdmAssets", hasEdmAssets);
      console.log("[DesignPropertiesPanel] hasEdmPlacements", hasEdmPlacements);
    }
  }, [product, designAssets, hasLibraryIPs, hasEdmAssets, hasEdmPlacements]);

  const handleSaveDraft = useCallback(async () => {
    if (
      saving ||
      !onTriggerEdmSave ||
      (!hasLibraryIPs && !hasEdmAssets && !hasEdmPlacements)
    ) {
      return;
    }

    setSaving(true);

    try {
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
      toast.error(error?.message || "Design save failed");
    } finally {
      setSaving(false);
    }
  }, [saving, onTriggerEdmSave, hasLibraryIPs, hasEdmAssets, hasEdmPlacements]);

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
        onClick={() => isMobile && setIsExpanded(!isExpanded)}
      >
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
                      {getLicensingFeeDollars(ip).toFixed(2)}
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
            {/* Size / Variant selector */}
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
                        {v.size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="font-mono text-slate-300">
                  ${costAnalysis.platformBase.toFixed(2)}
                </span>
              )}
            </div>

            {/* Placement cost line */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Placement cost</span>
              <span className="font-mono text-slate-300">
                ${costAnalysis.placementCost.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">IP licensing fees</span>
              <span className="font-mono text-amber-300">
                ${Number(costAnalysis.ip || 0).toFixed(2)}
              </span>
            </div>

            {/* Est. Total */}
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
            disabled={
              saving || (!hasLibraryIPs && !hasEdmAssets && !hasEdmPlacements)
            }
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