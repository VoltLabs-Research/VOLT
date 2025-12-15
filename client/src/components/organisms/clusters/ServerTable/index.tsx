import { useState, useMemo } from 'react'
import { ChevronDown, RefreshCw, Download } from 'lucide-react'
import { ServerDetails } from '../ServerDetails'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'
import { Skeleton } from '@mui/material'
import { formatNetworkSpeed } from '@/utilities/network'
import './ServerTable.css'

export function ServerTable() {
  const { metrics, isHistoryLoaded } = useServerMetrics()
  const [selectedServer, setSelectedServer] = useState<any | null>(null)

  const isLoading = !metrics || !isHistoryLoaded

  const server = useMemo(() => {
    if (!metrics) return null

    // Calculate real CPU usage from cores
    const cpuUsage = metrics.cpu.coresUsage && metrics.cpu.coresUsage.length > 0
      ? Math.round(metrics.cpu.coresUsage.reduce((sum, val) => sum + val, 0) / metrics.cpu.coresUsage.length)
      : Math.round(metrics.cpu.usage)

    // Calculate uptime in days, hours, minutes
    const uptimeSeconds = metrics.uptime;
    const uptimeDays = Math.floor(uptimeSeconds / 86400);
    const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

    return {
      id: 'backend-01',
      region: 'US',
      status: metrics.status,
      statusColor: metrics.status === 'Healthy' ? 'text-emerald-500' : metrics.status === 'Warning' ? 'text-amber-500' : 'text-red-500',
      cpu: cpuUsage,
      memory: Math.round(metrics.memory.usagePercent),
      disk: Math.round(metrics.disk.free),
      diskUsed: Math.round(metrics.disk.used),
      diskUsagePercent: Math.round(metrics.disk.usagePercent),
      network: formatNetworkSpeed(metrics.network.incoming + metrics.network.outgoing),
      uptime: uptimeDays > 0 ? `${uptimeDays}d ${uptimeHours}h` : `${uptimeHours}h ${uptimeMinutes}m`,
      metrics // Pass full metrics for details modal
    }
  }, [metrics])

  return (
    <>
      {selectedServer && (
        <ServerDetails server={selectedServer} onClose={() => setSelectedServer(null)} />
      )}
      <div className="server-table-container">
        <div className="server-table-header">
          <div className="server-table-title-group">
            <div className="server-table-bar" />
            <h3 className="server-table-title">Server Summary</h3>
          </div>
          <div className="server-table-actions">
            <button className="server-table-btn">
              Region
              <ChevronDown className="server-table-icon-sm" />
            </button>
            <button className="server-table-btn">
              Status
              <ChevronDown className="server-table-icon-sm" />
            </button>
            <button className="server-table-btn">
              Sort
              <ChevronDown className="server-table-icon-sm" />
            </button>
            <button className="server-table-icon-btn">
              <RefreshCw className="server-table-icon" />
            </button>
            <button className="server-table-icon-btn">
              <Download className="server-table-icon" />
            </button>
          </div>
        </div>

        <div className="server-table-wrapper">
          <table className="server-table">
            <thead>
              <tr>
                <th>Server ID</th>
                <th>Region</th>
                <th>Status</th>
                <th>CPU</th>
                <th>Memory</th>
                <th>Disk</th>
                <th>Network</th>
                <th>Uptime</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8}>
                    <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {[...Array(1)].map((_, i) => (
                        <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                          <Skeleton variant="text" width={100} height={20} />
                          <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: '4px' }} />
                          <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: '12px' }} />
                          <Skeleton variant="text" width={60} height={20} />
                          <Skeleton variant="text" width={60} height={20} />
                          <Skeleton variant="text" width={60} height={20} />
                          <Skeleton variant="text" width={80} height={20} />
                          <Skeleton variant="text" width={60} height={20} />
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ) : server && (
                <tr key={server.id} onClick={() => setSelectedServer(server)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className="server-table-cell-id">
                      <div className="server-table-status-dot" />
                      <span className="server-table-id">{server.id}</span>
                    </div>
                  </td>
                  <td>
                    <span className="server-table-region-badge">{server.region}</span>
                  </td>
                  <td>
                    <span className={`server-table-status ${server.statusColor === 'text-emerald-500' ? 'server-table-status-healthy' : server.statusColor === 'text-red-500' ? 'server-table-status-critical' : 'server-table-status-warning'}`}>{server.status}</span>
                  </td>
                  <td>
                    <div className="server-table-metric">
                      <div className="server-table-bar-group">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`server-table-bar ${i < Math.floor(server.cpu / 20) ? 'server-table-bar-active' : ''}`}
                          />
                        ))}
                      </div>
                      <span className="server-table-metric-value">{server.cpu}%</span>
                    </div>
                  </td>
                  <td>
                    <div className="server-table-metric">
                      <div className="server-table-bar-group">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`server-table-bar ${i < Math.floor(server.memory / 20) ? 'server-table-bar-active' : ''}`}
                          />
                        ))}
                      </div>
                      <span className="server-table-metric-value">{server.memory}%</span>
                    </div>
                  </td>
                  <td>
                    <div className="server-table-metric">
                      <div className="server-table-bar-group">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`server-table-bar ${i < Math.floor(server.diskUsagePercent / 20) ? 'server-table-bar-active' : ''}`}
                          />
                        ))}
                      </div>
                      <span className="server-table-metric-value">{server.disk.toFixed(1)}GB Available</span>
                    </div>
                  </td>
                  <td>
                    <span className="server-table-network">{server.network}</span>
                  </td>
                  <td>
                    <span className="server-table-uptime">{server.uptime}</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
