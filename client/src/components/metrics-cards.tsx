import { Server, Cpu, MemoryStick, Activity, TrendingUp, TrendingDown, MoreVertical } from 'lucide-react'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'
import './metrics-cards.css'

function formatNetworkSpeed(kbs: number): { value: string; unit: string } {
  if (kbs < 1) {
    return { value: (kbs * 1024).toFixed(0), unit: 'B/s' };
  } else if (kbs < 1024) {
    return { value: kbs.toFixed(1), unit: 'KB/s' };
  } else if (kbs < 1024 * 1024) {
    return { value: (kbs / 1024).toFixed(2), unit: 'MB/s' };
  } else {
    return { value: (kbs / (1024 * 1024)).toFixed(2), unit: 'GB/s' };
  }
}

export function MetricsCards() {
  const { metrics } = useServerMetrics()

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
      value: metrics ? formatNetworkSpeed(metrics.network.incoming + metrics.network.outgoing).value : '--',
      unit: metrics ? formatNetworkSpeed(metrics.network.incoming + metrics.network.outgoing).unit : '',
      trend: metrics ? `↑${formatNetworkSpeed(metrics.network.outgoing).value} ↓${formatNetworkSpeed(metrics.network.incoming).value} ${formatNetworkSpeed(metrics.network.outgoing).unit}` : '--',
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
