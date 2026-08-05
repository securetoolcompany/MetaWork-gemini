'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ProductDetailContent from './ProductDetailContent';

export default function ProductDetailDialog({
  open,
  onOpenChange,
  productId,
}) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-6xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto bg-[#020617] border-white/10 text-white p-4 md:p-8">
        <DialogHeader>
          <DialogTitle className="sr-only">Product details</DialogTitle>
        </DialogHeader>

        <ProductDetailContent
          productId={productId}
          onDialogClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}