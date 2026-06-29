'use client';

import { useState } from 'react';
import { useAdminAuth } from '../../lib/auth';

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-1" style={{ color: 'var(--primary,#2563eb)' }}>لوحة التحكم</h1>
        <p className="text-gray-500 text-center text-sm mb-8">تسجيل دخول الأدمن</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@lms.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••" required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-white font-bold text-lg disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary,#2563eb)' }}>
            {loading ? 'جاري...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
