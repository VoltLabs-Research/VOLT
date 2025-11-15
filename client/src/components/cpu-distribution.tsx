import { useState, useEffect } from 'react'
import { Cpu } from 'lucide-react'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'
import './cpu-distribution.css'

interface DataPoint {
  coresUsage?: number[]
}

const MAX_POINTS = 60

// Generate colors for individual cores
const generateCoreColors = (numCores: number): string[] => {
  const colors: string[] = []
  for (let i = 0; i < numCores; i++) {
    const hue = (i * 360) / numCores
    colors.push(`hsl(${hue}, 80%, 65%)`)
  }
  return colors
}

export function CpuDistribution() {
  const { metrics, history: metricsHistory, isHistoryLoaded } = useServerMetrics()
  const [history, setHistory] = useState<DataPoint[]>([])

  // Preload with historical data
  useEffect(() => {
    if (isHistoryLoaded && metricsHistory.length > 0 && history.length === 0) {
      console.log('[CpuDistribution] Preloading with', metricsHistory.length, 'historical points')
      const historicalData = metricsHistory
        .filter(m => m.cpu)
        .slice(-MAX_POINTS)
        .map(m => ({
          coresUsage: m.cpu.coresUsage
        }))
      setHistory(historicalData)
    }
  }, [isHistoryLoaded, metricsHistory])

  useEffect(() => {
    if (!metrics?.cpu) return

    setHistory(prev => {
      const newHistory = [...prev, {
        coresUsage: metrics.cpu.coresUsage
      }]

      if (newHistory.length > MAX_POINTS) {
        newHistory.shift()
      }

      return newHistory
    })
  }, [metrics])

  if (!metrics?.cpu || history.length === 0) {
    return (
      <div className="cpu-distribution-container">
        <div className="cpu-distribution-header">
          <div className="cpu-distribution-title-group">
            <Cpu className="cpu-distribution-icon" />
            <h3 className="cpu-distribution-title">CPU Load Analysis</h3>
          </div>
        </div>
        <div className="cpu-loading">Waiting for data...</div>
      </div>
    )
  }

  const width = 100
  const height = 100
  const padding = 10
  const numCores = metrics.cpu.cores
  const coreColors = generateCoreColors(numCores)

  const getX = (index: number, length: number) => {
    if (length <= 1) return 50
    return (index / (length - 1)) * 100
  }
  
  const createPath = (values: number[], maxVal: number) => {
    if (values.length === 0) return ''
    
    const getY = (value: number) => {
      const scaledValue = (value / maxVal) * (100 - padding * 2)
      return 100 - scaledValue - padding
    }
    
    let path = `M ${getX(0, values.length)} ${getY(values[0])}`
    for (let i = 1; i < values.length; i++) {
      path += ` L ${getX(i, values.length)} ${getY(values[i])}`
    }
    return path
  }

  const hasCoreData = history.some(d => d.coresUsage && d.coresUsage.length > 0)
  
  if (!hasCoreData) {
    return (
      <div className="cpu-distribution-container">
        <div className="cpu-distribution-header">
          <div className="cpu-distribution-title-group">
            <Cpu className="cpu-distribution-icon" />
            <h3 className="cpu-distribution-title">CPU</h3>
            <span className="cpu-mode-badge">Per Core</span>
          </div>
        </div>
        <div className="cpu-loading">Waiting for per-core data...</div>
      </div>
    )
  }

  const maxValue = 100 // CPU usage is 0-100%

  // Calculate average usage per core
  const coreAverages = Array(numCores).fill(0).map((_, coreIndex) => {
    const values = history
      .filter(d => d.coresUsage && d.coresUsage[coreIndex] !== undefined)
      .map(d => d.coresUsage![coreIndex])
    
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  })

  return (
    <div className="cpu-distribution-container">
      <div className="cpu-distribution-header">
        <div className="cpu-distribution-title-group">
          <Cpu className="cpu-distribution-icon" />
          <h3 className="cpu-distribution-title">CPU</h3>
          <span className="cpu-mode-badge">Per Core</span>
        </div>
        <div className="cpu-stats">
          <div className="cpu-stat">
            <span className="cpu-stat-label">Cores</span>
            <span className="cpu-stat-value">{numCores}</span>
          </div>
          <div className="cpu-stat">
            <span className="cpu-stat-label">Avg Usage</span>
            <span className="cpu-stat-value">
              {(coreAverages.reduce((a, b) => a + b, 0) / numCores).toFixed(1)}%
            </span>
          </div>
          <div className="cpu-stat">
            <span className="cpu-stat-label">Max Core</span>
            <span className="cpu-stat-value">{Math.max(...coreAverages).toFixed(1)}%</span>
          </div>
          <div className="cpu-stat">
            <span className="cpu-stat-label">Min Core</span>
            <span className="cpu-stat-value">{Math.min(...coreAverages).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="cpu-chart">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
          
          {Array.from({ length: numCores }).map((_, coreIndex) => {
            const coreValues = history.map(d => 
              d.coresUsage && d.coresUsage[coreIndex] !== undefined 
                ? d.coresUsage[coreIndex] 
                : 0
            )
            
            if (coreValues.every(v => v === 0)) return null
            
            const path = createPath(coreValues, maxValue)
            
            return path ? (
              <path
                key={coreIndex}
                d={path}
                fill="none"
                stroke={coreColors[coreIndex]}
                strokeWidth="0.5"
                opacity={0.9}
              />
            ) : null
          })}
        </svg>

        <div className="cpu-legend">
          <div className="cpu-cores-grid">
            {Array.from({ length: Math.min(numCores, 16) }).map((_, i) => (
              <div key={i} className="cpu-legend-item">
                <span className="cpu-legend-dot" style={{ backgroundColor: coreColors[i] }}></span>
                <span className="cpu-legend-label">Core {i}</span>
              </div>
            ))}
            {numCores > 16 && (
              <div className="cpu-legend-item">
                <span className="cpu-legend-label">+{numCores - 16} more</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
