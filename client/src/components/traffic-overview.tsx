import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Activity } from 'lucide-react'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'
import { useState, useEffect } from 'react'
import { Skeleton } from '@mui/material'
import './traffic-overview.css'

function formatNetworkSpeed(kbs: number): string {
  if (kbs < 1) return `${(kbs * 1024).toFixed(0)} B/s`;
  if (kbs < 1024) return `${kbs.toFixed(1)} KB/s`;
  if (kbs < 1024 * 1024) return `${(kbs / 1024).toFixed(2)} MB/s`;
  return `${(kbs / (1024 * 1024)).toFixed(2)} GB/s`;
}

const MAX_POINTS = 60

interface DataPoint {
  time: string
  incoming: number
  outgoing: number
  total: number
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="traffic-tooltip">
        <p className="traffic-tooltip-label">{payload[0].payload.time}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="traffic-tooltip-item" style={{ color: entry.color }}>
            {entry.name}: <strong>{formatNetworkSpeed(entry.value)}</strong>
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function TrafficOverview() {
  const { metrics, history: metricsHistory, isHistoryLoaded } = useServerMetrics()
  const [data, setData] = useState<DataPoint[]>([])
  
  // Preload with historical data
  useEffect(() => {
    if (isHistoryLoaded && metricsHistory.length > 0 && data.length === 0) {
      console.log('[TrafficOverview] Preloading with', metricsHistory.length, 'historical points')
      const historicalData = metricsHistory
        .slice(-MAX_POINTS)
        .map(m => {
          const timestamp = new Date(m.timestamp)
          const timeStr = `${timestamp.getHours()}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`
          return {
            time: timeStr,
            incoming: m.network.incoming,
            outgoing: m.network.outgoing,
            total: m.network.incoming + m.network.outgoing
          }
        })
      setData(historicalData)
    }
  }, [isHistoryLoaded, metricsHistory])

  const isLoading = !isHistoryLoaded || data.length === 0
  
  useEffect(() => {
    if (metrics) {
      const now = new Date()
      const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      
      setData(prev => {
        const newData = [...prev, {
          time: timeStr,
          incoming: metrics.network.incoming,
          outgoing: metrics.network.outgoing,
          total: metrics.network.incoming + metrics.network.outgoing
        }]
        return newData.slice(-MAX_POINTS)
      })
    }
  }, [metrics])
  
  return (
    <div className="traffic-overview-container">
      <div className="traffic-overview-header">
        <div className="traffic-overview-title-group">
          <Activity className="traffic-overview-icon" />
          <h3 className="traffic-overview-title">Network Traffic</h3>
        </div>
        <div className="traffic-overview-stats">
          <div className="traffic-stat">
            <span className="traffic-stat-label">Peak</span>
            <span className="traffic-stat-value">{data.length > 0 ? formatNetworkSpeed(Math.max(...data.map(d => d.total))) : '0 B/s'}</span>
          </div>
          <div className="traffic-stat">
            <span className="traffic-stat-label">Avg</span>
            <span className="traffic-stat-value">{data.length > 0 ? formatNetworkSpeed(data.reduce((sum, d) => sum + d.total, 0) / data.length) : '0 B/s'}</span>
          </div>
        </div>
      </div>
      {isLoading ? (
        <Skeleton variant="rectangular" width="100%" height={300} sx={{ borderRadius: '8px' }} />
      ) : (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data.length > 0 ? data : [{ time: '', incoming: 0, outgoing: 0, total: 0 }]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorIncoming" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0A84FF" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#0A84FF" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorOutgoing" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#30D158" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#30D158" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <YAxis 
            stroke="rgba(255,255,255,0.4)" 
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `${value}M`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
            iconType="circle"
          />
          <Area 
            type="monotone" 
            dataKey="incoming" 
            stroke="#0A84FF" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorIncoming)"
            name="Incoming"
            isAnimationActive={false}
          />
          <Area 
            type="monotone" 
            dataKey="outgoing" 
            stroke="#30D158" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorOutgoing)"
            name="Outgoing"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      )}
    </div>
  )
}
