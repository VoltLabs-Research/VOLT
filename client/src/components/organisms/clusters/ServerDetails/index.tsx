import { X, Server } from 'lucide-react'
import './ServerDetails.css'
import Title from '@/components/primitives/Title'
import Paragraph from '@/components/primitives/Paragraph'
import Button from '@/components/primitives/Button'

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
    <div className="d-flex items-center content-center server-details-overlay p-fixed" onClick={onClose}>
      <div className="d-flex column server-details-panel overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="d-flex content-between items-center server-details-header">
          <div className="d-flex items-center gap-1 server-details-header-left">
            <Server className="server-details-header-icon" />
            <div>
              <Title className='font-size-4 server-details-title font-weight-6'>{server.id}</Title>
              <Paragraph className='server-details-subtitle font-weight-4'>
                {osInfo.platform} {osInfo.arch}
              </Paragraph>
            </div>
          </div>
          <div className="d-flex items-center gap-1 server-details-header-right">
            <div className="d-flex gap-05 server-details-badges">
              <span className="server-details-badge font-size-1 font-weight-5">{server.region}</span>
              <span className="server-details-badge font-size-1 font-weight-5" style={{
                background: getStatusColor(server.status) + '20',
                borderColor: getStatusColor(server.status) + '40',
                color: getStatusColor(server.status)
              }}>
                {server.status}
              </span>
            </div>
            <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={onClose}>
              <X />
            </Button>
          </div>
        </div>

        <div className="d-flex gap-025 server-details-tabs">
          <Button variant='solid' intent='brand' size='sm'>Server Info</Button>
        </div>

        <div className="server-details-content y-auto flex-1">
          <div className="server-details-section">
            <Title className='d-flex items-center content-between font-size-3 server-details-section-title font-weight-6'>Summary</Title>
            <div className="server-details-grid-3 gap-1">
              <div className="d-flex column server-details-info-card">
                <span className="server-details-info-label font-weight-5">Name</span>
                <span className="server-details-info-value font-weight-5">{server.id}</span>
              </div>
              <div className="server-details-info-card">
                <span className="server-details-info-label font-weight-5">Platform</span>
                <span className="server-details-info-value font-weight-5">{osInfo.platform}</span>
              </div>
              <div className="server-details-info-card">
                <span className="server-details-info-label font-weight-5">Architecture</span>
                <span className="server-details-info-value font-weight-5">{osInfo.arch}</span>
              </div>
              <div className="server-details-info-card">
                <span className="server-details-info-label font-weight-5">CPU Cores</span>
                <span className="server-details-info-value font-weight-5">{osInfo.cpuCores} Cores</span>
              </div>
              <div className="server-details-info-card">
                <span className="server-details-info-label font-weight-5">CPU Usage</span>
                <span className="server-details-info-value font-weight-5">{server.cpu}%</span>
              </div>
              <div className="server-details-info-card">
                <span className="server-details-info-label font-weight-5">Memory</span>
                <span className="server-details-info-value font-weight-5">{osInfo.usedMemory}GB / {osInfo.totalMemory}GB({server.memory}%)</span>
              </div>
              <div className="server-details-info-card">
                <span className="server-details-info-label font-weight-5">Disk</span>
                <span className="server-details-info-value font-weight-5">{osInfo.freeDisk}GB Available</span>
              </div>
              <div className="server-details-info-card">
                <span className="server-details-info-label font-weight-5">Network</span>
                <span className="server-details-info-value font-weight-5">{server.network}</span>
              </div>
              <div className="server-details-info-card">
                <span className="server-details-info-label font-weight-5">Uptime</span>
                <span className="server-details-info-value font-weight-5">{server.uptime}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
