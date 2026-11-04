import React from 'react';
export const metadata = { title: 'MetaWork disposable TestNet operator', robots: { index: false, follow: false } };
export default function RootLayout({ children }) {
  return React.createElement('html', { lang: 'en' }, React.createElement('body', null, children));
}
