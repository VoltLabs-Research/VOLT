import { MetricsCards } from '@/components/molecules/MetricsCards'
import { ResponseTimeChart } from '@/components/molecules/ResponseTimeChart'
import { ResourceUsage } from '@/components/molecules/ResourceUsage'
import { ServerTable } from '@/components/organisms/ServerTable'
import { TrafficOverview } from '@/components/molecules/TrafficOverview'
import { CpuDistribution } from '@/components/molecules/CpuDistribution'
import { DiskOperations } from '@/components/molecules/DiskOperations'
import { DatabasePerformance } from '@/components/molecules/DatabasePerformance'
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
