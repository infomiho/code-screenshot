import type { PlausibleSnapshotDto } from '../contracts'

export function TrafficChart({ snapshot }: { snapshot: PlausibleSnapshotDto }) {
  const width = 720
  const height = 180
  const inset = 12
  const maximum = Math.max(1, ...snapshot.daily.flatMap((day) => [day.visitors, day.pageviews]))
  const toPoints = (metric: 'visitors' | 'pageviews') => snapshot.daily.map((day, index) => {
    const x = snapshot.daily.length === 1
      ? width / 2
      : inset + index * ((width - inset * 2) / (snapshot.daily.length - 1))
    const y = height - inset - day[metric] / maximum * (height - inset * 2)
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="admin-chart">
      {snapshot.daily.length > 0 ? (
        <>
          <span className="admin-chart-scale admin-chart-scale-max" aria-hidden="true">{maximum}</span>
          <span className="admin-chart-scale admin-chart-scale-min" aria-hidden="true">0</span>
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily visitors and pageviews over 30 days">
            <title>Daily visitors and pageviews over 30 days</title>
            <line x1={inset} x2={width - inset} y1={height - inset} y2={height - inset} />
            <polyline className="admin-chart-pageviews" points={toPoints('pageviews')} />
            <polyline className="admin-chart-visitors" points={toPoints('visitors')} />
          </svg>
          <div className="admin-chart-dates" aria-hidden="true">
            <span>{snapshot.daily[0]?.date}</span>
            <span>{snapshot.daily.at(-1)?.date}</span>
          </div>
          <table className="sr-only">
            <caption>Daily Plausible traffic</caption>
            <thead><tr><th>Date</th><th>Visitors</th><th>Pageviews</th></tr></thead>
            <tbody>
              {snapshot.daily.map((day) => (
                <tr key={day.date}><td>{day.date}</td><td>{day.visitors}</td><td>{day.pageviews}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="admin-empty-copy">No traffic recorded.</p>
      )}
      <div className="admin-chart-legend">
        <span data-series="visitors">Visitors</span>
        <span data-series="pageviews">Pageviews</span>
      </div>
    </div>
  )
}
