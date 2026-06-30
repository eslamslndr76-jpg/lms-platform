'use client';
import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: string; }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error);
  }
  render() {
    if (this.state.hasError) {
      return <div className="flex flex-col items-center justify-center h-64 gap-4 p-4"><p className="text-red-500 font-medium">حدث خطأ غير متوقع</p><p className="text-sm max-w-md text-center" style={{ color: 'var(--text-muted)' }}>{this.state.error}</p><button onClick={() => { this.setState({ hasError: false, error: '' }); window.location.reload(); }} className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm">إعادة المحاولة</button></div>;
    }
    return this.props.children;
  }
}
