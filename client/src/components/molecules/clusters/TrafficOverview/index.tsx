import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Activity } from 'lucide-react'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'
import { useState, useEffect } from 'react'
import { ChartContainer } from '@/components/atoms/common/ChartContainer'
import { formatNetworkSpeed } from '@/utilities/network'
import './TrafficOverview.css'


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
        .map((m: any) => {
          const timestamp = new Date(m.timestamp)
          const timeStr = `${timestamp.getHours()}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`
          return {
            time: timeStr,
            incoming: m.network?.incoming ?? 0,
            outgoing: m.network?.outgoing ?? 0,
            total: (m.network?.incoming ?? 0) + (m.network?.outgoing ?? 0)
          }
        })
      setData(historicalData)
    }
  }, [isHistoryLoaded, metricsHistory])

  // Update with real-time metrics
  useEffect(() => {
    if (metrics?.network && data.length > 0) {
      const timestamp = new Date()
      const timeStr = `${timestamp.getHours()}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`

      setData(prevData => {
        const newData = [...prevData, {
          time: timeStr,
          incoming: metrics.network.incoming,
          outgoing: metrics.network.outgoing,
          total: metrics.network.incoming + metrics.network.outgoing
        }]
        return newData.slice(-MAX_POINTS)
      })
    }
  }, [metrics])

  const isLoading = !isHistoryLoaded || data.length === 0

  // Calculate stats
  const stats = data.length > 0
    ? {
      peak: Math.max(...data.map(d => d.total)),
      avg: data.reduce((sum, d) => sum + d.total, 0) / data.length
    }
    : { peak: 0, avg: 0 }

  const chartContent = (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data.length > 0 ? data : [{ time: '', incoming: 0, outgoing: 0, total: 0 }]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorIncoming" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0A84FF" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#0A84FF" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorOutgoing" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#30D158" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#30D158" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <YAxis
          stroke="var(--muted-foreground)"
          style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}
          tickFormatter={(value) => `${value}M`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '20px', color: 'var(--foreground)' }}
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
  )

  const peakTraffic = formatNetworkSpeed(stats.peak)
  const avgTraffic = formatNetworkSpeed(stats.avg)

  return (
    <ChartContainer
      icon={Activity}
      title="Network Traffic"
      isLoading={isLoading}
      stats={[
        { label: 'Peak', value: peakTraffic },
        { label: 'Avg', value: avgTraffic }
      ]}
      statsLoading={isLoading}
    >
      {chartContent}
    </ChartContainer>
  )
}
