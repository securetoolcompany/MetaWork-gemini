'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useAuth } from '@/lib/AuthContext'; // Import useAuth

export default function AppShell({ children }) {
  const pathname = usePathname();
  const { isAuthenticated, loading } = useAuth(); // Get auth state
  
  const isLogin = pathname === '/login';
  const isRegister = pathname === '/login';

  // LOGIC: 
  // 1. If we are still loading auth state, we usually show the sidebar to prevent layout shift
  // 2. If NOT logged in (guest), we ALWAYS show the sidebar (for the new site menu)
  // 3. If logged in, we only hide it on specific auth pages like Login/Register
  const shouldHideSidebar = isAuthenticated && (isLogin || isRegister);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Show sidebar unless the hide criteria is met */}
      {!shouldHideSidebar && <Sidebar />}
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}