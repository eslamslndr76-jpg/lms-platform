export default function StatsCard({ title, value, subtitle, color = '#2563eb', icon }: {
  title: string; value: string | number; subtitle?: string; color?: string; icon?: string;
}) {
  return (
    <div className="rounded-2xl p-4 border animate-slide-up" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRightColor: color, borderRightWidth: 3 }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{title}</p>
          <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          {subtitle && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
        {icon && <span className="text-3xl opacity-30">{icon}</span>}
      </div>
    </div>
  );
}
