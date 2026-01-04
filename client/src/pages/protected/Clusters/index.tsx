import { useState } from 'react'
import { usePageTitle } from '@/hooks/core/use-page-title'
import { MetricsCards } from '@/components/molecules/common/MetricsCards'
import { ResponseTimeChart } from '@/components/molecules/clusters/ResponseTimeChart'
import { ResourceUsage } from '@/components/molecules/clusters/ResourceUsage'
import { TrafficOverview } from '@/components/molecules/clusters/TrafficOverview'
import { CpuDistribution } from '@/components/molecules/clusters/CpuDistribution'
import { DiskOperations } from '@/components/molecules/clusters/DiskOperations'
import { DatabasePerformance } from '@/components/molecules/clusters/DatabasePerformance'
import { ServerTable } from '@/components/organisms/clusters/ServerTable'
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics'
import Container from '@/components/primitives/Container'
import Button from '@/components/primitives/Button'
import { ChevronDown } from 'lucide-react'
import './Clusters.css'

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
    <Container className="clusters-page vh-max">
      <Container className="clusters-main d-flex column gap-2 w-max">

        {/* Cluster Selector Header */}
        <Container className="d-flex items-center content-between mb-1">
          <div className="font-weight-6 font-size-3">Cluster Metrics</div>
          <div className="d-flex items-center gap-1">
            <span className="font-size-2 color-muted-foreground">Viewing Cluster:</span>
            <select
              value={selectedClusterId}
              onChange={(e) => setSelectedClusterId(e.target.value)}
              className="cluster-selector-input"
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
