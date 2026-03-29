'use client';

import React, { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/lib/AuthContext';
import { WalletProvider } from '@/lib/WalletContext';
import { CartProvider } from '@/contexts/CartContext';
import { ProductDialogProvider } from '@/app/providers/ProductDialogProvider';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';

type ClientLayoutProps = {
  children: ReactNode;
  modal: ReactNode;
};

export default function ClientLayoutWrapper({ children, modal }: ClientLayoutProps) {
  const pathname = usePathname();
  const isManageRoute = pathname?.includes('/manage');
  const isPublicAisle = pathname?.startsWith('/aisle/');
  const isShowroom = pathname?.startsWith('/showroom');
  const isLogin = pathname?.startsWith('/login');
  const isPublicProfile = pathname?.startsWith('/profile/') && !pathname?.includes('/edit');

  useEffect(() => {
    fetch('/api/init').catch(console.error);
  }, []);

  return (
    <WalletProvider>
      <AuthProvider>
        <CartProvider>
          <ProductDialogProvider>
            {isPublicAisle || isShowroom || isLogin || isPublicProfile ? (
              <>
                <Header />
                {children}
              </>
            ) : (
              <div className="flex h-screen bg-background text-foreground">
                <Sidebar />
                <div className="flex-1 flex flex-col overflow-hidden">
                  <Header />
                  <main className="flex-1 overflow-auto bg-slate-900/50 relative">
                    {children}
                  </main>
                </div>
              </div>
            )}
            
            {/* CRITICAL FIX: Only render the modal slot if we aren't in /manage */}
            {!isManageRoute && modal} 
          </ProductDialogProvider>
        </CartProvider>
      </AuthProvider>
    </WalletProvider>
  );
}