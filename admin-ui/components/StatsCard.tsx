export default function StatsCard({ title, value, subtitle, color = '#2563eb', icon }: {
  title: string; value: string | number; subtitle?: string; color?: string; icon?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50" style={{ borderRightColor: color, borderRightWidth: 3 }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        {icon && <span className="text-3xl opacity-30">{icon}</span>}
      </div>
    </div>
  );
}
