import { MetricsCards } from '@/components/metrics-cards'
import { ResponseTimeChart } from '@/components/response-time-chart'
import { ResourceUsage } from '@/components/resource-usage'
import { ServerTable } from '@/components/server-table'
import { TrafficOverview } from '@/components/traffic-overview'
import { CpuDistribution } from '@/components/cpu-distribution'
import { DiskOperations } from '@/components/disk-operations'
import { DatabasePerformance } from '@/components/database-performance'
import './Clusters.css'

export default function DashboardPage() {
  return (
    <div className="clusters-page">
      <main className="clusters-main">
          <MetricsCards />

          <div className="clusters-chart-grid">
            <div className="clusters-chart-main">
              <ResponseTimeChart />
            </div>
            <div>
              <ResourceUsage />
            </div>
          </div>

          <div className="clusters-chart-grid-2">
            <div className="clusters-chart-wide">
              <TrafficOverview />
            </div>
            <div className="clusters-chart-small">
              <CpuDistribution />
            </div>
          </div>

          <div className="clusters-chart-grid-3">
            <div className="clusters-chart-half">
              <DatabasePerformance />
            </div>
            <div className="clusters-chart-half">
              <DiskOperations />
            </div>
          </div>

          <div className="clusters-table-section">
            <ServerTable />
          </div>
        </main>
    </div>
  )
}
