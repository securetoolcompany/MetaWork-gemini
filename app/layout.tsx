import './globals.css';
import React, { ReactNode } from 'react';
import ClientLayoutWrapper from '@/components/layout/ClientLayoutWrapper';
import { Viewport } from 'next';

export const metadata = {
  title: 'MetaWork',
  description: 'The MetaWork Platform',
};

// This export ensures mobile browsers scale the content to the device width
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

type RootLayoutProps = {
  children: ReactNode;
  modal: ReactNode;
};

export default function RootLayout({ children, modal }: RootLayoutProps) {
  return (
    <html lang="en" className="dark" dir="ltr">
      {/* The 'antialiased' class improves font rendering across devices.
        'overflow-x-hidden' on the body prevents accidental horizontal 
        scrolling caused by elements that are too wide.
      */}
      <body className="font-sans antialiased overflow-x-hidden">
        <ClientLayoutWrapper modal={modal}>
          {children}
        </ClientLayoutWrapper>
      </body>
    </html>
  );
}