'use client'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#4ade80', '#60a5fa', '#fb923c', '#f87171', '#a78bfa', '#34d399']

export default function Charts({ metrics }) {
  const statusData = Object.entries(metrics.by_status || {}).map(([name, value]) => ({ name, value }))
  const categoryData = Object.entries(metrics.by_category || {}).map(([name, data]) => ({
    name, count: data.count, value: parseFloat(data.value.toFixed(2))
  }))

  const tooltipStyle = {
    contentStyle: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 },
    labelStyle: { color: '#fff' },
    itemStyle: { color: '#4ade80' },
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 24 }}>

      {/* Status pie chart */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 }}>
          Stock Status
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${value}`}>
              {statusData.map((_, i) => (
                <Cell key={i} fill={i === 0 ? '#4ade80' : i === 1 ? '#fb923c' : '#f87171'} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
            <Legend formatter={(value) => <span style={{ color: '#888', fontSize: 12 }}>{value}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Category bar chart */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 }}>
          Inventory by Category
        </h3>
        {categoryData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={categoryData}>
              <XAxis dataKey="name" stroke="#555" fontSize={11} />
              <YAxis stroke="#555" fontSize={11} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="#4ade80" radius={[4, 4, 0, 0]} name="Items" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
            No data yet
          </div>
        )}
      </div>
    </div>
  )
}