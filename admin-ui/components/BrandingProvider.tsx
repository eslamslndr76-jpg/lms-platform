'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';
import {
  argbFromHex,
  hexFromArgb,
  SchemeContent,
  Hct,
} from '@material/material-color-utilities';

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
  systemName: 'منصة وحدة التدريب و التطوير',
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

function generateM3Scheme(seedHex: string, isDark: boolean) {
  try {
    const hct = Hct.fromInt(argbFromHex(seedHex));
    const scheme = new SchemeContent(hct, isDark, 0.0);
    return {
      '--md-sys-color-primary': hexFromArgb(scheme.primary),
      '--md-sys-color-on-primary': hexFromArgb(scheme.onPrimary),
      '--md-sys-color-primary-container': hexFromArgb(scheme.primaryContainer),
      '--md-sys-color-on-primary-container': hexFromArgb(scheme.onPrimaryContainer),
      '--md-sys-color-secondary': hexFromArgb(scheme.secondary),
      '--md-sys-color-on-secondary': hexFromArgb(scheme.onSecondary),
      '--md-sys-color-secondary-container': hexFromArgb(scheme.secondaryContainer),
      '--md-sys-color-on-secondary-container': hexFromArgb(scheme.onSecondaryContainer),
      '--md-sys-color-tertiary': hexFromArgb(scheme.tertiary),
      '--md-sys-color-on-tertiary': hexFromArgb(scheme.onTertiary),
      '--md-sys-color-tertiary-container': hexFromArgb(scheme.tertiaryContainer),
      '--md-sys-color-on-tertiary-container': hexFromArgb(scheme.onTertiaryContainer),
      '--md-sys-color-surface': hexFromArgb(scheme.surface),
      '--md-sys-color-on-surface': hexFromArgb(scheme.onSurface),
      '--md-sys-color-on-surface-variant': hexFromArgb(scheme.onSurfaceVariant),
      '--md-sys-color-surface-container-lowest': hexFromArgb(scheme.surfaceContainerLowest),
      '--md-sys-color-surface-container-low': hexFromArgb(scheme.surfaceContainerLow),
      '--md-sys-color-surface-container': hexFromArgb(scheme.surfaceContainer),
      '--md-sys-color-surface-container-high': hexFromArgb(scheme.surfaceContainerHigh),
      '--md-sys-color-surface-container-highest': hexFromArgb(scheme.surfaceContainerHighest),
      '--md-sys-color-surface-dim': hexFromArgb(scheme.surfaceDim),
      '--md-sys-color-surface-bright': hexFromArgb(scheme.surfaceBright),
      '--md-sys-color-outline': hexFromArgb(scheme.outline),
      '--md-sys-color-outline-variant': hexFromArgb(scheme.outlineVariant),
      '--md-sys-color-inverse-surface': hexFromArgb(scheme.inverseSurface),
      '--md-sys-color-inverse-on-surface': hexFromArgb(scheme.inverseOnSurface),
      '--md-sys-color-inverse-primary': hexFromArgb(scheme.inversePrimary),
    };
  } catch {
    return null;
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(defaultBranding);

  useEffect(() => {
    api('/api/branding')
      .then(data => {
        if (data && data.systemName) {
          setBranding(data);
          const seed = data.primaryColor || defaultBranding.primaryColor;

          // Generate and apply M3 color scheme from admin's primary color
          const lightScheme = generateM3Scheme(seed, false);
          const darkScheme = generateM3Scheme(seed, true);

          // Inject as CSS rules (not inline styles) so .dark class cascade works
          let existingStyle = document.getElementById('md3-dynamic');
          if (!existingStyle) {
            existingStyle = document.createElement('style');
            existingStyle.id = 'md3-dynamic';
            document.head.appendChild(existingStyle);
          }

          let css = ':root {\n';
          if (lightScheme) {
            Object.entries(lightScheme).forEach(([prop, value]) => {
              css += `  ${prop}: ${value};\n`;
            });
          }
          css += '}\n';

          if (darkScheme) {
            css += '.dark {\n';
            Object.entries(darkScheme).forEach(([prop, value]) => {
              css += `  ${prop}: ${value};\n`;
            });
            css += '}\n';
          }

          existingStyle.textContent = css;

          // Legacy aliases as inline styles (no dark mode conflict)
          const root = document.documentElement;
          root.style.setProperty('--primary', seed);
          root.style.setProperty('--secondary', data.secondaryColor || defaultBranding.secondaryColor);

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
