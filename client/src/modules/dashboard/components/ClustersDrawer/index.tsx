import Loader from '@/shared/ui/components/Loader';
import { CloseButton } from '@heroui/react';
import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import { resolveClusterMetricId } from '@/modules/cluster/utils/resolve-cluster-metric-id';
import ClusterMetricsCard from '@/modules/dashboard/components/ClustersDrawer/ClusterMetricsCard';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { useDashboardSidePanelStore } from '@/modules/dashboard/store/use-side-panel-store';
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
    const close = useDashboardSidePanelStore((state) => state.close);

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
        <div className='flex items-center justify-center min-h-0 flex-1'>
            <Loader size='md' aria-label='Loading clusters' />
        </div>
    );

    const clustersEmptyState = (
        <RecoveryState
            title='No clusters connected yet'
            description='Connect a storage server or compute node to monitor runtime health and live workload activity here.'
            tone={RecoveryStateTone.Info}
            className='min-h-full'
        />
    );

    const renderClustersError = (err: unknown): ReactNode => (
        <RecoveryState
            title='Unable to load clusters'
            description={err instanceof Error ? err.message : 'We could not load the team clusters right now.'}
            tone={RecoveryStateTone.Error}
            className='min-h-full'
        />
    );

    const hasBlockingError = clusterManagement.error && teamClusters.length === 0;
    const isBlockingLoading = clusterManagement.isLoading && teamClusters.length === 0;

    let clustersContent: ReactNode = (
        <div className='flex flex-col min-h-0 flex-1 overflow-y-auto gap-3'>
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

    const description = `${orderedClusters.length} cluster${orderedClusters.length === 1 ? '' : 's'}${!isConnected && orderedClusters.length > 0 ? ' · live metrics offline' : ''}`;

    return (
        <div className='flex h-full min-h-0 flex-col'>
            <header className='flex items-start justify-between gap-2 px-4 pt-4 pb-3'>
                <div className='flex min-w-0 flex-col gap-0.5'>
                    <h2 className='text-sm font-semibold text-foreground'>Clusters</h2>
                    <p className='truncate text-xs text-muted'>{description}</p>
                </div>
                <CloseButton onPress={close} aria-label='Close clusters panel' />
            </header>
            <div className='flex h-full min-h-0 flex-col px-3 pb-3'>
                {clustersContent}
            </div>
        </div>
    );
};

export default ClustersDrawer;
