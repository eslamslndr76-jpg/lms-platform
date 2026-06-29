'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'مرحباً! أنا المساعد الذكي. كيف يمكنني مساعدتك؟' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: userMsg.content }),
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply || res.response || 'عذراً، لم أفهم' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'حدث خطأ في الاتصال، حاول مرة أخرى' }]);
    }
    setLoading(false);
  };

  return (
    <>
      <button onClick={() => setOpen(!open)}
        className="fixed bottom-5 left-5 z-50 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-blue-700 transition">
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div className="fixed bottom-20 left-5 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border overflow-hidden flex flex-col" style={{ maxHeight: '70vh' }}>
          <div className="bg-blue-600 text-white px-4 py-3 font-bold text-sm flex items-center gap-2">
            <span>🤖</span> المساعد الذكي
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ minHeight: 300 }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-blue-600 text-white'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-end">
                <div className="bg-blue-600 text-white px-3 py-2 rounded-2xl text-sm">جاري التفكير...</div>
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
            <button onClick={send} disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm disabled:opacity-50">إرسال</button>
          </div>
        </div>
      )}
    </>
  );
}
