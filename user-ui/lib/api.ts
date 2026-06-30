const API_URL = typeof window !== 'undefined'
  ? (window as any).__NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function api(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { throw new Error(res.ok ? 'Invalid response' : `Server error (${res.status})`); }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('انتهت مهلة الاتصال، حاول مرة أخرى');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
