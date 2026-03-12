import '@/modules/cluster/components/templates/ClusterMonitoringPage/ClusterMonitoringPage.css';
import ClustersEmptyState from '@/modules/cluster/components/organisms/ClustersEmptyState';
import CpuDistribution from '@/modules/cluster/components/molecules/CpuDistribution';
import DatabasePerformance from '@/modules/cluster/components/molecules/DatabasePerformance';
import DiskOperations from '@/modules/cluster/components/molecules/DiskOperations';
import MetricsCards from '@/modules/cluster/components/molecules/MetricsCards';
import ResourceUsage from '@/modules/cluster/components/molecules/ResourceUsage';
import ResponseTimeChart from '@/modules/cluster/components/molecules/ResponseTimeChart';
import useClusterMonitoringPage from '@/modules/cluster/hooks/use-cluster-monitoring-page';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import NetworkChart from '@/shared/presentation/components/NetworkChart';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import { useMemo } from 'react';

const ClusterMonitoringPage = () => {
    const vm = useClusterMonitoringPage();

    const networkData = useMemo(() => {
        if (!vm.metrics?.network) {
            return null;
        }

        return {
            rx: vm.metrics.network.incoming,
            tx: vm.metrics.network.outgoing
        };
    }, [vm.metrics]);

    return (
        <Container className='clusters-page vh-max color-primary'>
            <Container className='clusters-main d-flex column gap-1-5 w-max'>
                {vm.isLoading && !vm.hasClusters && (
                    <Loader scale={0.5} isFixed={false} />
                )}

                {!vm.isLoading && !vm.hasClusters && <ClustersEmptyState />}

                {vm.hasClusters && !vm.isMetricsConnected && !vm.metrics && (
                    <RecoveryState
                        title='Metrics unavailable'
                        description='Unable to connect to the metrics stream. The cluster may be offline or unreachable.'
                        tone={RecoveryStateTone.Error}
                    />
                )}

                {vm.hasClusters && (
                    <>
                        <MetricsCards metrics={vm.metrics} />

                        <Container className='clusters-grid'>
                            <Container className='clusters-grid-main'>
                                <ResponseTimeChart history={vm.history} metrics={vm.metrics} />
                            </Container>
                            <ResourceUsage metrics={vm.metrics} />
                        </Container>

                        <Container className='clusters-grid'>
                            <Container className='clusters-grid-main'>
                                <NetworkChart
                                    data={networkData}
                                    isLoading={!vm.metrics}
                                    calculateDelta={false}
                                    title='Network Traffic'
                                    height={300}
                                />
                            </Container>
                            <CpuDistribution history={vm.history} metrics={vm.metrics} />
                        </Container>

                        <Container className='clusters-grid-equal'>
                            <DatabasePerformance history={vm.history} metrics={vm.metrics} />
                            <DiskOperations history={vm.history} metrics={vm.metrics} />
                        </Container>
                    </>
                )}
            </Container>
        </Container>
    );
};

export default ClusterMonitoringPage;
