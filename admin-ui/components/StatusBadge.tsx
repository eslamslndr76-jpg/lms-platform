const colors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  review: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};
const labels: Record<string, string> = {
  pending: 'معلق', review: 'قيد المراجعة', paid: 'تم الدفع', cancelled: 'ملغي',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  );
}
