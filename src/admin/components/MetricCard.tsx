const numberFormatter = new Intl.NumberFormat()

export function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="admin-metric-card">
      <span>{label}</span>
      <strong>{typeof value === 'number' ? numberFormatter.format(value) : value}</strong>
    </article>
  )
}
