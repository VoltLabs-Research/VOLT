import { useState, useEffect } from 'react'
import { Cpu } from 'lucide-react'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'
import { ChartContainer } from '@/components/atoms/common/ChartContainer'
import '@/features/clusters/components/molecules/CpuDistribution/CpuDistribution.css'

interface DataPoint {
  coresUsage?: number[]
}

const MAX_POINTS = 60

const generateCoreColors = (numCores: number): string[] => {
  const colors: string[] = []
  for (let i = 0; i < numCores; i++) {
    const hue = (i * 360) / numCores
    colors.push(`hsl(${hue}, 80%, 65%)`)
  }
  return colors
}

interface CpuDistributionProps {
  metrics: any;
}

export function CpuDistribution({ metrics }: CpuDistributionProps) {
  // const { metrics, history: metricsHistory, isHistoryLoaded } = useServerMetrics()
  const [history, setHistory] = useState<DataPoint[]>([])
  const isHistoryLoaded = true; // Bypass

  const numCores = metrics?.cpu?.cores || 0

  /*
  // Preload with historical data - Disabled
  useEffect(() => {
    if(isHistoryLoaded && metricsHistory.length > 0 && history.length === 0){
      const historicalData = metricsHistory
          .filter((m: any) => m.cpu)
          .slice(-MAX_POINTS)
          .map((m: any) => ({ coresUsage: m.cpu.coresUsage }))
      setHistory(historicalData)
    }
  }, [isHistoryLoaded, metricsHistory])
  */

  // Update with realtime metrics
  useEffect(() => {
    if (!metrics?.cpu) return

    setHistory(prev => {
      const newHistory = [...prev, { coresUsage: metrics.cpu.coresUsage }]
      if (newHistory.length > MAX_POINTS) newHistory.shift()
      return newHistory
    })
  }, [metrics])

  // Calculate stats synchronously(60 items is fast)
  const stats = (() => {
    if (history.length === 0 || numCores === 0) return { avgUsage: '0', maxCore: '0', minCore: '0' }

    const coreAverages = Array(numCores).fill(0).map((_, coreIndex) => {
      const values = history
        .filter(d => d.coresUsage && d.coresUsage[coreIndex] !== undefined)
        .map(d => d.coresUsage![coreIndex])
      if (values.length === 0) return 0
      return values.reduce((sum, val) => sum + val, 0) / values.length
    })

    return {
      avgUsage: (coreAverages.reduce((a, b) => a + b, 0) / numCores).toFixed(1),
      maxCore: Math.max(...coreAverages).toFixed(1),
      minCore: Math.min(...coreAverages).toFixed(1)
    }
  })()

  const isLoading = !metrics // || !isHistoryLoaded || !metrics?.cpu || history.length === 0
  const coreColors = generateCoreColors(numCores)

  const width = 100
  const height = 100
  const padding = 10
  const maxValue = 100

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
      <ChartContainer icon={Cpu} title="CPU" isLoading={false}>
        <div className="d-flex flex-center flex-1 cpu-loading font-size-2 color-muted-foreground color-muted">Waiting for per-core data...</div>
      </ChartContainer>
    )
  }

  const chartContent = (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="cpu-distribution-chart">
      {history.length > 0 && coreColors.map((color, coreIndex) => {
        const points = history
          .filter(d => d.coresUsage && d.coresUsage[coreIndex] !== undefined)
          .map(d => d.coresUsage![coreIndex])

        if (points.length === 0) return null

        return (
          <path
            key={`core-${coreIndex}`}
            d={createPath(points, maxValue)}
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
        { label: 'Avg Usage', value: `${stats.avgUsage}%` },
        { label: 'Max Core', value: `${stats.maxCore}%` },
        { label: 'Min Core', value: `${stats.minCore}%` }
      ]}
      statsLoading={isLoading}
    >
      {chartContent}
    </ChartContainer>
  )
}
