import './ClustersPage.css';
import ClusterCredentialsModal from '@/modules/cluster/components/organisms/ClusterCredentialsModal';
import ClusterSelector from '@/modules/cluster/components/organisms/ClusterSelector';
import ClustersEmptyState from '@/modules/cluster/components/organisms/ClustersEmptyState';
import CpuDistribution from '@/modules/cluster/components/molecules/CpuDistribution';
import DatabasePerformance from '@/modules/cluster/components/molecules/DatabasePerformance';
import DeleteClusterModal from '@/modules/cluster/components/organisms/DeleteClusterModal';
import DiskOperations from '@/modules/cluster/components/molecules/DiskOperations';
import MetricsCards from '@/modules/cluster/components/molecules/MetricsCards';
import ResourceUsage from '@/modules/cluster/components/molecules/ResourceUsage';
import ResponseTimeChart from '@/modules/cluster/components/molecules/ResponseTimeChart';
import ServerTable from '@/modules/cluster/components/organisms/ServerTable';
import useClustersPage from '@/modules/cluster/components/templates/ClustersPage/use-clusters-page';
import Container from '@/shared/presentation/components/Container';
import NetworkChart from '@/shared/presentation/components/NetworkChart';
import { openModal } from '@/shared/presentation/components/Modal';
import { CLUSTER_CREDENTIALS_MODAL_ID } from '@/modules/cluster/components/organisms/ClusterCredentialsModal';
import { DELETE_CLUSTER_MODAL_ID } from '@/modules/cluster/components/organisms/DeleteClusterModal';
import { useMemo, useCallback } from 'react';

const ClustersPage = () => {
    const vm = useClustersPage();

    const networkData = useMemo(() => {
        if (!vm.metrics?.network) {
            return null;
        }

        return {
            rx: vm.metrics.network.incoming,
            tx: vm.metrics.network.outgoing
        };
    }, [vm.metrics]);

    const hasClusters = vm.clusters.length > 0;

    const findClusterById = useCallback((clusterId: string) => {
        return vm.clusters.find((c) => c._id === clusterId) ?? null;
    }, [vm.clusters]);

    const handleRevealCredentials = useCallback((clusterId: string) => {
        const cluster = findClusterById(clusterId);
        if (!cluster) return;
        vm.setCredentialsCluster(cluster);
        openModal(CLUSTER_CREDENTIALS_MODAL_ID);
    }, [findClusterById, vm.setCredentialsCluster]);

    const handleDeleteCluster = useCallback((clusterId: string) => {
        const cluster = findClusterById(clusterId);
        if (!cluster) return;
        vm.setDeleteTarget(cluster);
        openModal(DELETE_CLUSTER_MODAL_ID);
    }, [findClusterById, vm.setDeleteTarget]);

    return (
        <Container className='clusters-page vh-max color-primary'>
            <Container className='clusters-main d-flex column gap-1-5 w-max'>
                <ClusterCredentialsModal
                    teamCluster={vm.credentialsCluster}
                    credentials={vm.credentials}
                    onReveal={vm.revealCredentials}
                />
                <DeleteClusterModal
                    teamCluster={vm.deleteTarget}
                    onDelete={vm.deleteCluster}
                    onClose={() => vm.setDeleteTarget(null)}
                />

                {!hasClusters && <ClustersEmptyState />}

                {hasClusters && (
                    <>
                        <ClusterSelector
                            clusters={vm.clusters}
                            selectedClusterId={vm.selectedClusterId}
                            onClusterChange={vm.setSelectedClusterId}
                        />

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

                        <ServerTable
                            clusters={vm.clusters}
                            metricsByClusterId={vm.metricsByClusterId}
                            selectedClusterId={vm.selectedClusterId}
                            onSelectCluster={vm.setSelectedClusterId}
                            onRevealCredentials={handleRevealCredentials}
                            onDeleteCluster={handleDeleteCluster}
                        />
                    </>
                )}
            </Container>
        </Container>
    );
};

export default ClustersPage;
