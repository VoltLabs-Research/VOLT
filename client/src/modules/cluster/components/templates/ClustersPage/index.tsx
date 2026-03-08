import './ClustersPage.css';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import ClusterSelector from '@/modules/cluster/components/organisms/ClusterSelector';
import CpuDistribution from '@/modules/cluster/components/molecules/CpuDistribution';
import DatabasePerformance from '@/modules/cluster/components/molecules/DatabasePerformance';
import DiskOperations from '@/modules/cluster/components/molecules/DiskOperations';
import MetricsCards from '@/modules/cluster/components/molecules/MetricsCards';
import ResourceUsage from '@/modules/cluster/components/molecules/ResourceUsage';
import ResponseTimeChart from '@/modules/cluster/components/molecules/ResponseTimeChart';
import ServerTable from '@/modules/cluster/components/organisms/ServerTable';
import Container from '@/shared/presentation/components/Container';
import NetworkChart from '@/shared/presentation/components/NetworkChart';
import { useMemo } from 'react';

const ClustersPage = () => {
    const {
        metrics,
        clusters,
        history,
        selectedClusterId,
        setSelectedClusterId
    } = useClusterMetrics();

    const networkData = useMemo(() => {
        if(!metrics?.network) return null;
        return {
            rx: metrics.network.incoming,
            tx: metrics.network.outgoing
        };
    }, [metrics?.network]);

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
                        <ResponseTimeChart history={history} metrics={metrics} />
                      </Container>
                      <ResourceUsage metrics={metrics} />
                 </Container>

                <Container className='clusters-grid'>
                    <Container className='clusters-grid-main'>
                        <NetworkChart 
                            data={networkData} 
                            isLoading={!metrics}
                            calculateDelta={false}
                            title='Network Traffic'
                            height={300}
                        />
                    </Container>
                    <CpuDistribution history={history} metrics={metrics} />
                </Container>

                <Container className='clusters-grid-equal'>
                    <DatabasePerformance history={history} metrics={metrics} />
                    <DiskOperations history={history} metrics={metrics} />
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
