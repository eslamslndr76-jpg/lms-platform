'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '../lib/api';

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
  const endRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
    {isPublic ? null : (<>
      <button onClick={() => setOpen(!open)}
        className="fixed bottom-5 left-5 z-50 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-blue-700 transition">
        {open ? '✕' : '🧠'}
      </button>

      {open && (
        <div className="fixed bottom-20 left-5 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border overflow-hidden flex flex-col" style={{ maxHeight: '70vh' }}>
          <div className="bg-blue-600 text-white px-4 py-3 font-bold text-sm flex items-center gap-2">
            <span>🧠</span> المساعد الذكي
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ minHeight: 250 }}>
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {QUICK_ACTIONS.map((qa, i) => (
                  <button key={i} onClick={() => send(qa.message)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
                    {qa.label}
                  </button>
                ))}
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                  msg.role === 'user' ? 'bg-gray-100 text-gray-800' : 'bg-blue-600 text-white'
                }`}>
                  {msg.role === 'assistant' ? renderSimple(msg.text) : msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-end">
                <div className="bg-blue-600 text-white px-3 py-2 rounded-2xl text-sm opacity-80">
                  <span className="inline-block animate-pulse">جاري التفكير</span>🤔
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="p-3 border-t flex gap-2">
            <input value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="اكتب رسالتك..."
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm" />
            <button onClick={() => send()} disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm disabled:opacity-50">إرسال</button>
          </div>
        </div>
      )}
    </>)}
    </>
  );
}
