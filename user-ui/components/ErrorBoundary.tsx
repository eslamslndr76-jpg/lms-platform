'use client';

import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
          <div className="max-w-md text-center">
            <span className="material-symbols-outlined text-[48px] mb-4 block" style={{ color: 'var(--md-sys-color-error)' }}>
              error
            </span>
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)', fontFamily: 'var(--md-sys-typescale-headline-small-font)' }}>
              عذراً
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              حدث خطأ غير متوقع. حاول تحديث الصفحة.
            </p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="h-10 px-6 rounded-full text-sm font-medium transition-colors duration-200"
              style={{
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
              }}
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
