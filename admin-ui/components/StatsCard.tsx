export default function StatsCard({ title, value, subtitle, color = 'var(--md-sys-color-primary)', icon }: {
  title: string; value: string | number; subtitle?: string; color?: string; icon?: string;
}) {
  return (
    <div
      className="md3-card md3-card--elevated p-4 animate-slide-up"
      style={{ borderRight: `3px solid ${color}` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{title}</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>{value}</p>
          {subtitle && <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{subtitle}</p>}
        </div>
        {icon && (
          <span
            className="w-12 h-12 rounded-[var(--md-sys-shape-corner-large)] flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}
