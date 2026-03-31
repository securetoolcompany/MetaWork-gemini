'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function AppShell({ children }) {
  const pathname = usePathname();
  
  // 1. Define your public route criteria
  const isHomePage = pathname === '/';
  const isPublicAisle = pathname?.startsWith('/aisle');
  const isShowroom = pathname?.startsWith('/showroom');
  const isPublicProfile = pathname?.startsWith('/profile');
  const isLogin = pathname === '/login';

  // 2. Combine them into a single boolean
  const hideSidebar = isHomePage || isPublicAisle || isShowroom || isLogin;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 3. Conditional Rendering: Only show sidebar if NOT a public page */}
      {!hideSidebar && <Sidebar />}
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}