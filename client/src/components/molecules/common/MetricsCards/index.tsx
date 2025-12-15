import { Server, Cpu, MemoryStick, Activity, TrendingUp, TrendingDown, MoreVertical } from 'lucide-react'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'
import { Skeleton } from '@mui/material'
import { formatNetworkSpeedWithUnit } from '@/utilities/network'
import './MetricsCards.css'


export function MetricsCards() {
  const { metrics, isHistoryLoaded } = useServerMetrics()

  const isLoading = !metrics || !isHistoryLoaded

  if (isLoading) {
    return (
      <div className="metrics-cards">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="metric-card">
            <div className="metric-card-header">
              <div className="metric-card-title-group">
                <Skeleton variant="circular" width={16} height={16} />
                <Skeleton variant="text" width={120} height={20} />
              </div>
              <Skeleton variant="circular" width={16} height={16} />
            </div>
            <div className="metric-card-body">
              <Skeleton variant="rectangular" width={100} height={48} sx={{ borderRadius: '4px' }} />
              <div className="metric-card-footer" style={{ marginTop: '12px' }}>
                <Skeleton variant="text" width={100} height={16} />
                <Skeleton variant="text" width={80} height={16} />
              </div>
            </div>
          </div>
        ))}
      </div>
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
          const avgCoreUsage = metrics.cpu.coresUsage.reduce((sum, val) => sum + val, 0) / metrics.cpu.coresUsage.length;
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
    <div className="metrics-cards">
      {cards.map((metric) => (
        <div key={metric.title} className="metric-card">
          <div className="metric-card-header">
            <div className="metric-card-title-group">
              <metric.icon className="metric-card-icon" />
              <span className="metric-card-title">{metric.title}</span>
            </div>
            <button className="metric-card-menu">
              <MoreVertical className="metric-card-icon" />
            </button>
          </div>
          <div className="metric-card-body">
            <div className="metric-card-value-group">
              <span className="metric-card-value">{metric.value}</span>
              {metric.unit && <span className="metric-card-unit">{metric.unit}</span>}
            </div>
            <div className="metric-card-footer">
              <span className="metric-card-subtitle">{metric.subtitle}</span>
              <span className={`metric-card-trend ${metric.trendUp ? 'metric-card-trend-up' : 'metric-card-trend-down'}`}>
                {metric.trendUp ? <TrendingUp className="metric-card-trend-icon" /> : <TrendingDown className="metric-card-trend-icon" />}
                {metric.trend}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
