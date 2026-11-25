const statusTokens: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'var(--md-sys-color-warning-container)', text: 'var(--md-sys-color-on-warning-container)' },
  active: { bg: 'var(--md-sys-color-success-container)', text: 'var(--md-sys-color-on-success-container)' },
  review: { bg: 'var(--md-sys-color-info-container)', text: 'var(--md-sys-color-on-info-container)' },
  paid: { bg: 'var(--md-sys-color-success-container)', text: 'var(--md-sys-color-on-success-container)' },
  completed: { bg: 'var(--md-sys-color-info-container)', text: 'var(--md-sys-color-on-info-container)' },
  cancelled: { bg: 'var(--md-sys-color-error-container)', text: 'var(--md-sys-color-on-error-container)' },
};
const labels: Record<string, string> = {
  pending: 'قيد الانتظار', active: 'نشطة',
  review: 'قيد المراجعة', paid: 'تم الدفع',
  completed: 'مكتملة', cancelled: 'ملغية',
};

export default function StatusBadge({ status }: { status: string }) {
  const s = statusTokens[status] || {
    bg: 'var(--md-sys-color-surface-container-high)',
    text: 'var(--md-sys-color-on-surface-variant)',
  };
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium animate-scale-in"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {labels[status] || status}
    </span>
  );
}
