import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AIAssistant from '../components/AIAssistant';
import MobileBottomNavWrapper from '../components/MobileBottomNavWrapper';

/* @material/web component imports — imported here so they register globally */
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/button/elevated-button.js';
import '@material/web/button/filled-tonal-button.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/textfield/filled-text-field.js';
import '@material/web/switch/switch.js';
import '@material/web/chips/chip-set.js';
import '@material/web/chips/filter-chip.js';
import '@material/web/chips/assist-chip.js';
import '@material/web/chips/suggestion-chip.js';
import '@material/web/progress/linear-progress.js';
import '@material/web/progress/circular-progress.js';
import '@material/web/dialog/dialog.js';
import '@material/web/menu/menu.js';
import '@material/web/menu/menu-item.js';
import '@material/web/divider/divider.js';
import '@material/web/tabs/tabs.js';
import '@material/web/tabs/primary-tab.js';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';

export const metadata: Metadata = {
  title: 'منصة وحدة التدريب و التطوير | Training Center',
  description: 'هذه المنصة مقدمة من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS) - نحو تعليم أفضل',
  icons: {
    icon: [
      { url: '/branding/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/branding/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/branding/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/branding/favicon-32.png',
    apple: '/branding/apple-touch-icon.png',
  },
  openGraph: {
    title: 'منصة وحدة التدريب و التطوير',
    description: 'نحو تعليم أفضل — وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)',
    images: ['/branding/icon-512.png'],
  },
  other: {
    'theme-color': '#1a56db',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Cairo:wght@400;600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <Header />
          <main className="min-h-screen">
            {children}
          </main>
          <Footer />
          <AIAssistant />
          <MobileBottomNavWrapper />
        </Providers>
      </body>
    </html>
  );
}
