import { AlertCircle, MoreVertical } from 'lucide-react'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'
import { Skeleton } from '@mui/material'
import './resource-usage.css'

function getLoadColor(value: number): string {
  if (value >= 80) return '#FF453A' // Rojo - Sobrecarga
  if (value >= 60) return '#FF9F0A' // Naranja - Moderado
  return '#32D74B' // Verde - Normal
}

function getLoadGlow(value: number): string {
  if (value >= 80) return '0 0 20px rgba(255, 69, 58, 0.4)'
  if (value >= 60) return '0 0 20px rgba(255, 159, 10, 0.4)'
  return '0 0 20px rgba(50, 215, 75, 0.4)'
}

export function ResourceUsage() {
  const { metrics, isHistoryLoaded } = useServerMetrics()

  const isLoading = !metrics || !isHistoryLoaded

  const resources = metrics ? [
    { 
      name: 'CPU Load', 
      value: metrics.cpu.coresUsage && metrics.cpu.coresUsage.length > 0
        ? Math.round(metrics.cpu.coresUsage.reduce((sum, val) => sum + val, 0) / metrics.cpu.coresUsage.length)
        : Math.round(metrics.cpu.usage),
    },
    { 
      name: 'Memory', 
      value: Math.round(metrics.memory.usagePercent), 
    },
    { 
      name: 'Disk I/O', 
      value: Math.min(100, Math.round((metrics.diskOperations?.read || 0) / 3)), 
    },
    { 
      name: 'Network TX', 
      value: Math.min(100, Math.round((metrics.network.outgoing / 1024) * 10)), 
    },
  ] : [
    { name: 'CPU Load', value: 0 },
    { name: 'Memory', value: 0 },
    { name: 'Disk I/O', value: 0 },
    { name: 'Network TX', value: 0 },
  ]

  return (
    <div className="resource-usage">
      <div className="resource-usage-header">
        <h3 className="resource-usage-title">Resource Usage (Real-time)</h3>
        <button className="resource-usage-menu">
          <MoreVertical className="resource-usage-icon" />
        </button>
      </div>

      {isLoading ? (
        <div className="resource-usage-list">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="resource-usage-item">
              <div className="resource-usage-item-header">
                <Skeleton variant="text" width={80} height={20} />
                <Skeleton variant="text" width={40} height={20} />
              </div>
              <Skeleton variant="rectangular" width="100%" height={8} sx={{ borderRadius: '4px', marginTop: '8px' }} />
            </div>
          ))}
        </div>
      ) : (
      <div className="resource-usage-list">
        {resources.map((resource) => {
          const color = getLoadColor(resource.value)
          const glow = getLoadGlow(resource.value)
          const filledSegments = Math.floor((resource.value / 100) * 40)
          
          return (
            <div key={resource.name} className="resource-usage-item">
              <div className="resource-usage-item-header">
                <span className="resource-usage-item-label">{resource.name}</span>
                <span 
                  className="resource-usage-item-value"
                  style={{ color }}
                >
                  {resource.value}%
                </span>
              </div>
              <div className="resource-usage-bar">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div
                    key={i}
                    className="resource-usage-bar-segment"
                    style={{
                      backgroundColor: i < filledSegments ? color : 'transparent',
                      boxShadow: i < filledSegments && i === filledSegments - 1 ? glow : 'none',
                      opacity: i < filledSegments ? 1 : 0.3,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}
