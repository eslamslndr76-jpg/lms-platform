'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';

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
  systemName: 'وحدة التدريب و التطوير',
  logoHeader: '',
  logoFooter: '',
  favicon: '',
  primaryColor: '#2563eb',
  secondaryColor: '#7c3aed',
  sloganAr: 'نحو تعليم أفضل',
  sloganEn: 'Towards Better Learning',
  messageFooter: 'هذه المنصة مقدمة من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)',
};

const BrandingContext = createContext<Branding>(defaultBranding);

export function useBranding() {
  return useContext(BrandingContext);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(defaultBranding);

  useEffect(() => {
    api('/api/branding')
      .then(data => {
        if (data && data.systemName) {
          setBranding(data);
          document.documentElement.style.setProperty('--primary', data.primaryColor || defaultBranding.primaryColor);
          document.documentElement.style.setProperty('--secondary', data.secondaryColor || defaultBranding.secondaryColor);
          if (data.favicon) {
            let link = document.querySelector<HTMLLinkElement>('link[rel*="icon"]');
            if (!link) {
              link = document.createElement('link');
              link.rel = 'icon';
              document.head.appendChild(link);
            }
            link.href = data.favicon;
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
