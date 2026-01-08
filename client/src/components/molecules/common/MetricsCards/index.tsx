import { Server, Cpu, MemoryStick, Activity, TrendingUp, TrendingDown, MoreVertical } from 'lucide-react'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'
import { Skeleton } from '@mui/material'
import { formatNetworkSpeedWithUnit } from '@/utilities/common/network'
import Container from '@/components/primitives/Container'
import Button from '@/components/primitives/Button'
import Tooltip from '@/components/atoms/common/Tooltip'
import './MetricsCards.css'

interface MetricsCardsProps {
  metrics: any;
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
  // const { metrics, isHistoryLoaded } = useServerMetrics()
  // We rely on parent to pass loaded metrics. If null, we show loading.

  const isLoading = !metrics

  if (isLoading) {
    return (
      <Container className="metrics-cards gap-1">
        {[...Array(4)].map((_, i) => (
          <Container key={i} className="metric-card">
            <Container className="d-flex items-start content-between" style={{ marginBottom: '0.75rem' }}>
              <Container className="d-flex items-center gap-05">
                <Skeleton variant="circular" width={16} height={16} />
                <Skeleton variant="text" width={120} height={20} />
              </Container>
              <Skeleton variant="circular" width={16} height={16} />
            </Container>
            <Container className="d-flex column gap-05">
              <Skeleton variant="rectangular" width={100} height={48} sx={{ borderRadius: '4px' }} />
              <Container className="d-flex items-center content-between">
                <Skeleton variant="text" width={100} height={16} />
                <Skeleton variant="text" width={80} height={16} />
              </Container>
            </Container>
          </Container>
        ))}
      </Container>
    )
  }

  const cards = [
    {
      icon: Server,
      title: 'Active Servers',
      value: '1',
      unit: 'Server',
      trend: metrics?.status === 'Healthy' ? 'Online' : metrics?.status === 'Warning' ? 'Warning' : 'Critical',
      trendUp: metrics?.status === 'Healthy',
      subtitle: metrics?.status || 'Loading...'
    },
    {
      icon: Cpu,
      title: 'CPU Load',
      value: metrics ? (() => {
        if (metrics.cpu.coresUsage && metrics.cpu.coresUsage.length > 0) {
          const avgCoreUsage = metrics.cpu.coresUsage.reduce((sum: number, val: number) => sum + val, 0) / metrics.cpu.coresUsage.length;
          return `${avgCoreUsage.toFixed(1)}%`;
        }
        return `${metrics.cpu.usage.toFixed(1)}%`;
      })() : '--',
      trend: metrics ? `${metrics.cpu.cores} cores` : '--',
      trendUp: metrics ? metrics.cpu.usage < 75 : true,
      subtitle: metrics ? `Load: ${metrics.cpu.loadAvg[0].toFixed(2)}` : 'Loading...'
    },
    {
      icon: MemoryStick,
      title: 'Memory Usage',
      value: metrics ? `${metrics.memory.usagePercent}%` : '--',
      trend: metrics ? `${metrics.memory.used.toFixed(1)}GB / ${metrics.memory.total.toFixed(1)}GB` : '--',
      trendUp: metrics ? metrics.memory.usagePercent < 75 : true,
      subtitle: metrics ? `Free: ${metrics.memory.free.toFixed(1)}GB` : 'Loading...'
    },
    {
      icon: Activity,
      title: 'Network Traffic',
      value: metrics ? formatNetworkSpeedWithUnit(metrics.network.incoming + metrics.network.outgoing).value : '--',
      unit: metrics ? formatNetworkSpeedWithUnit(metrics.network.incoming + metrics.network.outgoing).unit : '',
      trend: metrics ? `↑${formatNetworkSpeedWithUnit(metrics.network.outgoing).value} ↓${formatNetworkSpeedWithUnit(metrics.network.incoming).value} ${formatNetworkSpeedWithUnit(metrics.network.outgoing).unit}` : '--',
      trendUp: true,
      subtitle: 'Total Traffic'
    },
  ]

  return (
    <Container className="metrics-cards gap-1">
      {cards.map((metric) => (
        <Container key={metric.title} className="metric-card">
          <Container className="d-flex items-start content-between" style={{ marginBottom: '0.75rem' }}>
            <Container className="d-flex items-center gap-05">
              <metric.icon className="metric-card-icon color-muted-foreground" />
              <span className="metric-card-title font-size-2 color-muted-foreground color-secondary">{metric.title}</span>
            </Container>
            <Tooltip content="More Options" placement="bottom">
              <Button variant='ghost' intent='neutral' iconOnly size='sm'>
                <MoreVertical className="metric-card-icon color-muted-foreground" />
              </Button>
            </Tooltip>
          </Container>
          <Container className="d-flex column gap-05">
            <Container className="d-flex" style={{ alignItems: 'baseline', gap: '0.5rem' }}>
              <span className="metric-card-value font-size-6 font-weight-6 color-primary">{metric.value}</span>
              {metric.unit && <span className="metric-card-unit font-size-2 font-weight-5 color-muted-foreground color-muted">{metric.unit}</span>}
            </Container>
            <Container className="d-flex items-center content-between">
              <span className="metric-card-subtitle font-size-1 color-muted-foreground color-secondary">{metric.subtitle}</span>
              <span className="d-flex items-center" style={{ fontSize: '0.75rem', gap: '0.25rem', color: metric.trendUp ? 'rgba(52, 199, 89, 1)' : 'rgba(255, 69, 58, 1)' }}>
                {metric.trendUp ? <TrendingUp className="metric-card-trend-icon" /> : <TrendingDown className="metric-card-trend-icon" />}
                {metric.trend}
              </span>
            </Container>
          </Container>
        </Container>
      ))}
    </Container>
  )
}
