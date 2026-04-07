'use client';

import React, { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/AuthContext'; // Import useAuth
import { WalletProvider } from '@/lib/WalletContext';
import { CartProvider } from '@/contexts/CartContext';
import { ProductDialogProvider } from '@/app/providers/ProductDialogProvider';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';

type ClientLayoutProps = {
  children: ReactNode;
  modal: ReactNode;
};

// Internal component to access AuthContext
function LayoutContent({ children, modal }: ClientLayoutProps) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  
  const isManageRoute = pathname?.includes('/manage');
  const isLogin = pathname?.startsWith('/login');
  const isRegister = pathname?.startsWith('/register');

  // LOGIC: Hide sidebar ONLY if user is logged in AND on auth pages.
  // Otherwise (Guests everywhere, or Logged-in users on Dashboard/Showroom), show it.
  const shouldHideSidebar = isAuthenticated && (isLogin || isRegister);

  if (shouldHideSidebar) {
    return (
      <>
        <Header />
        {children}
        {modal}
      </>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto bg-slate-900/50 relative">
          {children}
        </main>
      </div>
      {!isManageRoute && modal}
    </div>
  );
}

export default function ClientLayoutWrapper(props: ClientLayoutProps) {
  useEffect(() => {
    fetch('/api/init').catch(console.error);
  }, []);

  return (
    <WalletProvider>
      <AuthProvider>
        <CartProvider>
          <ProductDialogProvider>
            <LayoutContent {...props} />
          </ProductDialogProvider>
        </CartProvider>
      </AuthProvider>
    </WalletProvider>
  );
}