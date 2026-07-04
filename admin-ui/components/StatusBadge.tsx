const styles: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'rgba(251,191,36,0.15)', text: '#f59e0b' },
  active: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  review: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
  paid: { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
  completed: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
  cancelled: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
};
const labels: Record<string, string> = {
  pending: 'قيد الانتظار', active: 'نشطة',
  review: 'قيد المراجعة', paid: 'تم الدفع',
  completed: 'مكتملة', cancelled: 'ملغية',
};

export default function StatusBadge({ status }: { status: string }) {
  const s = styles[status] || { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af' };
  return (
    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium animate-scale-in"
      style={{ backgroundColor: s.bg, color: s.text }}>
      {labels[status] || status}
    </span>
  );
}
