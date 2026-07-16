'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

interface WhatsAppHealth {
  connected: boolean;
  ready: boolean;
  connectionState: string;
  reconnecting: boolean;
  retryCount: number;
  lastConnectedAt: number | null;
  phone: string | null;
}

export default function WhatsAppBanner() {
  const router = useRouter();
  const [health, setHealth] = useState<WhatsAppHealth | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const checkHealth = useCallback(async () => {
    try {
      const data = await api('/api/whatsapp/health');
      setHealth(data);
      if (data.connected && data.ready) {
        setDismissed(false);
      }
    } catch {
      setHealth({
        connected: false,
        ready: false,
        connectionState: 'disconnected',
        reconnecting: false,
        retryCount: 0,
        lastConnectedAt: null,
        phone: null,
      });
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30_000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  if (!health || (health.connected && health.ready) || dismissed) return null;

  const isReconnecting = health.reconnecting || health.connectionState === 'reconnecting';
  const isLoggedOut = health.connectionState === 'disconnected' && !isReconnecting && health.retryCount === 0;

  return (
    <div
      onClick={() => router.push('/settings')}
      className="rounded-2xl p-4 border-2 mb-4 animate-slide-up cursor-pointer hover:shadow-md transition-all"
      style={{
        backgroundColor: '#fef2f2',
        borderColor: '#fca5a5',
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{isReconnecting ? '🔄' : '📵'}</span>
        <div className="flex-1">
          <h3 className="font-bold text-sm" style={{ color: '#991b1b' }}>
            {isReconnecting
              ? `جاري إعادة الاتصال بواتساب... (محاولة ${health.retryCount})`
              : isLoggedOut
              ? 'تم فصل واتساب — يحتاج إعادة ربط'
              : 'الاتصال بواتساب معطّل'}
          </h3>
          <p className="text-xs mt-1" style={{ color: '#b91c1c' }}>
            {isReconnecting
              ? 'البوت يحاول إعادة الاتصال تلقائياً. قد يستغرق هذا بضع دقائق.'
              : 'اضغط هنا لفتح صفحة الإعدادات وإعادة ربط واتساب ←'}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push('/settings');
          }}
          className="text-xs px-4 py-2 rounded-lg font-bold whitespace-nowrap text-white transition-colors"
          style={{ backgroundColor: '#dc2626' }}
        >
          ربط واتساب ←
        </button>
      </div>
    </div>
  );
}
