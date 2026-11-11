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
      <body>
        <AdminProviders>
          <ClientLayout>{children}</ClientLayout>
        </AdminProviders>
      </body>
    </html>
  );
}