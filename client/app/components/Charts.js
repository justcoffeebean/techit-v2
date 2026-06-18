'use client'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { colors } from '../lib/styles'

const COLORS = [colors.success, colors.info, colors.warning, colors.error, '#a78bfa', '#34d399']

export default function Charts({ metrics }) {
  const statusData = Object.entries(metrics.by_status || {}).map(([name, value]) => ({ name, value }))
  const categoryData = Object.entries(metrics.by_category || {}).map(([name, data]) => ({
    name, count: data.count, value: parseFloat(data.value.toFixed(2))
  }))

  const tooltipStyle = {
    contentStyle: { background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8 },
    labelStyle: { color: colors.text },
    itemStyle: { color: colors.success },
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 24 }}>

      {/* Status pie chart */}
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: colors.subtle, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 }}>
          Stock Status
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${value}`}>
              {statusData.map((_, i) => (
                <Cell key={i} fill={i === 0 ? colors.success : i === 1 ? colors.warning : colors.error} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
            <Legend formatter={(value) => <span style={{ color: colors.muted, fontSize: 12 }}>{value}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Category bar chart */}
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: colors.subtle, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 }}>
          Inventory by Category
        </h3>
        {categoryData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={categoryData}>
              <XAxis dataKey="name" stroke={colors.subtle} fontSize={11} />
              <YAxis stroke={colors.subtle} fontSize={11} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill={colors.success} radius={[4, 4, 0, 0]} name="Items" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.subtle }}>
            No data yet
          </div>
        )}
      </div>
    </div>
  )
}
