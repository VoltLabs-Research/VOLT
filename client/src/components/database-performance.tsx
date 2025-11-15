import { useState, useEffect } from 'react'
import { LineChart, Line, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Database } from 'lucide-react'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'
import { Skeleton } from '@mui/material'
import './database-performance.css'

interface DataPoint {
  queries: number;
  connections: number;
  latency: number;
}

const MAX_POINTS = 60;

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
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
      const newHistory = [...prev, {
        queries: metrics.mongodb!.queries,
        connections: metrics.mongodb!.connections,
        latency: metrics.mongodb!.latency
      }];

      if (newHistory.length > MAX_POINTS) {
        newHistory.shift();
      }

      return newHistory;
    });
  }, [metrics]);

  const isLoading = !isHistoryLoaded || !metrics?.mongodb || history.length === 0

  if (isLoading) {
    return (
      <div className="db-performance-container">
        <div className="db-performance-header">
          <div className="db-performance-title-group">
            <Database className="db-performance-icon" />
            <h3 className="db-performance-title">MongoDB Performance</h3>
          </div>
          <div className="db-performance-stats">
            <div className="db-stat">
              <span className="db-stat-label">Avg Queries</span>
              <Skeleton variant="text" width={40} height={20} />
            </div>
            <div className="db-stat">
              <span className="db-stat-label">Avg Latency</span>
              <Skeleton variant="text" width={40} height={20} />
            </div>
          </div>
        </div>
        <Skeleton variant="rectangular" width="100%" height={280} sx={{ borderRadius: '8px' }} />
      </div>
    );
  }

  const avgQueries = Math.round(history.reduce((sum, d) => sum + d.queries, 0) / history.length);
  const avgLatency = Math.round(history.reduce((sum, d) => sum + d.latency, 0) / history.length);
  
  return (
    <div className="db-performance-container">
      <div className="db-performance-header">
        <div className="db-performance-title-group">
          <Database className="db-performance-icon" />
          <h3 className="db-performance-title">MongoDB Performance</h3>
        </div>
        <div className="db-performance-stats">
          <div className="db-stat">
            <span className="db-stat-label">Avg Queries</span>
            <span className="db-stat-value">{avgQueries}/s</span>
          </div>
          <div className="db-stat">
            <span className="db-stat-label">Avg Latency</span>
            <span className="db-stat-value">{avgLatency}ms</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <YAxis 
            yAxisId="left"
            stroke="rgba(255,255,255,0.4)" 
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="rgba(255,255,255,0.4)" 
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `${value}ms`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
            iconType="circle"
          />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="queries" 
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
    </div>
  )
}
