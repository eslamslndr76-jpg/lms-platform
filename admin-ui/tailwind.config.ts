import type { Config } from 'tailwindcss';

/**
 * Material 3 token bridge (admin_plan phase 8): every color resolves to the
 * runtime `--md-sys-color-*` variables from globals.css, so branding (which
 * regenerates those variables) re-themes Tailwind classes too. Legacy
 * Tailwind classes used by the not-yet-migrated pages keep their defaults.
 */
const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'var(--md-sys-color-primary)',
        'on-primary': 'var(--md-sys-color-on-primary)',
        'primary-container': 'var(--md-sys-color-primary-container)',
        'on-primary-container': 'var(--md-sys-color-on-primary-container)',
        secondary: 'var(--md-sys-color-secondary)',
        'on-secondary': 'var(--md-sys-color-on-secondary)',
        'secondary-container': 'var(--md-sys-color-secondary-container)',
        'on-secondary-container': 'var(--md-sys-color-on-secondary-container)',
        tertiary: 'var(--md-sys-color-tertiary)',
        'on-tertiary': 'var(--md-sys-color-on-tertiary)',
        'tertiary-container': 'var(--md-sys-color-tertiary-container)',
        'on-tertiary-container': 'var(--md-sys-color-on-tertiary-container)',
        error: 'var(--md-sys-color-error)',
        'on-error': 'var(--md-sys-color-on-error)',
        'error-container': 'var(--md-sys-color-error-container)',
        'on-error-container': 'var(--md-sys-color-on-error-container)',
        surface: 'var(--md-sys-color-surface)',
        'on-surface': 'var(--md-sys-color-on-surface)',
        'on-surface-variant': 'var(--md-sys-color-on-surface-variant)',
        'surface-container-lowest': 'var(--md-sys-color-surface-container-lowest)',
        'surface-container-low': 'var(--md-sys-color-surface-container-low)',
        'surface-container': 'var(--md-sys-color-surface-container)',
        'surface-container-high': 'var(--md-sys-color-surface-container-high)',
        'surface-container-highest': 'var(--md-sys-color-surface-container-highest)',
        'surface-dim': 'var(--md-sys-color-surface-dim)',
        'surface-bright': 'var(--md-sys-color-surface-bright)',
        outline: 'var(--md-sys-color-outline)',
        'outline-variant': 'var(--md-sys-color-outline-variant)',
        'inverse-surface': 'var(--md-sys-color-inverse-surface)',
        'inverse-on-surface': 'var(--md-sys-color-inverse-on-surface)',
        'inverse-primary': 'var(--md-sys-color-inverse-primary)',
        success: 'var(--md-sys-color-success)',
        'on-success': 'var(--md-sys-color-on-success)',
        'success-container': 'var(--md-sys-color-success-container)',
        'on-success-container': 'var(--md-sys-color-on-success-container)',
        warning: 'var(--md-sys-color-warning)',
        'on-warning': 'var(--md-sys-color-on-warning)',
        'warning-container': 'var(--md-sys-color-warning-container)',
        'on-warning-container': 'var(--md-sys-color-on-warning-container)',
        info: 'var(--md-sys-color-info)',
        'on-info': 'var(--md-sys-color-on-info)',
        'info-container': 'var(--md-sys-color-info-container)',
        'on-info-container': 'var(--md-sys-color-on-info-container)',
      },
      borderRadius: {
        'md3-xs': 'var(--md-sys-shape-corner-extra-small)',
        'md3-sm': 'var(--md-sys-shape-corner-small)',
        'md3-md': 'var(--md-sys-shape-corner-medium)',
        'md3-lg': 'var(--md-sys-shape-corner-large)',
        'md3-xl': 'var(--md-sys-shape-corner-extra-large)',
        'md3-2xl': 'var(--md-sys-shape-corner-extra-large-increased)',
        'md3-full': 'var(--md-sys-shape-corner-full)',
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        shimmer: 'shimmer 2s infinite',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        'scale-in': { '0%': { transform: 'scale(0.95)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
};

export default config;
