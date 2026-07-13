import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AIAssistant from '../components/AIAssistant';

export const metadata: Metadata = {
  title: 'منصة نادي ريادة الاعمال | Training Center',
  description: 'هذه المنصة مقدمة من نادي ريادة الاعمال بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS) - نحو تعليم أفضل',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <Providers>
          <Header />
          <main className="min-h-screen">
            {children}
          </main>
          <Footer />
          <AIAssistant />
        </Providers>
      </body>
    </html>
  );
}
