import '@/modules/cluster/components/templates/ClusterMonitoringPage/ClusterMonitoringPage.css';
import ClusterActionsPanel from '@/modules/cluster/components/organisms/ClusterActionsPanel';
import ClusterCredentialsModal, { CLUSTER_CREDENTIALS_MODAL_ID } from '@/modules/cluster/components/organisms/ClusterCredentialsModal';
import ClustersEmptyState from '@/modules/cluster/components/organisms/ClustersEmptyState';
import DeleteClusterModal, { DELETE_CLUSTER_MODAL_ID } from '@/modules/cluster/components/organisms/DeleteClusterModal';
import UpdateClusterModal, { UPDATE_CLUSTER_MODAL_ID } from '@/modules/cluster/components/organisms/UpdateClusterModal';
import CpuDistribution from '@/modules/cluster/components/molecules/CpuDistribution';
import DatabasePerformance from '@/modules/cluster/components/molecules/DatabasePerformance';
import DiskOperations from '@/modules/cluster/components/molecules/DiskOperations';
import MetricsCards from '@/modules/cluster/components/molecules/MetricsCards';
import ResourceUsage from '@/modules/cluster/components/molecules/ResourceUsage';
import ResponseTimeChart from '@/modules/cluster/components/molecules/ResponseTimeChart';
import { invalidateAvailableVersionsQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import useClusterMonitoringPage from '@/modules/cluster/hooks/use-cluster-monitoring-page';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import NetworkChart from '@/shared/presentation/components/NetworkChart';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import { openModal } from '@/shared/presentation/components/Modal';
import { useCallback, useMemo } from 'react';

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

    const handleRevealCredentials = useCallback(() => {
        if (!vm.selectedCluster) {
            return;
        }

        vm.setCredentialsCluster(vm.selectedCluster);
        openModal(CLUSTER_CREDENTIALS_MODAL_ID);
    }, [vm]);

    const handleDeleteCluster = useCallback(() => {
        if (!vm.selectedCluster) {
            return;
        }

        vm.setDeleteTarget(vm.selectedCluster);
        openModal(DELETE_CLUSTER_MODAL_ID);
    }, [vm]);

    const handleUpdateCluster = useCallback(() => {
        if (!vm.selectedCluster) {
            return;
        }

        vm.setUpdateTarget(vm.selectedCluster);
        if (vm.selectedTeamId) {
            invalidateAvailableVersionsQuery(vm.selectedTeamId, vm.selectedCluster._id);
        }
        openModal(UPDATE_CLUSTER_MODAL_ID);
    }, [vm]);

    return (
        <>
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
            <UpdateClusterModal
                teamCluster={vm.updateTarget}
                teamId={vm.selectedTeamId}
                onUpdate={vm.requestUpdate}
                onClose={() => vm.setUpdateTarget(null)}
            />
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
                            <ClusterActionsPanel
                                teamCluster={vm.selectedCluster}
                                onRevealCredentials={handleRevealCredentials}
                                onDeleteCluster={handleDeleteCluster}
                                onUpdateCluster={handleUpdateCluster}
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
                        </>
                    )}
                </Container>
            </Container>
        </>
    );
};

export default ClusterMonitoringPage;
