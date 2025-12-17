import { MetricsCards } from '@/components/molecules/common/MetricsCards'
import { ResponseTimeChart } from '@/components/molecules/clusters/ResponseTimeChart'
import { ResourceUsage } from '@/components/molecules/clusters/ResourceUsage'
import { TrafficOverview } from '@/components/molecules/clusters/TrafficOverview'
import { CpuDistribution } from '@/components/molecules/clusters/CpuDistribution'
import { DiskOperations } from '@/components/molecules/clusters/DiskOperations'
import { DatabasePerformance } from '@/components/molecules/clusters/DatabasePerformance'
import { ServerTable } from '@/components/organisms/clusters/ServerTable'
import Container from '@/components/primitives/Container'
import './Clusters.css'

export default function DashboardPage() {
  return (
    <Container className="clusters-page vh-max">
      <Container className="clusters-main d-flex column gap-2 w-max">
        <MetricsCards />

        <Container className="clusters-grid">
          <Container className="clusters-grid-main">
            <ResponseTimeChart />
          </Container>
          <ResourceUsage />
        </Container>

        <Container className="clusters-grid">
          <Container className="clusters-grid-main">
            <TrafficOverview />
          </Container>
          <CpuDistribution />
        </Container>

        <Container className="clusters-grid-equal">
          <DatabasePerformance />
          <DiskOperations />
        </Container>

        <ServerTable />
      </Container>
    </Container>
  )
}
