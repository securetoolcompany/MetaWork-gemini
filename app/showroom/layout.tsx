'use client';

import { CartProvider } from '@/lib/CartContext';
import { Toaster } from 'sonner';

export default function ShowroomLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <CartProvider>
      {children}
      {modal}
    </CartProvider>
  );
}