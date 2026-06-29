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
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg, #f9fafb)' }}>
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--primary, #2563eb)' }}>عذراً</h1>
            <p className="text-gray-600 mb-4">حدث خطأ غير متوقع. حاول تحديث الصفحة.</p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="px-6 py-2 text-white rounded-lg"
              style={{ backgroundColor: 'var(--primary, #2563eb)' }}
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
