'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '../lib/api';
import M3BottomSheet from './M3BottomSheet';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

function renderSimple(text: string): JSX.Element[] {
  const lines = text.split('\n');
  const els: JSX.Element[] = [];
  lines.forEach((line, i) => {
    if (!line.trim()) { els.push(<div key={i} className="h-2" />); return; }
    const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
    const isHeader = line.trim().startsWith('### ');
    const isTable = line.trim().startsWith('|');
    if (isHeader) {
      els.push(<div key={i} className="font-bold mt-2 mb-1 text-sm">{line.replace(/^### /, '')}</div>);
    } else if (isBullet) {
      els.push(<div key={i} className="flex items-start gap-2 text-sm">• <span>{line.replace(/^[-*] /, '')}</span></div>);
    } else if (isTable) {
      els.push(<div key={i} className="text-xs opacity-70">{line}</div>);
    } else {
      els.push(<div key={i} className="text-sm">{line}</div>);
    }
  });
  return els;
}

const QUICK_ACTIONS = [
  { label: 'طلباتي', message: 'اعرض طلباتي' },
  { label: 'كورساتي', message: 'اعرض الكورسات المتاحة' },
];

const PUBLIC_PATHS = ['/', '/login', '/register', '/register/success'];

export default function AIAssistant() {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'مرحباً! كيف يمكنني مساعدتك؟' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setLoading(true);
    try {
      const res = await api('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: [{ role: 'user', text: msg }] }),
      });
      setMessages(prev => [...prev, { role: 'assistant', text: res.reply || res.response || 'عذراً، لم أفهم' }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: err?.message || 'حدث خطأ في الاتصال، حاول مرة أخرى',
      }]);
    }
    setLoading(false);
  }, [input, loading]);

  if (isPublic) return null;

  const hasBottomNav = isMobile;
  const fabBottom = hasBottomNav ? 'bottom-24' : 'bottom-5';

  const chatContent = (
    <>
      {/* Header */}
      <div
        className="px-4 py-3 font-medium text-sm flex items-center justify-between shrink-0"
        style={{
          backgroundColor: 'var(--md-sys-color-primary)',
          color: 'var(--md-sys-color-on-primary)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">smart_toy</span>
          المساعد الذكي
        </div>
        <button
          onClick={() => setOpen(false)}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ color: 'var(--md-sys-color-on-primary)', opacity: 0.8 }}
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ minHeight: 250 }}>
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {QUICK_ACTIONS.map((qa, i) => (
              <button key={i} onClick={() => send(qa.message)}
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: 'var(--md-sys-color-secondary-container)',
                  color: 'var(--md-sys-color-on-secondary-container)',
                }}>
                {qa.label}
              </button>
            ))}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div
              className="max-w-[85%] px-3 py-2 rounded-md3-sm text-sm"
              style={{
                backgroundColor: msg.role === 'user'
                  ? 'var(--md-sys-color-surface-container-highest)'
                  : 'var(--md-sys-color-primary)',
                color: msg.role === 'user'
                  ? 'var(--md-sys-color-on-surface)'
                  : 'var(--md-sys-color-on-primary)',
              }}
            >
              {msg.role === 'assistant' ? renderSimple(msg.text) : msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-end">
            <div
              className="px-3 py-2 rounded-md3-sm text-sm flex items-center gap-2"
              style={{
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                opacity: 0.8,
              }}
            >
              <span className="inline-block animate-pulse">جاري التفكير</span>
              <span className="material-symbols-outlined text-[16px]">psychology</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-3 flex gap-2 shrink-0" style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="اكتب رسالتك..."
          className="flex-1 h-10 px-3 rounded-md3-sm border text-sm"
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container-highest)',
            borderColor: 'var(--md-sys-color-outline)',
            color: 'var(--md-sys-color-on-surface)',
          }}
        />
        <button
          onClick={() => send()}
          disabled={loading}
          className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50"
          style={{
            backgroundColor: 'var(--md-sys-color-primary)',
            color: 'var(--md-sys-color-on-primary)',
          }}
        >
          <span className="material-symbols-outlined text-[20px]">send</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed ${fabBottom} left-5 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200`}
        style={{
          backgroundColor: 'var(--md-sys-color-primary-container)',
          color: 'var(--md-sys-color-on-primary-container)',
        }}
      >
        <span className="material-symbols-outlined text-[24px]">
          {open ? 'close' : 'smart_toy'}
        </span>
      </button>

      {/* Mobile: Bottom Sheet */}
      {isMobile && (
        <M3BottomSheet open={open} onClose={() => setOpen(false)} maxHeightVh={75}>
          <div className="flex flex-col" style={{ minHeight: '50vh' }}>
            {chatContent}
          </div>
        </M3BottomSheet>
      )}

      {/* Desktop: Floating Panel */}
      {!isMobile && open && (
        <div
          className="fixed bottom-28 left-5 z-50 w-80 sm:w-96 rounded-md3-md shadow-2xl overflow-hidden flex flex-col"
          style={{
            maxHeight: '70vh',
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
          }}
        >
          {chatContent}
        </div>
      )}
    </>
  );
}
