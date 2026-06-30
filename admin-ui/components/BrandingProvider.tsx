'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Branding {
  systemName: string;
  logoHeader: string;
  logoFooter: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  sloganAr: string;
  sloganEn: string;
  messageFooter: string;
}

const defaultBranding: Branding = {
  systemName: 'نظام إدارة التعلم',
  logoHeader: '',
  logoFooter: '',
  favicon: '',
  primaryColor: '#2563eb',
  secondaryColor: '#7c3aed',
  sloganAr: 'نحو تعليم أفضل',
  sloganEn: 'Towards Better Learning',
  messageFooter: '',
};

const BrandingContext = createContext<Branding>(defaultBranding);

export function useBranding() {
  return useContext(BrandingContext);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(defaultBranding);

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    fetch(`${API_URL}/api/branding`)
      .then(res => res.json())
      .then(data => {
        if (data && data.systemName) {
          setBranding(data);
          document.documentElement.style.setProperty('--primary', data.primaryColor || defaultBranding.primaryColor);
          document.documentElement.style.setProperty('--secondary', data.secondaryColor || defaultBranding.secondaryColor);
          if (data.favicon) {
            const link = document.querySelector<HTMLLinkElement>('link[rel*="icon"]');
            if (link) link.href = data.favicon;
          }
        }
      })
      .catch(() => {});
  }, []);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}
