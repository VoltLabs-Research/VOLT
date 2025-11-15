import { useState, useEffect } from 'react'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'

interface UseMetricsHistoryOptions {
  maxPoints?: number
  filter?: (m: any) => boolean
  mapper: (m: any) => any
  dependencyKey: string
}

export function useMetricsHistory({
  maxPoints = 60,
  filter,
  mapper,
  dependencyKey
}: UseMetricsHistoryOptions) {
  const { metrics, history: metricsHistory, isHistoryLoaded } = useServerMetrics()
  const [history, setHistory] = useState<any[]>([])

  // Preload with historical data
  useEffect(() => {
    if (isHistoryLoaded && metricsHistory.length > 0 && history.length === 0) {
      let filteredData = metricsHistory
      
      if (filter) {
        filteredData = filteredData.filter(filter)
      }

      const historicalData = filteredData
        .slice(-maxPoints)
        .map(mapper)

      setHistory(historicalData)
    }
  }, [isHistoryLoaded, metricsHistory])

  // Update with real-time data
  useEffect(() => {
    const currentData = dependencyKey.split('.').reduce((obj, key) => obj?.[key], metrics)
    
    if (!currentData) return

    setHistory(prev => {
      const newHistory = [...prev, mapper(metrics)]

      if (newHistory.length > maxPoints) {
        newHistory.shift()
      }

      return newHistory
    })
  }, [metrics])

  return {
    history,
    isLoading: !isHistoryLoaded || history.length === 0,
    isHistoryLoaded
  }
}
