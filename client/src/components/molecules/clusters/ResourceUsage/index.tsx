import { AlertCircle, MoreVertical } from 'lucide-react'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'
import { Skeleton } from '@mui/material'
import './ResourceUsage.css'
import Title from '@/components/primitives/Title';
import Button from '@/components/primitives/Button';

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

// Inverted logic for Available Space (100% = good, 0% = bad)
function getAvailableSpaceColor(value: number): string {
  if (value <= 20) return '#FF453A' // Rojo - Poco espacio
  if (value <= 40) return '#FF9F0A' // Naranja - Moderado
  return '#32D74B' // Verde - Buen espacio
}

function getAvailableSpaceGlow(value: number): string {
  if (value <= 20) return '0 0 20px rgba(255, 69, 58, 0.4)'
  if (value <= 40) return '0 0 20px rgba(255, 159, 10, 0.4)'
  return '0 0 20px rgba(50, 215, 75, 0.4)'
}

interface ResourceUsageProps {
  metrics: any;
}

export function ResourceUsage({ metrics }: ResourceUsageProps) {
  // const { metrics, isHistoryLoaded } = useServerMetrics()

  const isLoading = !metrics

  const resources = metrics ? [
    {
      name: 'CPU Load',
      value: metrics.cpu.coresUsage && metrics.cpu.coresUsage.length > 0
        ? Math.round(metrics.cpu.coresUsage.reduce((sum: number, val: number) => sum + val, 0) / metrics.cpu.coresUsage.length)
        : Math.round(metrics.cpu.usage),
    },
    {
      name: 'Memory',
      value: Math.round(metrics.memory.usagePercent),
    },
    {
      name: 'Available Space',
      value: Math.max(0, 100 - metrics.disk.usagePercent),
    },
    {
      name: 'Network TX',
      value: Math.min(100, Math.round((metrics.network.outgoing / 1024) * 10)),
    },
  ] : [
    { name: 'CPU Load', value: 0 },
    { name: 'Memory', value: 0 },
    { name: 'Available Space', value: 0 },
    { name: 'Network TX', value: 0 },
  ]

  return (
    <div className="d-flex column resource-usage h-max p-1-5">
      <div className="d-flex items-start content-between resource-usage-header mb-1-5 f-shrink-0">
        <Title className='font-size-3 resource-usage-title font-weight-6 color-primary'>Resource Usage</Title>
        <Button variant='ghost' intent='neutral' iconOnly size='sm'>
          <MoreVertical className="resource-usage-icon color-muted" />
        </Button>
      </div>

      {isLoading ? (
        <div className="d-flex column gap-1-5 resource-usage-list flex-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="resource-usage-item">
              <div className="d-flex items-center content-between resource-usage-item-header">
                <Skeleton variant="text" width={80} height={20} />
                <Skeleton variant="text" width={40} height={20} />
              </div>
              <Skeleton variant="rectangular" width="100%" height={8} sx={{ borderRadius: '4px', marginTop: '8px' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="d-flex column gap-1-5 resource-usage-list flex-1">
          {resources.map((resource) => {
            const isAvailableSpace = resource.name === 'Available Space'
            const color = isAvailableSpace ? getAvailableSpaceColor(resource.value) : getLoadColor(resource.value)
            const glow = isAvailableSpace ? getAvailableSpaceGlow(resource.value) : getLoadGlow(resource.value)
            const filledSegments = Math.floor((resource.value / 100) * 40)

            return (
              <div key={resource.name} className="d-flex column resource-usage-item">
                <div className="d-flex items-center content-between resource-usage-item-header">
                  <span className="resource-usage-item-label font-size-2 font-size-1 color-secondary">{resource.name}</span>
                  <span
                    className="resource-usage-item-value font-size-2 font-weight-6 color-primary"
                    style={{ color }}
                  >
                    {resource.value}%
                  </span>
                </div>
                <div className="d-flex gap-0125 resource-usage-bar overflow-hidden">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div
                      key={i}
                      className="resource-usage-bar-segment h-max flex-1"
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
