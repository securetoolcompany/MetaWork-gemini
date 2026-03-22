'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function AppShell({ children }) {
  const pathname = usePathname();
  
  // Define routes that should not show the sidebar
  const isPublicAisle = pathname?.startsWith('/aisle/');
  const isShowroom = pathname?.startsWith('/showroom');
  const isLogin = pathname?.startsWith('/login');
  const isPublicProfile = pathname?.startsWith('/profile/') && !pathname?.includes('/edit');

  const isPublic = isPublicAisle || isShowroom || isLogin || isPublicProfile;

  if (isPublic) {
    return (
      <>
        <Header />
        {children}
      </>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto bg-slate-900/50">
          {children}
        </main>
      </div>
    </div>
  );
}