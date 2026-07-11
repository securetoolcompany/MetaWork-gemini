'use client';

import { FC } from 'react';
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