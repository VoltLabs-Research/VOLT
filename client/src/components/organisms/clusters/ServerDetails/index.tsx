import { X, Server } from 'lucide-react'
import './ServerDetails.css'
import Title from '@/components/primitives/Title'
import Paragraph from '@/components/primitives/Paragraph'

interface ServerDetailsProps {
  server: {
    id: string
    region: string
    status: string
    cpu: number
    memory: number
    disk: number
    network: string
    uptime: string
    metrics?: any
  } | null
  onClose: () => void
}

export function ServerDetails({ server, onClose }: ServerDetailsProps) {
  if (!server) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Healthy': return '#30D158'
      case 'Warning': return '#FF9F0A'
      case 'Critical': return '#FF453A'
      default: return 'rgba(255,255,255,0.6)'
    }
  }

  const metrics = server.metrics

  // Get OS info from metrics
  const osInfo = metrics ? {
    platform: 'Linux',
    arch: 'x86_64',
    cpuCores: metrics.cpu.cores,
    totalMemory: (metrics.memory.total / (1024 ** 3)).toFixed(2), // Convert to GB
    usedMemory: (metrics.memory.used / (1024 ** 3)).toFixed(2),
    totalDisk: (metrics.disk.total / (1024 ** 3)).toFixed(2),
    usedDisk: (metrics.disk.used / (1024 ** 3)).toFixed(2),
    freeDisk: (metrics.disk.free / (1024 ** 3)).toFixed(2),
  } : {
    platform: 'Linux',
    arch: 'x86_64',
    cpuCores: 8,
    totalMemory: '64.00',
    usedMemory: '32.00',
    totalDisk: '500.00',
    usedDisk: '250.00',
    freeDisk: '250.00',
  }

  return (
    <div className="server-details-overlay" onClick={onClose}>
      <div className="server-details-panel" onClick={(e) => e.stopPropagation()}>
        <div className="server-details-header">
          <div className="server-details-header-left">
            <Server className="server-details-header-icon" />
            <div>
              <Title className='font-size-4 server-details-title'>{server.id}</Title>
              <Paragraph className='server-details-subtitle'>
                {osInfo.platform} {osInfo.arch}
              </Paragraph>
            </div>
          </div>
          <div className="server-details-header-right">
            <div className="server-details-badges">
              <span className="server-details-badge">{server.region}</span>
              <span className="server-details-badge" style={{
                background: getStatusColor(server.status) + '20',
                borderColor: getStatusColor(server.status) + '40',
                color: getStatusColor(server.status)
              }}>
                {server.status}
              </span>
            </div>
            <button className="server-details-close" onClick={onClose}>
              <X />
            </button>
          </div>
        </div>

        <div className="server-details-tabs">
          <button className="server-details-tab server-details-tab-active">Server Info</button>
        </div>

        <div className="server-details-content">
          <div className="server-details-section">
            <Title className='font-size-3 server-details-section-title'>Summary</Title>
            <div className="server-details-grid-3">
              <div className="server-details-info-card">
                <span className="server-details-info-label">Name</span>
                <span className="server-details-info-value">{server.id}</span>
              </div>
              <div className="server-details-info-card">
                <span className="server-details-info-label">Platform</span>
                <span className="server-details-info-value">{osInfo.platform}</span>
              </div>
              <div className="server-details-info-card">
                <span className="server-details-info-label">Architecture</span>
                <span className="server-details-info-value">{osInfo.arch}</span>
              </div>
              <div className="server-details-info-card">
                <span className="server-details-info-label">CPU Cores</span>
                <span className="server-details-info-value">{osInfo.cpuCores} Cores</span>
              </div>
              <div className="server-details-info-card">
                <span className="server-details-info-label">CPU Usage</span>
                <span className="server-details-info-value">{server.cpu}%</span>
              </div>
              <div className="server-details-info-card">
                <span className="server-details-info-label">Memory</span>
                <span className="server-details-info-value">{osInfo.usedMemory}GB / {osInfo.totalMemory}GB({server.memory}%)</span>
              </div>
              <div className="server-details-info-card">
                <span className="server-details-info-label">Disk</span>
                <span className="server-details-info-value">{osInfo.freeDisk}GB Available</span>
              </div>
              <div className="server-details-info-card">
                <span className="server-details-info-label">Network</span>
                <span className="server-details-info-value">{server.network}</span>
              </div>
              <div className="server-details-info-card">
                <span className="server-details-info-label">Uptime</span>
                <span className="server-details-info-value">{server.uptime}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
