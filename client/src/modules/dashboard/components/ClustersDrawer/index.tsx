import './ClustersDrawer.css';
import { AsyncBoundary, Loader, Modal } from '@voltstack/bravais';
import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import { resolveClusterMetricId } from '@/modules/cluster/utils/resolve-cluster-metric-id';
import ClusterMetricsCard from '@/modules/dashboard/components/ClustersDrawer/ClusterMetricsCard';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { DASHBOARD_DRAWER_IDS } from '@/modules/dashboard/store/use-jobs-drawer-store';
import { useMemo } from 'react';
import type { TeamClusterRole } from '@volt/contracts/modules/cluster/domain';
import type { ReactNode } from 'react';

const ROLE_PRIORITY: Record<TeamClusterRole, number> = {
    'storage-server': 0,
    'compute-node': 1,
    cluster: 2
};

const ClustersDrawer = () => {
    const clusterManagement = useClusterManagement();
    const teamClusters = clusterManagement.clusters;
    const { clusters, isConnected } = useClusterMetrics();

    const orderedClusters = useMemo(() => {
        return [...teamClusters].sort((left, right) => {
            const roleDiff = ROLE_PRIORITY[left.roleConfig.effectiveRole] - ROLE_PRIORITY[right.roleConfig.effectiveRole];
            if (roleDiff !== 0) {
                return roleDiff;
            }

            return left.name.localeCompare(right.name);
        });
    }, [teamClusters]);

    const metricsByClusterId = useMemo(() => {
        return new Map(clusters.map((cluster) => [resolveClusterMetricId(cluster), cluster]));
    }, [clusters]);

    const clustersLoadingState = (
        <div className='flex dashboard-operations-panel items-center justify-center'>
            <Loader scale={0.4} />
        </div>
    );

    const clustersEmptyState = (
        <RecoveryState
            title='No clusters connected yet'
            description='Connect a storage server or compute node to monitor runtime health and live workload activity here.'
            tone={RecoveryStateTone.Info}
            className='dashboard-card-state'
        />
    );

    const renderClustersError = (err: unknown): ReactNode => (
        <RecoveryState
            title='Unable to load clusters'
            description={err instanceof Error ? err.message : 'We could not load the team clusters right now.'}
            tone={RecoveryStateTone.Error}
            className='dashboard-card-state'
        />
    );

    return (
        <Modal
            id={DASHBOARD_DRAWER_IDS.clusters}
            placement='right'
            title='Clusters'
            description={`${orderedClusters.length} cluster${orderedClusters.length === 1 ? '' : 's'}${!isConnected && orderedClusters.length > 0 ? ' · live metrics offline' : ''}`}
            lazyMount
        >
            <div className='dashboard-clusters-drawer'>
                <AsyncBoundary
                    state={{
                        loading: clusterManagement.isLoading && teamClusters.length === 0,
                        error: clusterManagement.error && teamClusters.length === 0 ? clusterManagement.error : undefined,
                        empty: orderedClusters.length === 0
                    }}
                    loading={clustersLoadingState}
                    error={renderClustersError}
                    empty={clustersEmptyState}
                >
                    <div className='flex flex-col overflow-y-auto dashboard-operations-panel dashboard-operations-cluster-list'>
                        {orderedClusters.map((teamCluster) => (
                            <ClusterMetricsCard
                                key={teamCluster._id}
                                teamCluster={teamCluster}
                                liveMetrics={metricsByClusterId.get(teamCluster._id) ?? null}
                                isMetricsConnected={isConnected}
                            />
                        ))}
                    </div>
                </AsyncBoundary>
            </div>
        </Modal>
    );
};

export default ClustersDrawer;
