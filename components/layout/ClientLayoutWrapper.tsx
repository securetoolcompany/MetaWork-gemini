'use client';

import React, {
  type ReactNode,
  useEffect,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  AuthProvider,
  useAuth,
} from '@/lib/AuthContext';
import { WalletProvider } from '@/lib/WalletContext';
import { CartProvider } from '@/contexts/CartContext';
import { ProductDialogProvider } from '@/app/providers/ProductDialogProvider';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import AccountGateway from '@/components/auth/AccountGateway';
import { AccountAccessProvider } from '@/components/auth/AccountAccessProvider';

type ClientLayoutProps = {
  children: ReactNode;
  modal: ReactNode;
};

function LayoutContent({
  children,
  modal,
}: ClientLayoutProps) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const isManageRoute = pathname?.includes('/manage');
  const isLogin = pathname?.startsWith('/login');
  const isRegister = pathname?.startsWith('/register');

  const shouldHideSidebar =
    isAuthenticated && (isLogin || isRegister);

  if (shouldHideSidebar) {
    return (
      <>
        <Header />

        <AccountGateway>
          {children}
          {modal}
        </AccountGateway>
      </>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />

        <main className="relative flex-1 overflow-auto bg-slate-900/50">
          <AccountGateway>
            {children}
            {!isManageRoute && modal}
          </AccountGateway>
        </main>
      </div>
    </div>
  );
}

export default function ClientLayoutWrapper(
  props: ClientLayoutProps
) {
  useEffect(() => {
    fetch('/api/init').catch(console.error);
  }, []);

  return (
    <WalletProvider>
      <AuthProvider>
        <CartProvider>
          <ProductDialogProvider>
            <AccountAccessProvider>
              <LayoutContent {...props} />
            </AccountAccessProvider>
          </ProductDialogProvider>
        </CartProvider>
      </AuthProvider>
    </WalletProvider>
  );
}