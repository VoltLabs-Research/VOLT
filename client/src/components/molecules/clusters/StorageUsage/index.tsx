import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import { HardDrive } from 'lucide-react'
import './StorageUsage.css'
import Title from '@/components/primitives/Title'
import Paragraph from '@/components/primitives/Paragraph'

const data = [
  { name: 'DB-01', used: 1245, total: 2000, percentage: 62 },
  { name: 'DB-02', used: 1680, total: 2000, percentage: 84 },
  { name: 'Files', used: 3420, total: 5000, percentage: 68 },
  { name: 'Logs', used: 890, total: 1000, percentage: 89 },
  { name: 'Backup', used: 7200, total: 10000, percentage: 72 },
]

const getColor = (percentage: number) => {
  if (percentage >= 85) return 'url(#storageCritical)'
  if (percentage >= 70) return 'url(#storageWarning)'
  return 'url(#storageNormal)'
}

const getSolidColor = (percentage: number) => {
  if (percentage >= 85) return '#FF453A'
  if (percentage >= 70) return '#FF9F0A'
  return '#0A84FF'
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="storage-tooltip">
        <Paragraph className="storage-tooltip-label">{data.name}</Paragraph>
        <Paragraph className="storage-tooltip-item">
          Used: <strong>{data.used} GB</strong> / {data.total} GB
        </Paragraph>
        <Paragraph className="storage-tooltip-item" style={{ color: getSolidColor(data.percentage) }}>
          {data.percentage}% Full
        </Paragraph>
      </div>
    )
  }
  return null
}

export function StorageUsage() {
  const totalUsed = data.reduce((sum, d) => sum + d.used, 0)
  const totalCapacity = data.reduce((sum, d) => sum + d.total, 0)
  const totalPercentage = Math.round((totalUsed / totalCapacity) * 100)

  return (
    <div className="storage-usage-container">
      <div className="storage-usage-header">
        <div className="storage-usage-title-group">
          <HardDrive className="storage-usage-icon" />
          <Title className='font-size-3 storage-usage-title'>Storage Distribution</Title>
        </div>
        <div className="storage-total-badge">
          <span className="storage-total-value">{totalPercentage}%</span>
          <span className="storage-total-label">
            {(totalUsed / 1000).toFixed(1)}TB / {(totalCapacity / 1000).toFixed(1)}TB
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="storageNormal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0A84FF" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#0A84FF" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="storageWarning" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FF9F0A" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#FF9F0A" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="storageCritical" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FF453A" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#FF453A" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="name"
            stroke="rgba(255,255,255,0.4)"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="rgba(255,255,255,0.4)"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `${value}GB`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
            content={() => (
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', fontSize: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '12px', height: '12px', backgroundColor: '#0A84FF', borderRadius: '2px' }}></span>
                  Used Storage
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '12px', height: '12px', backgroundColor: '#FF9F0A', borderRadius: '2px' }}></span>
                  {'>'}70% Warning
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '12px', height: '12px', backgroundColor: '#FF453A', borderRadius: '2px' }}></span>
                  {'>'}85% Critical
                </span>
              </div>
            )}
          />
          <Bar dataKey="used" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.percentage)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
