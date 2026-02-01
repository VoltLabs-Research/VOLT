import useClusterMetrics from '@/modules/cluster/presentation/hooks/use-cluster-metrics';
import Container from '@/shared/presentation/components/Container';

import ClusterSelector from '@/modules/cluster/presentation/components/organisms/ClusterSelector';
import ServerTable from '@/modules/cluster/presentation/components/organisms/ServerTable';

import MetricsCards from '@/modules/cluster/presentation/components/molecules/MetricsCards';
import ResponseTimeChart from '@/modules/cluster/presentation/components/molecules/ResponseTimeChart';
import ResourceUsage from '@/modules/cluster/presentation/components/molecules/ResourceUsage';
import TrafficOverview from '@/modules/cluster/presentation/components/molecules/TrafficOverview';
import CpuDistribution from '@/modules/cluster/presentation/components/molecules/CpuDistribution';
import DatabasePerformance from '@/modules/cluster/presentation/components/molecules/DatabasePerformance';
import DiskOperations from '@/modules/cluster/presentation/components/molecules/DiskOperations';

import './ClustersPage.css';

const ClustersPage = () => {
    const {
        metrics,
        clusters,
        selectedClusterId,
        setSelectedClusterId
    } = useClusterMetrics();

    return (
        <Container className='clusters-page vh-max color-primary'>
            <Container className='clusters-main d-flex column gap-2 w-max'>
                <ClusterSelector
                    clusters={clusters}
                    selectedClusterId={selectedClusterId}
                    onClusterChange={setSelectedClusterId}
                />

                <MetricsCards metrics={metrics} />

                <Container className='clusters-grid'>
                    <Container className='clusters-grid-main'>
                        <ResponseTimeChart metrics={metrics} />
                    </Container>
                    <ResourceUsage metrics={metrics} />
                </Container>

                <Container className='clusters-grid'>
                    <Container className='clusters-grid-main'>
                        <TrafficOverview metrics={metrics} />
                    </Container>
                    <CpuDistribution metrics={metrics} />
                </Container>

                <Container className='clusters-grid-equal'>
                    <DatabasePerformance metrics={metrics} />
                    <DiskOperations metrics={metrics} />
                </Container>

                <ServerTable
                    clusters={clusters}
                    selectedClusterId={selectedClusterId}
                />
            </Container>
        </Container>
    );
};

export default ClustersPage;
