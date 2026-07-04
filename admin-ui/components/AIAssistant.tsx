'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  tableData?: string[][];
}

function renderMarkdown(text: string): JSX.Element[] {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  function flushTable(key: string) {
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const data = tableRows.slice(1);
      elements.push(
        <div key={key} className="overflow-x-auto my-2 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-xs" dir="rtl">
            <thead>
              <tr style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
                {headers.map((h, i) => <th key={i} className="px-3 py-2 text-right">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.map((row, ri) => (
                <tr key={ri} style={{ borderTop: '1px solid var(--border)' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-1.5" style={{ color: 'var(--text)' }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
    inTable = false;
  }

  lines.forEach((line, i) => {
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.split('|').filter((_, ci, arr) => ci > 0 && ci < arr.length - 1).map(c => c.trim());
      if (!inTable) {
        flushTable(`t${i}`);
        inTable = true;
      }
      if (!line.includes('---')) {
        tableRows.push(cells);
      }
      return;
    }
    flushTable(`t${i}`);

    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
      return;
    }
    if (line.trim().startsWith('---')) {
      elements.push(<hr key={i} className="my-2" style={{ borderColor: 'var(--border)' }} />);
      return;
    }

    let html = line;
    const boldMatch = html.match(/\*\*(.+?)\*\*/g);
    if (boldMatch) html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const italicMatch = html.match(/\*(.+?)\*/g);
    if (italicMatch) html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    const codeMatch = html.match(/`(.+?)`/g);
    if (codeMatch) html = html.replace(/`(.+?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">$1</code>');

    const isHeader = line.trim().startsWith('### ');
    const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
    const isNumbered = /^\d+[.)] /.test(line.trim());

    if (isHeader) {
      elements.push(
        <div key={i} className="font-bold text-sm mt-2 mb-1" style={{ color: 'var(--text)' }}>
          {line.trim().replace(/^### /, '')}
        </div>
      );
    } else if (isBullet) {
      elements.push(
        <div key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text)' }}>
          <span className="mt-1">•</span>
          <span dangerouslySetInnerHTML={{ __html: html.replace(/^[-*] /, '') }} />
        </div>
      );
    } else if (isNumbered) {
      const num = line.trim().match(/^(\d+)[.)] /)?.[1] || '';
      elements.push(
        <div key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text)' }}>
          <span className="mt-0.5 text-xs font-bold min-w-[18px]">{num}.</span>
          <span dangerouslySetInnerHTML={{ __html: html.replace(/^\d+[.)] /, '') }} />
        </div>
      );
    } else {
      elements.push(
        <div key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}
          dangerouslySetInnerHTML={{ __html: html }} />
      );
    }
  });
  flushTable('t_end');
  return elements;
}

function extractTables(text: string): string[][][] {
  const tables: string[][][] = [];
  const lines = text.split('\n');
  let current: string[][] = [];
  for (const line of lines) {
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (!line.includes('---')) {
        const cells = line.split('|').filter((_, ci, arr) => ci > 0 && ci < arr.length - 1).map(c => c.trim());
        current.push(cells);
      }
    } else if (current.length > 0) {
      tables.push(current);
      current = [];
    }
  }
  if (current.length > 0) tables.push(current);
  return tables;
}

function downloadExcel(text: string) {
  const tables = extractTables(text);
  if (tables.length === 0) return;
  const rows = tables[0];
  let csv = '';
  for (const row of rows) {
    csv += row.map(c => `"${c.replace(/"/g, '""')}"`).join(',') + '\n';
  }
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-export-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const QUICK_ACTIONS = [
  { label: 'الملخص المالي', message: 'اعرض لي الملخص المالي' },
  { label: 'آخر الطلبات', message: 'اعرض آخر 5 طلبات' },
  { label: 'إحصائيات الكورسات', message: 'اعرض إحصائيات الكورسات' },
  { label: 'ملخص النظام', message: 'اعرض ملخص النظام كامل' },
];

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 800;
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          const ratio = Math.min(maxSize / w, maxSize / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'مرحباً! أنا المساعد الذكي. يمكنني مساعدتك في إدارة النظام، عرض التقارير، وإجراء العمليات.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setLoading(true);

    const payload: any = { messages: [{ role: 'user', text: msg }] };
    if (image) { payload.messages[0].image = image; }

    try {
      const res = await api('/api/chat', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMessages(prev => [...prev, { role: 'assistant', text: res.reply || res.response || 'عذراً، لم أفهم' }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: err?.message || 'حدث خطأ في الاتصال، حاول مرة أخرى',
      }]);
    }
    setLoading(false);
    setImage(null);
  }, [input, loading, image]);

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await compressImage(file);
    setImage(base64);
    if (fileRef.current) fileRef.current.value = '';
  };

  const hasTable = (text: string) => text.includes('|') && text.includes('---');

  return (
    <>
      <button onClick={() => setOpen(!open)}
        className="fixed bottom-5 left-5 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-110 transition-transform"
        style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
        {open ? '✕' : '🤖'}
      </button>

      {open && (
        <div className="fixed bottom-20 left-5 z-50 w-80 sm:w-96 rounded-2xl shadow-2xl border overflow-hidden flex flex-col"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', maxHeight: '75vh' }}>
          <div className="px-4 py-3 font-bold text-sm flex items-center gap-2"
            style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
            <span>🤖</span> المساعد الذكي
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ minHeight: 300 }}>
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {QUICK_ACTIONS.map((qa, i) => (
                  <button key={i} onClick={() => send(qa.message)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: 'var(--bg)', color: 'var(--primary)', border: '1px solid var(--border)' }}>
                    {qa.label}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'rounded-br-sm'
                    : 'rounded-bl-sm'
                }`}
                  style={msg.role === 'user'
                    ? { backgroundColor: 'var(--bg)', color: 'var(--text)' }
                    : { backgroundColor: 'var(--primary)', color: '#fff' }
                  }>
                  {msg.role === 'assistant'
                    ? <div className="space-y-1">{renderMarkdown(msg.text)}</div>
                    : msg.text
                  }
                  {msg.role === 'assistant' && hasTable(msg.text) && (
                    <button onClick={() => downloadExcel(msg.text)}
                      className="mt-2 px-2 py-1 rounded text-xs font-medium opacity-80 hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                      📥 تصدير Excel
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-end">
                <div className="px-3 py-2 rounded-2xl text-sm" style={{ backgroundColor: 'var(--primary)', color: '#fff', opacity: 0.8 }}>
                  <span className="inline-block animate-pulse">جاري التفكير</span>🤔
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {image && (
            <div className="px-3 py-1.5 flex items-center gap-2 text-xs" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
              <span>📷</span> تم إرفاق صورة
              <button onClick={() => setImage(null)} className="mr-auto font-bold hover:opacity-70">✕</button>
            </div>
          )}

          <div className="p-3 flex gap-2" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={() => fileRef.current?.click()}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              📷
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
            <input value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="اكتب رسالتك..."
              className="flex-1 px-3 py-2 rounded-xl text-sm"
              style={{ backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }} />
            <button onClick={() => send()} disabled={loading}
              className="shrink-0 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
              إرسال
            </button>
          </div>
        </div>
      )}
    </>
  );
}
