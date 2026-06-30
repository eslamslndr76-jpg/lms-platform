import { ReactNode } from 'react';
import ClientLayout from './ClientLayout';
import { AdminProviders } from './providers';
import './globals.css';

export const metadata = {
  title: 'لوحة التحكم - نظام إدارة التدريب',
  description: 'Admin Dashboard',
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