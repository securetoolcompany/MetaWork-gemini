import './globals.css';
import React, { ReactNode } from 'react';
import Script from 'next/script';
import ClientLayoutWrapper from '@/components/layout/ClientLayoutWrapper';
import { Viewport } from 'next';
import { Analytics } from "@vercel/analytics/next"

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
            __html: `window.gtranslateSettings = {"default_language":"en","native_language_names":true,"detect_browser_language":true,"languages":["en","fr","it","es","zh-CN"],"wrapper_selector":".gtranslate_wrapper","switcher_open_direction":"top","alt_flags":{"en":"usa","es":"mexico"},"switcher_text_color":"#f7f7f7","switcher_arrow_color":"#f2f2f2","switcher_border_color":"#161616","switcher_background_color":"#303030","switcher_background_shadow_color":"#474747","switcher_background_hover_color":"#3a3a3a","dropdown_text_color":"#eaeaea","dropdown_hover_color":"#748393","dropdown_background_color":"#474747"}`
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
          id="metawork-translation-engine"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var containerId = 'google_translate_element2';
                var scriptId = 'metawork-google-translation-script';

                function initializeTranslation() {
                  if (
                    !window.google ||
                    !window.google.translate ||
                    !window.google.translate.TranslateElement
                  ) {
                    return;
                  }

                  if (document.querySelector('.goog-te-combo')) {
                    return;
                  }

                  var container = document.getElementById(containerId);

                  if (!container) {
                    container = document.createElement('div');
                    container.id = containerId;
                    container.style.display = 'none';
                    document.body.appendChild(container);
                  }

                  if (container.dataset.metaworkInitialized === 'true') {
                    return;
                  }

                  try {
                    new window.google.translate.TranslateElement(
                      {
                        pageLanguage: 'en',
                        includedLanguages: 'en,fr,it,es,zh-CN',
                        autoDisplay: false
                      },
                      containerId
                    );

                    container.dataset.metaworkInitialized = 'true';
                  } catch (error) {
                    console.error(
                      'MetaWork translation initialization failed:',
                      error
                    );
                  }
                }

                window.metaWorkTranslateInit = initializeTranslation;

                if (
                  window.google &&
                  window.google.translate &&
                  window.google.translate.TranslateElement
                ) {
                  initializeTranslation();
                  return;
                }

                if (document.getElementById(scriptId)) {
                  return;
                }

                var script = document.createElement('script');
                script.id = scriptId;
                script.src =
                  'https://translate.google.com/translate_a/element.js' +
                  '?cb=metaWorkTranslateInit';
                script.async = true;
                script.onerror = function () {
                  console.error(
                    'MetaWork could not load the Google translation engine.'
                  );
                };

                document.head.appendChild(script);
              })();
            `,
          }}
        />
        
        <Script
          src="https://cdn.gtranslate.net/widgets/latest/dwf.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}