'use client';

import { FC, useEffect } from 'react';
import { use } from 'react';
import ProductDetailDialog from '@/components/showroom/ProductDetailDialog';
import { useRouter } from 'next/navigation';

type ProductModalProps = {
  params: Promise<{
    id: string;
  }>;
};

const ProductModal: FC<ProductModalProps> = ({ params }) => {
  const router = useRouter();
  const { id } = use(params);

  // --- THE ESCAPE HATCH ---
  // Next.js mistakenly thinks "creator" is a product ID.
  // If we see it, bail out and hard-load the actual creator studio page.
  useEffect(() => {
    if (id === 'creator') {
      window.location.href = '/products/creator' + window.location.search;
    }
  }, [id]);

  // Don't render the modal if it's the creator page
  if (id === 'creator') return null;

  const handleClose = () => {
    router.back();
  };

  return (
    <ProductDetailDialog
      open={true}
      onOpenChange={(open) => !open && handleClose()}
      productId={id}
    />
  );
};

export default ProductModal;