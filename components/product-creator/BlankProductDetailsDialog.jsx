import React, { useMemo, useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { DollarSign, Paintbrush, Loader2, MapPin, Layers } from 'lucide-react';

const AOP_KEYWORDS = ['all over', 'all-over', 'aop', 'sublimation', 'dye sublimation'];

function isAOP(product) {
  const technique = (
    product?.preferredTechnique ||
    product?.technique ||
    product?.printTechniques?.[0]?.display_name ||
    product?.printTechniques?.[0]?.displayName ||
    ''
  ).toLowerCase();
  const name = (product?.name || '').toLowerCase();
  return AOP_KEYWORDS.some((kw) => technique.includes(kw) || name.includes(kw));
}

function techniqueLabel(t) {
  if (typeof t === 'string') return t;
  // Printful shape: { key, display_name, is_default }
  return t?.display_name || t?.displayName || t?.name || t?.key || 'Standard Print';
}

export default function BlankProductDetailsDialog({ open, onOpenChange, product, onSelect }) {
  const [detailedProduct, setDetailedProduct] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setDetailedProduct(null);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (open && product && !detailedProduct) {
      const fetchDetails = async () => {
        setLoading(true);
        try {
          const id = product.catalogProductId || product.id;
          const res = await fetch(`/api/metawork/products/${id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.product) {
              setDetailedProduct({ ...product, ...data.product });
            }
          }
        } catch (error) {
          console.error('Failed to fetch product details:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchDetails();
    }
  }, [open, product, detailedProduct]);

  const activeProduct = detailedProduct || product;
  const aop = isAOP(activeProduct);

  const report = useMemo(() => {
    if (!activeProduct) return null;

    const rawVariants = activeProduct.variants || [];

    const uniqueColors = new Map();
    rawVariants.forEach((v) => {
      if (v.color) uniqueColors.set(v.color, v.color_code || v.colorCode || '#e2e8f0');
    });

    const seen = new Set();
    const deduped = rawVariants.filter((v) => {
      const price = Number(v.retail_price || v.price || 0).toFixed(2);
      const size = v.size || 'One size';
      const key = `${size}|${price}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

        // Compute MetaWork platform price per size variant
    const printFiles =
      activeProduct.baseProduct?.printFiles ||
      activeProduct.printFiles ||
      [];

    const prices = new Map();
    const priceSeen = new Set();

    deduped.forEach((v) => {
      const printfulBase = Number(v.retail_price || v.price || 0);
      if (!Number.isFinite(printfulBase) || printfulBase <= 0) return;

      const sizeLabel = v.size || 'One size';

      // Placement cost for a "base" design:
      // any non-mockup printFiles with additional_price
      const placementCost = printFiles.reduce((sum, pf) => {
        if (pf.type === 'mockup') return sum;
        const extra = Number(pf.additional_price || 0);
        return sum + (Number.isFinite(extra) ? extra : 0);
      }, 0);

      // MetaWork platform price: markup only on printfulBase, placement at cost
      const platformPrice = printfulBase * 1.2 + 2;
      const p = platformPrice.toFixed(2);

      const priceKey = `${p}|${sizeLabel}`;
      if (!priceSeen.has(priceKey)) {
        if (!prices.has(p)) prices.set(p, new Set());
        prices.get(p).add(sizeLabel);
        priceSeen.add(priceKey);
      }
    });

    const priceTable = Array.from(prices.entries())
      .map(([price, optSet]) => ({
        price,
        options: Array.from(optSet).join(', '),
      }))
      .sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

    const printAreas = printFiles.map((pf) => {
      const label = pf.title || pf.type;
      const extra = Number(pf.additional_price || 0);
      return {
        label,
        extra: Number.isFinite(extra) ? extra : 0,
      };
    });
    
      // Always produce an array of plain strings
    const techniques = activeProduct.printTechniques?.length
      ? activeProduct.printTechniques.map(techniqueLabel)
      : [techniqueLabel(activeProduct.preferredTechnique || activeProduct.technique || 'Standard Print')];

    const originCountry =
      activeProduct.origin_country ||
      activeProduct.originCountry ||
      activeProduct.shipsFrom ||
      null;

    return {
      colors: Array.from(uniqueColors.entries()).map(([name, hex]) => ({ name, hex })),
      priceTable,
      techniques,
      originCountry,
      stockStatus: {
        isOutOfStock:
          rawVariants.length > 0 &&
          rawVariants.every((v) => !v.in_stock),
      },
      printAreas, // NEW: per-print-area cost data
    };
  }, [activeProduct]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] p-0 bg-slate-950 border-slate-800 text-slate-100 overflow-hidden flex flex-col">

        <DialogHeader className="p-6 border-b border-slate-800 bg-slate-900/50 flex-shrink-0">
          <DialogTitle className="text-xl font-bold">{product?.name ?? ''}</DialogTitle>
          {report?.originCountry && (
            <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
              <MapPin className="w-3 h-3" />
              Manufactured &amp; ships from:{' '}
              <span className="text-slate-200 font-medium">{report.originCountry}</span>
            </p>
          )}
                </DialogHeader>

        {/* Main content: left image fixed, right details scroll */}
        <div className="flex-1 overflow-hidden">
          {!product ? null : !report ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin h-6 w-6 text-slate-500" />
            </div>
          ) : (
            <div className="grid md:grid-cols-12 h-full overflow-hidden">
              {/* Left — image, always visible */}
              <div className="md:col-span-5 bg-white p-8 border-r border-slate-800/50 flex items-center justify-center overflow-hidden">
                <img
                  src={activeProduct.image || product?.thumbnailUrl}
                  alt={product?.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              {/* Right — all details, scrollable */}
              <div className="md:col-span-7 h-full bg-slate-950/50 overflow-y-auto">
                <div className="p-6 space-y-6">
                  {/* Description */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Description
                    </h3>
                    {activeProduct.description ? (
                      (() => {
                        const lines = activeProduct.description
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean);

                        const importantIndex = lines.findIndex((line) =>
                          line.startsWith('Important:')
                        );
                        const disclaimersIndex = lines.findIndex((line) =>
                          line.startsWith('Disclaimers:')
                        );

                        const introLine = lines.find((line, idx) => {
                          const isBullet = line.startsWith('•');
                          const isSection =
                            line.startsWith('Important:') ||
                            line.startsWith('Disclaimers:');
                          const isBeforeImportant =
                            importantIndex === -1 || idx < importantIndex;
                          return !isBullet && !isSection && isBeforeImportant;
                        });

                        const featureLines = lines.filter((line, idx) => {
                          if (
                            idx === importantIndex ||
                            idx === disclaimersIndex
                          )
                            return false;
                          const isAfterSection =
                            (importantIndex !== -1 && idx > importantIndex) ||
                            (disclaimersIndex !== -1 && idx > disclaimersIndex);
                          if (isAfterSection) return false;
                          return line.startsWith('•');
                        });

                        const importantLines =
                          importantIndex >= 0
                            ? lines
                                .slice(importantIndex + 1)
                                .filter(
                                  (line) => !line.startsWith('Disclaimers:')
                                )
                            : [];

                        const disclaimersLines =
                          disclaimersIndex >= 0
                            ? lines.slice(disclaimersIndex + 1)
                            : [];

                        return (
                          <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
                            {introLine && <p>{introLine}</p>}

                            {featureLines.length > 0 && (
                              <ul className="space-y-1 list-disc list-inside">
                                {featureLines.map((line, idx) => (
                                  <li key={idx}>
                                    {line.replace(/^•\s*/, '')}
                                  </li>
                                ))}
                              </ul>
                            )}

                            {importantIndex >= 0 && (
                              <div className="space-y-1">
                                <p className="font-semibold text-slate-300">
                                  Important:
                                </p>
                                {importantLines.length > 0 && (
                                  <ul className="space-y-1 list-disc list-inside">
                                    {importantLines.map((line, idx) => (
                                      <li key={idx}>
                                        {line.replace(/^•\s*/, '')}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}

                            {disclaimersIndex >= 0 && (
                              <div className="space-y-1">
                                <p className="font-semibold text-slate-300">
                                  Disclaimers:
                                </p>
                                {disclaimersLines.length > 0 && (
                                  <ul className="space-y-1 list-disc list-inside">
                                    {disclaimersLines.map((line, idx) => (
                                      <li key={idx}>
                                        {line.replace(/^•\s*/, '')}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-sm text-slate-400">
                        No description available.
                      </p>
                    )}
                  </div>

                  <Separator className="bg-slate-800" />

                  {/* Print Area Costs */}
                  {report.printAreas && report.printAreas.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" /> Print Area Costs
                      </h3>
                      <div className="space-y-1 text-[11px] text-slate-400 font-mono">
                        {report.printAreas.map((area, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between"
                          >
                            <span>{area.label}</span>
                            <span>
                              {area.extra > 0
                                ? `+$${area.extra.toFixed(2)} per item`
                                : 'Included'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator className="bg-slate-800" />

                  {/* Manufacturing / origin block */}
                  {product.producedIn && (
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-500 tracking-wide uppercase mb-1">
                        Manufacturing Location
                      </h3>
                      <p className="text-sm text-zinc-300">
                        {product.producedIn}
                      </p>
                      {Array.isArray(product.originFlags) && product.originFlags.length > 0 && (
                        <p className="text-xs text-zinc-500 mt-1">
                          Origin flags:{' '}
                          {product.originFlags
                            .map(code => String(code).toUpperCase())
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  )}
            
                  <Separator className="bg-slate-800" />

                  {/* Colors */}
                  {report.colors.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {aop
                          ? 'Base Fabric Colors (print covers garment)'
                          : 'Available Colors'}
                      </h3>
                      {aop && (
                        <p className="text-xs text-amber-400/80">
                          This is an all-over print product — your artwork
                          covers the entire garment. The color below is the base
                          fabric, only visible at seams.
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {report.colors.map((c, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-900 border border-slate-700 rounded-full px-2 py-1"
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-slate-600 inline-block flex-shrink-0"
                              style={{ backgroundColor: c.hex }}
                            />
                            {c.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator className="bg-slate-800" />

                  {/* Base Product Cost by Size */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-green-500" /> Base Product Cost by Size
                    </h3>
                    <div className="rounded-md border border-slate-800 overflow-hidden text-sm bg-slate-900/50">
                      <div className="grid grid-cols-12 px-3 py-2 bg-slate-900 border-b border-slate-800 font-medium text-slate-400 text-xs uppercase tracking-wider">
                        <div className="col-span-8">Size(s)</div>
                        <div className="col-span-4 text-right">Cost</div>
                      </div>
                      {loading ? (
                        <div className="p-4 flex justify-center">
                          <Loader2 className="animate-spin h-5 w-5 text-slate-500" />
                        </div>
                      ) : report.priceTable.length === 0 ? (
                        <div className="px-3 py-4 text-slate-500 text-sm">
                          No pricing data available.
                        </div>
                      ) : (
                        report.priceTable.map((row, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-12 px-3 py-2 border-b border-slate-800/50 last:border-0 hover:bg-slate-900/30"
                          >
                            <div className="col-span-8 text-slate-300">
                              {row.options}
                            </div>
                            <div className="col-span-4 text-right text-green-400 font-mono font-bold">
                              ${row.price}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="p-6 border-t border-slate-800 bg-slate-900/50 flex-shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Close
          </Button>
          <Button
            onClick={() => onSelect(activeProduct)}
            disabled={loading || !report || report.stockStatus.isOutOfStock}
            className="bg-blue-600 hover:bg-blue-500 text-white min-w-[140px]"
          >
            <Paintbrush className="w-4 h-4 mr-2" />
            Use this blank
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}