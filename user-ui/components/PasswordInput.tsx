'use client';

import { useState } from 'react';

export default function PasswordInput({ value, onChange, placeholder, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || '••••••••'}
        className={`w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${className}`}
        required />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm">
        {show ? 'إخفاء' : 'إظهار'}
      </button>
    </div>
  );
}
