import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { PlausibleSnapshotDto } from '../contracts'

const numberFormatter = new Intl.NumberFormat()
const shortDateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const fullDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

const formatDate = (date: string, formatter: Intl.DateTimeFormat) =>
  formatter.format(new Date(`${date}T00:00:00`))

function TrafficTooltip({ active, label, payload }: TooltipContentProps) {
  if (!active || typeof label !== 'string') return null
  const valueFor = (dataKey: string) => Number(payload.find((entry) => entry.dataKey === dataKey)?.value ?? 0)

  return (
    <div className="admin-chart-tooltip">
      <strong>{formatDate(label, fullDateFormatter)}</strong>
      <span data-series="visitors"><i />Visitors <b>{numberFormatter.format(valueFor('visitors'))}</b></span>
    </div>
  )
}

export function TrafficChart({ snapshot }: { snapshot: PlausibleSnapshotDto }) {
  const maximum = Math.max(0, ...snapshot.daily.map((day) => day.visitors))
  const xTicks = [...new Set([0, 7, 14, 21, snapshot.daily.length - 1])]
    .filter((index) => index >= 0 && index < snapshot.daily.length)
    .map((index) => snapshot.daily[index].date)

  return (
    <div className="admin-chart">
      <div className="admin-chart-header">
        <h3>Daily visitors</h3>
      </div>
      {snapshot.daily.length > 0 ? (
        <div className="admin-chart-plot">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={snapshot.daily}
              margin={{ top: 8, right: 20, bottom: 0, left: -16 }}
              title="Daily visitors over 30 days"
            >
              <CartesianGrid vertical={false} stroke="var(--panel-border)" strokeDasharray="2 5" />
              <XAxis
                dataKey="date"
                ticks={xTicks}
                tickFormatter={(date: string) => formatDate(date, shortDateFormatter)}
                axisLine={false}
                tickLine={false}
                interval={0}
                tick={{ fill: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11 }}
              />
              <YAxis
                domain={[0, maximum === 0 ? 1 : 'auto']}
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tickCount={maximum <= 4 ? Math.max(2, maximum + 1) : 5}
                width={42}
                tick={{ fill: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11 }}
              />
              <Tooltip
                content={TrafficTooltip}
                cursor={{ stroke: 'color-mix(in oklch, var(--text), transparent 58%)', strokeDasharray: '3 4' }}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="visitors"
                name="Visitors"
                stroke="var(--wasp-yellow)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--panel)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="sr-only">
            <table>
              <caption>Daily Plausible visitors</caption>
              <thead><tr><th>Date</th><th>Visitors</th></tr></thead>
              <tbody>
                {snapshot.daily.map((day) => (
                  <tr key={day.date}><td>{day.date}</td><td>{day.visitors}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="admin-empty-copy">No traffic recorded.</p>
      )}
    </div>
  )
}
