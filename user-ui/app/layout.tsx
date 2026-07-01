import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import Header from '../components/Header';
import Chatbot from '../components/Chatbot';

export const metadata: Metadata = {
  title: 'نظام إدارة التعلم | Training Center',
  description: 'الكورس مقدم من فريق تدريب X2 بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS) - جودة . ثقة . امان',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <Providers>
          <Header />
          {children}
          <Chatbot />
        </Providers>
      </body>
    </html>
  );
}
