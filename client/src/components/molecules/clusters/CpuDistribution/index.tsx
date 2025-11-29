import { useState, useEffect } from 'react'
import { Cpu } from 'lucide-react'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'
import { ChartContainer } from '@/components/atoms/common/ChartContainer'
import './CpuDistribution.css'

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

  const isLoading = !isHistoryLoaded || !metrics?.cpu || history.length === 0

  const width = 100
  const height = 100
  const padding = 10
  const numCores = metrics?.cpu.cores || 0
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
  
  if (!hasCoreData && !isLoading) {
    return (
      <ChartContainer
        icon={Cpu}
        title="CPU"
        isLoading={false}
      >
        <div className="cpu-loading">Waiting for per-core data...</div>
      </ChartContainer>
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

  const avgUsage = coreAverages.length > 0 ? (coreAverages.reduce((a, b) => a + b, 0) / numCores).toFixed(1) : '0'
  const maxCore = coreAverages.length > 0 ? Math.max(...coreAverages).toFixed(1) : '0'
  const minCore = coreAverages.length > 0 ? Math.min(...coreAverages).toFixed(1) : '0'

  const chartContent = (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="cpu-distribution-chart">
      {history.length > 0 && coreColors.map((color, coreIndex) => {
        const points = history
          .filter(d => d.coresUsage && d.coresUsage[coreIndex] !== undefined)
          .map(d => d.coresUsage![coreIndex])
        
        if (points.length === 0) return null
        
        const pathData = createPath(points, maxValue)
        
        return (
          <path
            key={`core-${coreIndex}`}
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            opacity={0.8}
          />
        )
      })}
    </svg>
  )

  return (
    <ChartContainer
      icon={Cpu}
      title="CPU"
      isLoading={isLoading}
      stats={[
        { label: 'Cores', value: numCores },
        { label: 'Avg Usage', value: `${avgUsage}%` },
        { label: 'Max Core', value: `${maxCore}%` },
        { label: 'Min Core', value: `${minCore}%` }
      ]}
      statsLoading={isLoading}
    >
      {chartContent}
    </ChartContainer>
  )
}
