import { useState } from 'react'
import { usePageTitle } from '@/hooks/core/use-page-title'
import { MetricsCards } from '@/components/molecules/common/MetricsCards'
import { ResponseTimeChart } from '@/features/clusters/components/molecules/ResponseTimeChart'
import { ResourceUsage } from '@/features/clusters/components/molecules/ResourceUsage'
import { TrafficOverview } from '@/features/clusters/components/molecules/TrafficOverview'
import { CpuDistribution } from '@/features/clusters/components/molecules/CpuDistribution'
import { DiskOperations } from '@/features/clusters/components/molecules/DiskOperations'
import { DatabasePerformance } from '@/features/clusters/components/molecules/DatabasePerformance'
import { ServerTable } from '@/features/clusters/components/organisms/ServerTable'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'
import Container from '@/components/primitives/Container'
import Button from '@/components/primitives/Button'
import { ChevronDown } from 'lucide-react'
import '@/features/clusters/pages/protected/Clusters/Clusters.css'

export default function DashboardPage() {
  const {
    metrics,
    clusters,
    selectedClusterId,
    setSelectedClusterId,
    isHistoryLoaded
  } = useServerMetrics()

  usePageTitle('Clusters')

  return (
    <Container className="clusters-page vh-max color-primary">
      <Container className="clusters-main d-flex column gap-2 w-max">

        {/* Cluster Selector Header */}
        <Container className="d-flex items-center content-between mb-1">
          <div className="font-weight-6 font-size-3">Cluster Metrics</div>
          <div className="d-flex items-center gap-1">
            <span className="font-size-2 color-muted-foreground">Viewing Cluster:</span>
            <select
              value={selectedClusterId}
              onChange={(e) => setSelectedClusterId(e.target.value)}
              className="cluster-selector-input font-size-2 color-primary cursor-pointer"
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                minWidth: '200px'
              }}
            >
              {clusters.map((c) => (
                <option key={c.clusterId} value={c.clusterId}>
                  {c.clusterId} ({c.analysisCount || 0} analyzes)
                </option>
              ))}
              {!clusters.length && <option value="main-cluster">Main Cluster</option>}
            </select>
          </div>
        </Container>

        <MetricsCards metrics={metrics} />

        <Container className="clusters-grid">
          <Container className="clusters-grid-main">
            <ResponseTimeChart metrics={metrics} />
          </Container>
          <ResourceUsage metrics={metrics} />
        </Container>

        <Container className="clusters-grid">
          <Container className="clusters-grid-main">
            <TrafficOverview metrics={metrics} />
          </Container>
          <CpuDistribution metrics={metrics} />
        </Container>

        <Container className="clusters-grid-equal">
          <DatabasePerformance metrics={metrics} />
          <DiskOperations metrics={metrics} />
        </Container>

        <ServerTable clusters={clusters} selectedClusterId={selectedClusterId} />
      </Container>
    </Container>
  )
}
