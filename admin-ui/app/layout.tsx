import { ReactNode } from 'react';
import ClientLayout from './ClientLayout';
import { AdminProviders } from './providers';
import './globals.css';

export const metadata = {
  title: 'لوحة التحكم - وحدة التدريب و التطوير',
  description: 'لوحة تحكم منصة وحدة التدريب و التطوير',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Cairo:wght@400;500;600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AdminProviders>
          <ClientLayout>{children}</ClientLayout>
        </AdminProviders>
      </body>
    </html>
  );
}