import { useMemo } from 'react';
import useClusterMetrics from '@/modules/cluster/presentation/hooks/use-cluster-metrics';
import Container from '@/shared/presentation/components/Container';
import NetworkChart from '@/shared/presentation/components/NetworkChart';

import ClusterSelector from '@/modules/cluster/presentation/components/organisms/ClusterSelector';
import ServerTable from '@/modules/cluster/presentation/components/organisms/ServerTable';

import MetricsCards from '@/modules/cluster/presentation/components/molecules/MetricsCards';
import ResponseTimeChart from '@/modules/cluster/presentation/components/molecules/ResponseTimeChart';
import ResourceUsage from '@/modules/cluster/presentation/components/molecules/ResourceUsage';
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
                        <ResponseTimeChart metrics={metrics} />
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
