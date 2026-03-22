'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import ProductDetailDialog from '@/components/showroom/ProductDetailDialog';

type ProductDialogContextValue = {
  openProduct: (id: string) => void;
  closeProduct: () => void;
};

const ProductDialogContext = createContext<ProductDialogContextValue | null>(null);

export function ProductDialogProvider({ children }: { children: ReactNode }) {
  const [productId, setProductId] = useState<string | null>(null);

  const openProduct = (id: string) => setProductId(id);
  const closeProduct = () => setProductId(null);

  return (
    <ProductDialogContext.Provider value={{ openProduct, closeProduct }}>
      {children}
      {productId && (
        <ProductDetailDialog
          open={true}
          onOpenChange={(open) => !open && closeProduct()}
          productId={productId}
        />
      )}
    </ProductDialogContext.Provider>
  );
}

export function useProductDialog() {
  const ctx = useContext(ProductDialogContext);
  if (!ctx) {
    throw new Error('useProductDialog must be used within ProductDialogProvider');
  }
  return ctx;
}