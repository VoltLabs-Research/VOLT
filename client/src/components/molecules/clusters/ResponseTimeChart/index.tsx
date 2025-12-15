import { ChevronDown, Calendar, Maximize2 } from 'lucide-react'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'
import { useState, useEffect } from 'react'
import { ChartContainer } from '@/components/atoms/common/ChartContainer'
import './ResponseTimeChart.css'

const MAX_POINTS = 60 // Show last 60 seconds

interface DataPoint {
  mongodb: number
  redis: number
  minio: number
  self: number
}

function createPathData(points: number[], maxValue: number, width: number, height: number): string {
  if (points.length < 2) return ''

  const stepX = width / Math.max(1, points.length - 1)
  const scaleY = height / maxValue

  const path = points.map((value, index) => {
    const x = index * stepX
    const y = height - (value * scaleY)
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')

  return path
}

export function ResponseTimeChart() {
  const { metrics, history: metricsHistory, isHistoryLoaded } = useServerMetrics()
  const [history, setHistory] = useState<DataPoint[]>([])
  const chartWidth = 100
  const chartHeight = 100

  // Preload with historical data
  useEffect(() => {
    if (isHistoryLoaded && metricsHistory.length > 0 && history.length === 0) {
      console.log('[ResponseTimeChart] Preloading with', metricsHistory.length, 'historical points')
      const historicalData = metricsHistory
        .filter(m => m.responseTimes)
        .slice(-MAX_POINTS)
        .map(m => ({
          mongodb: m.responseTimes!.mongodb,
          redis: m.responseTimes!.redis,
          minio: m.responseTimes!.minio || 0,
          self: m.responseTimes!.self
        }))
      setHistory(historicalData)
    }
  }, [isHistoryLoaded, metricsHistory])

  useEffect(() => {
    if (metrics?.responseTimes) {
      setHistory(prev => {
        const newHistory = [...prev, {
          mongodb: metrics.responseTimes!.mongodb,
          redis: metrics.responseTimes!.redis,
          minio: metrics.responseTimes!.minio || 0,
          self: metrics.responseTimes!.self
        }]
        return newHistory.slice(-MAX_POINTS)
      })
    }
  }, [metrics])

  const regions = [
    {
      name: 'MongoDB',
      value: metrics?.responseTimes?.mongodb.toFixed(0) || '--',
      color: '#0A84FF',
      key: 'mongodb' as keyof DataPoint
    },
    {
      name: 'Redis',
      value: metrics?.responseTimes?.redis.toFixed(0) || '--',
      color: '#30D158',
      key: 'redis' as keyof DataPoint
    },
    {
      name: 'MinIO',
      value: metrics?.responseTimes?.minio?.toFixed(0) || '--',
      color: '#C73A63',
      key: 'minio' as keyof DataPoint
    },
    {
      name: 'Server',
      value: metrics?.responseTimes?.self.toFixed(0) || '--',
      color: '#FF9F0A',
      key: 'self' as keyof DataPoint
    }
  ]

  const maxValue = Math.max(
    ...history.flatMap(d => [d.mongodb, d.redis, d.minio, d.self]),
    100
  )

  const isLoading = !isHistoryLoaded || history.length === 0

  const chartContent = (
    <>
      <div className="d-flex items-center response-chart-legend">
        {regions.map((region) => (
          <div key={region.name} className="d-flex items-center gap-05 response-chart-legend-item">
            <div className="response-chart-legend-dot" style={{ backgroundColor: region.color }} />
            <span className="response-chart-legend-label">{region.name}</span>
            <span className="response-chart-legend-value">{region.value}ms</span>
          </div>
        ))}
      </div>

      <div className="response-chart-container">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          className="response-chart-svg"
        >
          {/* Grid horizontal lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2={chartWidth}
              y2={y}
              stroke="var(--border)"
              strokeWidth="0.2"
              strokeDasharray="1,1"
            />
          ))}

          {/* Chart lines */}
          {history.length > 1 && regions.map((region) => {
            const points = history.map(d => d[region.key])
            const pathData = createPathData(points, maxValue, chartWidth, chartHeight)

            return (
              <path
                key={region.key}
                d={pathData}
                fill="none"
                stroke={region.color}
                strokeWidth="0.8"
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </svg>

        {/* Y-axis labels */}
        <div className="d-flex column content-between response-chart-y-labels">
          {Array.from({ length: 6 }, (_, i) => {
            const value = Math.round(maxValue - (maxValue / 5) * i)
            return <span key={i} className="response-chart-y-label">{value}ms</span>
          })}
        </div>
      </div>
    </>
  )

  return (
    <ChartContainer
      icon={() => <div className="response-chart-bar" />}
      title="Response Time"
      isLoading={isLoading}
    >
      {chartContent}
    </ChartContainer>
  )
}
