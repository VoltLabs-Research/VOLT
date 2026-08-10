import { Spinner } from '@heroui/react';
import { Modal } from '@/shared/ui/modal';
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

/** `.dashboard-clusters-drawer`. */
const DRAWER = 'flex h-full min-h-0 flex-col p-6';

/** `.dashboard-operations-panel`, and the list that fills it. */
const PANEL = 'min-h-0 flex-1';
const CLUSTER_LIST = 'flex flex-col min-h-0 flex-1 overflow-y-auto gap-2.5 pr-1';

/** `.dashboard-card-state`. */
const CARD_STATE = 'min-h-full';

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

    /*
     * bravais's `Loader` defaulted `isFixed` to TRUE, so `<Loader scale={0.4} />`
     * emitted `fixed inset-0` — a full-viewport overlay centred on the *window*,
     * inside a right-hand drawer, in spite of the centring wrapper written around it.
     * The wrapper is the author's intent; the overlay was a default nobody asked for.
     * This is a deliberate fix rather than a preserved behaviour: the spinner now
     * centres in the panel it is loading.
     */
    const clustersLoadingState = (
        <div className={`flex items-center justify-center ${PANEL}`}>
            <Spinner size='md' aria-label='Loading clusters' />
        </div>
    );

    const clustersEmptyState = (
        <RecoveryState
            title='No clusters connected yet'
            description='Connect a storage server or compute node to monitor runtime health and live workload activity here.'
            tone={RecoveryStateTone.Info}
            className={CARD_STATE}
        />
    );

    const renderClustersError = (err: unknown): ReactNode => (
        <RecoveryState
            title='Unable to load clusters'
            description={err instanceof Error ? err.message : 'We could not load the team clusters right now.'}
            tone={RecoveryStateTone.Error}
            className={CARD_STATE}
        />
    );

    /*
     * bravais's `AsyncBoundary`, inlined — it has no VOLT-owned replacement yet and
     * was only ever a five-way switch. Its precedence is fixed and load-bearing:
     * accessDenied → error → loading → empty → children. An errored request that is
     * also still `isLoading` shows the error, not the spinner, so the order is
     * reproduced exactly rather than rearranged into what reads more naturally.
     */
    const hasBlockingError = clusterManagement.error && teamClusters.length === 0;
    const isBlockingLoading = clusterManagement.isLoading && teamClusters.length === 0;

    let clustersContent: ReactNode = (
        <div className={CLUSTER_LIST}>
            {orderedClusters.map((teamCluster) => (
                <ClusterMetricsCard
                    key={teamCluster._id}
                    teamCluster={teamCluster}
                    liveMetrics={metricsByClusterId.get(teamCluster._id) ?? null}
                    isMetricsConnected={isConnected}
                />
            ))}
        </div>
    );

    if (hasBlockingError) {
        clustersContent = renderClustersError(clusterManagement.error);
    } else if (isBlockingLoading) {
        clustersContent = clustersLoadingState;
    } else if (orderedClusters.length === 0) {
        clustersContent = clustersEmptyState;
    }

    return (
        <Modal
            id={DASHBOARD_DRAWER_IDS.clusters}
            placement='right'
            title='Clusters'
            description={`${orderedClusters.length} cluster${orderedClusters.length === 1 ? '' : 's'}${!isConnected && orderedClusters.length > 0 ? ' · live metrics offline' : ''}`}
            lazyMount
        >
            <div className={DRAWER}>
                {clustersContent}
            </div>
        </Modal>
    );
};

export default ClustersDrawer;
