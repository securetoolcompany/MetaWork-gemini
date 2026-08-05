'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import ProductDetailContent from '@/components/showroom/ProductDetailContent';

function ProductPageInner() {
  const params = useParams();
  const productId = params.id;

  return <ProductDetailContent productId={productId} />;
}

export default function ProductPage() {
  return (
    <div className="min-h-screen bg-[#020617] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-12 min-h-[50vh]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
            </div>
          }
        >
          <ProductPageInner />
        </Suspense>
      </div>
    </div>
  );
}