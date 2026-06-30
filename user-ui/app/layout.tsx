import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import Header from '../components/Header';

export const metadata: Metadata = {
  title: 'LMS Portal',
  description: 'Student Learning Portal',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <Providers>
          <Header />
          <main className="max-w-6xl mx-auto px-4 py-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
