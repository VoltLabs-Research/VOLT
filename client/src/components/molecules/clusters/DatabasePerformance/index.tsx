import { useState, useEffect } from 'react'
import { LineChart, Line, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Database } from 'lucide-react'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'
import { ChartContainer } from '@/components/atoms/common/ChartContainer'
import './DatabasePerformance.css'

interface DataPoint {
  queries: number;
  connections: number;
  latency: number;
  queriesPerSecond?: number;
}

const MAX_POINTS = 60;

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length >= 3) {
    return (
      <div className="db-tooltip">
        <p className="db-tooltip-label">{payload[0].payload.time}</p>
        <p className="db-tooltip-item" style={{ color: '#3b82f6' }}>
          Queries: <strong>{payload[0].value}/s</strong>
        </p>
        <p className="db-tooltip-item" style={{ color: '#8b5cf6' }}>
          Connections: <strong>{payload[1].value}</strong>
        </p>
        <p className="db-tooltip-item" style={{ color: '#06b6d4' }}>
          Latency: <strong>{payload[2].value}ms</strong>
        </p>
      </div>
    )
  }
  return null
}

export function DatabasePerformance() {
  const { metrics, history: metricsHistory, isHistoryLoaded } = useServerMetrics();
  const [history, setHistory] = useState<DataPoint[]>([]);

  // Preload with historical data
  useEffect(() => {
    if (isHistoryLoaded && metricsHistory.length > 0 && history.length === 0) {
      console.log('[DatabasePerformance] Preloading with', metricsHistory.length, 'historical points')
      const historicalData = metricsHistory
        .filter(m => m.mongodb)
        .slice(-MAX_POINTS)
        .map(m => ({
          queries: m.mongodb!.queries,
          connections: m.mongodb!.connections,
          latency: m.mongodb!.latency
        }))
      setHistory(historicalData)
    }
  }, [isHistoryLoaded, metricsHistory])

  useEffect(() => {
    if (!metrics?.mongodb) return;

    setHistory(prev => {
      const newDataPoint: DataPoint = {
        queries: metrics.mongodb!.queries,
        connections: metrics.mongodb!.connections,
        latency: metrics.mongodb!.latency
      };

      // Calculate queries per second (delta from previous point)
      if (prev.length > 0) {
        const lastPoint = prev[prev.length - 1];
        const queriesDelta = Math.max(0, newDataPoint.queries - lastPoint.queries);
        newDataPoint.queriesPerSecond = queriesDelta;
      }

      const newHistory = [...prev, newDataPoint];

      if (newHistory.length > MAX_POINTS) {
        newHistory.shift();
      }

      return newHistory;
    });
  }, [metrics]);

  const isLoading = !isHistoryLoaded || !metrics?.mongodb || history.length === 0

  const avgQueries = Math.round(history
    .filter(d => d.queriesPerSecond !== undefined)
    .reduce((sum, d) => sum + (d.queriesPerSecond || 0), 0) / Math.max(1, history.filter(d => d.queriesPerSecond !== undefined).length));
  const avgLatency = Math.round(history.reduce((sum, d) => sum + d.latency, 0) / history.length);

  return (
    <ChartContainer
      icon={Database}
      title="MongoDB Performance"
      isLoading={isLoading}
      stats={[
        { label: 'Avg Queries', value: `${avgQueries}/s` },
        { label: 'Avg Latency', value: `${avgLatency}ms` }
      ]}
      statsLoading={isLoading}
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <YAxis 
            yAxisId="left"
            stroke="var(--muted-foreground)" 
            style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="var(--muted-foreground)" 
            style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}
            tickFormatter={(value) => `${value}ms`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '12px', paddingTop: '20px', color: 'var(--foreground)' }}
            iconType="circle"
          />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="queriesPerSecond" 
            stroke="#0A84FF" 
            strokeWidth={2}
            dot={false}
            name="Queries/s"
            isAnimationActive={false}
          />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="connections" 
            stroke="#30D158" 
            strokeWidth={2}
            dot={false}
            name="Connections"
            isAnimationActive={false}
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="latency" 
            stroke="#FF9F0A" 
            strokeWidth={2}
            dot={false}
            name="Latency (ms)"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
