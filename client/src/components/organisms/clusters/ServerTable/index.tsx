import { useMemo } from 'react'
import { ChevronDown, RefreshCw, Download } from 'lucide-react'
import { Skeleton } from '@mui/material'
import { formatNetworkSpeed } from '@/utilities/network'
import Container from '@/components/primitives/Container'
import Button from '@/components/primitives/Button'
import './ServerTable.css'
import Title from '@/components/primitives/Title'

interface ServerTableProps {
  clusters: any[];
  selectedClusterId: string;
}

export function ServerTable({ clusters, selectedClusterId }: ServerTableProps) {

  const isLoading = !clusters
  // If we want to show ALL clusters, we map over `clusters` prop.
  // The logic inside `server` memo was transforming a single metric object into a table row format.
  // We need to adapt it to handle an array of clusters metrics.

  const activeClusters = useMemo(() => {
    if (!clusters || !clusters.length) return []

    return clusters.map(metrics => {
      // Calculate real CPU usage from cores
      const cpuUsage = metrics.cpu.coresUsage && metrics.cpu.coresUsage.length > 0
        ? Math.round(metrics.cpu.coresUsage.reduce((sum: number, val: number) => sum + val, 0) / metrics.cpu.coresUsage.length)
        : Math.round(metrics.cpu.usage)

      // Calculate uptime in days, hours, minutes
      const uptimeSeconds = metrics.uptime;
      const uptimeDays = Math.floor(uptimeSeconds / 86400);
      const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
      const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

      return {
        id: metrics.clusterId || metrics.serverId, // Use clusterId or fallback
        status: metrics.status,
        statusColor: metrics.status === 'Healthy' ? 'text-emerald-500' : metrics.status === 'Warning' ? 'text-amber-500' : 'text-red-500',
        cpu: cpuUsage,
        memory: Math.round(metrics.memory.usagePercent),
        disk: Math.round(metrics.disk.free),
        diskUsed: Math.round(metrics.disk.used),
        diskUsagePercent: Math.round(metrics.disk.usagePercent),
        network: formatNetworkSpeed(metrics.network.incoming + metrics.network.outgoing),
        uptime: uptimeDays > 0 ? `${uptimeDays}d ${uptimeHours}h` : `${uptimeHours}h ${uptimeMinutes}m`,
        analysisCount: metrics.analysisCount || 0
      }
    })
  }, [clusters])

  return (
    <>
      <Container className="server-table-container">
        <Container className="d-flex items-center content-between server-table-header mb-1-5">
          <Container className="d-flex items-center gap-075">
            <Container className="server-table-title-bar" />
            <Title className='font-size-3 server-table-title font-weight-6'>Server Summary</Title>
          </Container>
          <Container className="d-flex items-center gap-05">
            <Button variant='ghost' intent='neutral' size='sm' rightIcon={<ChevronDown className="server-table-icon-sm" />}>
              Status
            </Button>
            <Button variant='ghost' intent='neutral' size='sm' rightIcon={<ChevronDown className="server-table-icon-sm" />}>
              Sort
            </Button>
            <Button variant='ghost' intent='neutral' iconOnly size='sm'>
              <RefreshCw className="server-table-icon" />
            </Button>
            <Button variant='ghost' intent='neutral' iconOnly size='sm'>
              <Download className="server-table-icon" />
            </Button>
          </Container>
        </Container>

        <Container className="server-table-wrapper">
          <table className="server-table w-max">
            <thead>
              <tr>
                <th>Server ID</th>
                <th>Status</th>
                <th>CPU</th>
                <th>Memory</th>
                <th>Disk</th>
                <th>Network</th>
                <th>Computed Analyzes</th>
                <th>Uptime</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8}>
                    <Container className="d-flex column gap-1" style={{ padding: '40px' }}>
                      {[...Array(1)].map((_, i) => (
                        <Container key={i} className="d-flex items-center" style={{ gap: '16px' }}>
                          <Skeleton variant="text" width={100} height={20} />
                          <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: '4px' }} />
                          <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: '12px' }} />
                          <Skeleton variant="text" width={60} height={20} />
                          <Skeleton variant="text" width={60} height={20} />
                          <Skeleton variant="text" width={60} height={20} />
                          <Skeleton variant="text" width={80} height={20} />
                          <Skeleton variant="text" width={60} height={20} />
                        </Container>
                      ))}
                    </Container>
                  </td>
                </tr>
              ) : activeClusters.map((server) => (
                <tr
                  key={server.id}
                  style={{
                    cursor: 'pointer',
                    background: server.id === selectedClusterId ? 'var(--bg-tertiary)' : undefined
                  }}
                >
                  <td>
                    <Container className="d-flex items-center gap-05">
                      <Container className="server-table-status-dot" />
                      <span className="server-table-id font-size-2">{server.id}</span>
                    </Container>
                  </td>
                  <td>
                    <span className={`server-table-status ${server.statusColor === 'text-emerald-500' ? 'server-table-status-healthy' : server.statusColor === 'text-red-500' ? 'server-table-status-critical' : 'server-table-status-warning'} font-size-2 font-weight-5`}>{server.status}</span>
                  </td>
                  <td>
                    <Container className="d-flex items-center gap-05">
                      <Container className="d-flex gap-01">
                        {[...Array(5)].map((_, i) => (
                          <Container
                            key={i}
                            className={`server-table-bar ${i < Math.floor(server.cpu / 20) ? 'server-table-bar-active' : ''}`}
                          />
                        ))}
                      </Container>
                      <span className="server-table-metric-value font-size-1 color-muted-foreground">{server.cpu}%</span>
                    </Container>
                  </td>
                  <td>
                    <Container className="d-flex items-center gap-05">
                      <Container className="d-flex gap-01">
                        {[...Array(5)].map((_, i) => (
                          <Container
                            key={i}
                            className={`server-table-bar ${i < Math.floor(server.memory / 20) ? 'server-table-bar-active' : ''}`}
                          />
                        ))}
                      </Container>
                      <span className="server-table-metric-value font-size-1 color-muted-foreground">{server.memory}%</span>
                    </Container>
                  </td>
                  <td>
                    <Container className="d-flex items-center gap-05">
                      <Container className="d-flex gap-01">
                        {[...Array(5)].map((_, i) => (
                          <Container
                            key={i}
                            className={`server-table-bar ${i < Math.floor(server.diskUsagePercent / 20) ? 'server-table-bar-active' : ''}`}
                          />
                        ))}
                      </Container>
                      <span className="server-table-metric-value font-size-1 color-muted-foreground">{server.disk.toFixed(1)}GB Available</span>
                    </Container>
                  </td>
                  <td>
                    <span className="server-table-network font-size-2">{server.network}</span>
                  </td>
                  <td>
                    <span className="server-table-network font-size-2">{server.analysisCount}</span>
                  </td>
                  <td>
                    <span className="server-table-uptime font-size-2 font-weight-5">{server.uptime}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Container>
      </Container>
    </>
  )
}
