'use client';

import { useState } from 'react';

export default function PasswordInput({ value, onChange, placeholder, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || '••••••••'}
        className={`w-full h-14 px-4 pr-12 rounded-md3-sm border text-sm transition-all duration-200 focus:outline-none ${className}`}
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container-highest)',
          borderColor: 'var(--md-sys-color-outline)',
          color: 'var(--md-sys-color-on-surface)',
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = 'var(--md-sys-color-primary)';
          e.currentTarget.style.borderWidth = '2px';
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = 'var(--md-sys-color-outline)';
          e.currentTarget.style.borderWidth = '1px';
        }}
        required
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200"
        style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
      >
        <span className="material-symbols-outlined text-[20px]">
          {show ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </div>
  );
}
