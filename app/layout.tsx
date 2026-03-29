import './globals.css';
import React, { ReactNode } from 'react';
import ClientLayoutWrapper from '@/components/layout/ClientLayoutWrapper';

export const metadata = {
  title: 'MetaWork',
  description: 'The MetaWork Platform',
};

type RootLayoutProps = {
  children: ReactNode;
  modal: ReactNode;
};

export default function RootLayout({ children, modal }: RootLayoutProps) {
  return (
    <html lang="en" className="dark" dir="ltr">
      <body className="font-sans">
        <ClientLayoutWrapper modal={modal}>
          {children}
        </ClientLayoutWrapper>
      </body>
    </html>
  );
}