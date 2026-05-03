import './globals.css';
import React, { ReactNode } from 'react';
import Script from 'next/script';
import ClientLayoutWrapper from '@/components/layout/ClientLayoutWrapper';
import { Viewport } from 'next';

export const metadata = {
  title: 'MetaWork',
  description: 'The MetaWork Platform',
};

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
      <head>
        <Script
          id="gtranslate-settings"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.gtranslateSettings = {"default_language":"en","native_language_names":true,"detect_browser_language":true,"languages":["en","fr","it","es"],"wrapper_selector":".gtranslate_wrapper","switcher_open_direction":"top","alt_flags":{"en":"usa","es":"mexico"},"switcher_text_color":"#f7f7f7","switcher_arrow_color":"#f2f2f2","switcher_border_color":"#161616","switcher_background_color":"#303030","switcher_background_shadow_color":"#474747","switcher_background_hover_color":"#3a3a3a","dropdown_text_color":"#eaeaea","dropdown_hover_color":"#748393","dropdown_background_color":"#474747"}`
          }}
        />
      </head>
      <body className="font-sans antialiased overflow-x-hidden">
        {/* GTranslate mount point */}
        <div className="gtranslate_wrapper" />

        <ClientLayoutWrapper modal={modal}>
          {children}
        </ClientLayoutWrapper>

        <Script
          src="https://cdn.gtranslate.net/widgets/latest/dwf.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}