'use client'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useTheme } from '../lib/useTheme'
import { chartColorsDark, chartColorsLight, chartInk } from '../lib/styles'

/** Compact axis money, so ticks stay short: 12400 -> $12.4k */
function axisMoney(v) {
  const n = Number(v) || 0
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  return `$${n}`
}

function shortDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export default function SalesCharts({ metrics, moneyExact }) {
  const { colors, isDark } = useTheme()
  const series = isDark ? chartColorsDark : chartColorsLight
  const ink = isDark ? chartInk.dark : chartInk.light

  const card = {
    background: colors.card, border: `1px solid ${colors.border}`,
    borderRadius: 12, padding: 24, marginBottom: 16,
  }
  const heading = {
    fontSize: 13, fontWeight: 700, color: colors.subtle,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
  }
  const subheading = { fontSize: 12, color: colors.subtle, marginBottom: 20, opacity: 0.8 }

  // One tooltip treatment everywhere, in text ink rather than series colour
  const tooltip = {
    contentStyle: {
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      fontSize: 12,
    },
    labelStyle: { color: colors.text, fontWeight: 700, marginBottom: 4 },
    itemStyle: { color: colors.muted },
    cursor: { stroke: ink.axis, strokeWidth: 1 },
  }

  const legend = (
    <Legend
      formatter={value => (
        <span style={{ color: colors.muted, fontSize: 12 }}>{value}</span>
      )}
      iconType="circle"
      iconSize={8}
      itemSorter={item => (item.dataKey === 'revenue' ? 0 : 1)}
    />
  )

  const byDay = metrics.by_day || []
  const byCategory = metrics.by_category || []
  const topProducts = metrics.top_products || []

  const noData = byDay.every(d => d.revenue === 0 && d.profit === 0)

  return (
    <>
      {/* Revenue and profit share a currency axis, so they belong on one
          chart with one scale. Never a second y-axis. */}
      <div style={card}>
        <h3 style={heading}>Revenue and profit</h3>
        <p style={subheading}>Daily, over the selected period</p>

        {noData ? (
          <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.subtle, fontSize: 13 }}>
            No sales recorded in this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={byDay} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={series[0]} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={series[0]} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={series[1]} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={series[1]} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke={ink.grid} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                stroke={ink.axis}
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: ink.grid }}
                minTickGap={24}
              />
              <YAxis
                stroke={ink.axis}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={axisMoney}
                width={56}
              />
              <Tooltip
                {...tooltip}
                labelFormatter={shortDate}
                formatter={(value, name) => [moneyExact(value), name]}
              />
              {legend}
              <Area
                type="monotone" dataKey="revenue" name="Revenue"
                stroke={series[0]} strokeWidth={2}
                fill="url(#revenueFill)"
                dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: colors.card }}
                isAnimationActive={false}
              />
              <Area
                type="monotone" dataKey="profit" name="Profit"
                stroke={series[1]} strokeWidth={2}
                fill="url(#profitFill)"
                dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: colors.card }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>

        {/* Category comparison — horizontal bars, since category names are
            words and read better along the axis than rotated under it. */}
        <div style={card}>
          <h3 style={heading}>Revenue by category</h3>
          <p style={subheading}>Highest first</p>

          {byCategory.length === 0 ? (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.subtle, fontSize: 13 }}>
              No category data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(240, byCategory.length * 38)}>
              <BarChart
                data={byCategory}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                barCategoryGap={6}
              >
                <CartesianGrid stroke={ink.grid} horizontal={false} />
                <XAxis
                  type="number" stroke={ink.axis} fontSize={11}
                  tickLine={false} axisLine={false} tickFormatter={axisMoney}
                />
                <YAxis
                  type="category" dataKey="name"
                  stroke={ink.axis} fontSize={11}
                  tickLine={false} axisLine={false} width={100}
                />
                <Tooltip
                  {...tooltip}
                  cursor={{ fill: ink.grid, fillOpacity: 0.4 }}
                  formatter={(value, name) => [moneyExact(value), name]}
                />
                {/* One series needs no legend — the title names it. */}
                <Bar
                  dataKey="revenue" name="Revenue"
                  fill={series[0]} radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top products by revenue */}
        <div style={card}>
          <h3 style={heading}>Top products</h3>
          <p style={subheading}>By revenue in this period</p>

          {topProducts.length === 0 ? (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.subtle, fontSize: 13 }}>
              No product data
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Product', 'Units', 'Revenue', 'Profit'].map((h, i) => (
                      <th key={h} style={{
                        textAlign: i === 0 ? 'left' : 'right',
                        padding: '6px 8px', fontSize: 10, fontWeight: 700,
                        color: colors.subtle, textTransform: 'uppercase',
                        letterSpacing: 0.5, borderBottom: `1px solid ${colors.border}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map(p => (
                    <tr key={p.sku}>
                      <td style={{ padding: '8px', borderBottom: `1px solid ${colors.border}` }}>
                        <span style={{ fontSize: 13, color: colors.text }}>{p.name}</span>
                        <span style={{ fontSize: 11, color: colors.subtle, fontFamily: 'monospace', marginLeft: 8 }}>
                          {p.sku}
                        </span>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: 13, color: colors.muted, borderBottom: `1px solid ${colors.border}` }}>
                        {p.units}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: 13, color: colors.text, fontWeight: 600, borderBottom: `1px solid ${colors.border}` }}>
                        {moneyExact(p.revenue)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: 13, color: colors.muted, borderBottom: `1px solid ${colors.border}` }}>
                        {moneyExact(p.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
