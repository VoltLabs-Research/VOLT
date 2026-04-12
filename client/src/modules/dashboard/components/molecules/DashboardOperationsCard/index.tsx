import './DashboardOperationsCard.css';
import DashboardCard from '@/modules/dashboard/components/atoms/DashboardCard';
import DashboardTabs from '@/modules/dashboard/components/molecules/DashboardTabs';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import { getClusterLiveMetricsStatus } from '@/modules/cluster/utilities/cluster-live-metrics-status';
import { formatNetworkSpeed } from '@/modules/cluster/utilities/format-network';
import { resolveClusterMetricId } from '@/modules/cluster/utilities/resolve-cluster-metric-id';
import StatusCounts from '@/modules/canvas/components/molecules/StatusCounts';
import useJobStatusCounts from '@/modules/canvas/hooks/use-job-status-counts';
import JobsHistoryViewer from '@/modules/jobs/components/organisms/JobsHistoryViewer';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Loader from '@/shared/presentation/components/Loader';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import { ArrowDown, ArrowUp, Clock3, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { useMemo, useState } from 'react';
import { HiOutlineServerStack } from 'react-icons/hi2';
import type { TeamClusterRole } from '@/modules/cluster/api/entities/team-cluster';
import type { ReactNode } from 'react';

type DashboardOperationsTabId = 'clusters' | 'compute-jobs';

interface ClusterSummaryMetricProps {
    icon: ReactNode;
    label: string;
    value: string;
}

const DASHBOARD_OPERATIONS_TABS: Array<{ id: DashboardOperationsTabId; label: string }> = [
    { id: 'clusters', label: 'Clusters' },
    { id: 'compute-jobs', label: 'Compute Jobs' }
];

const ROLE_LABELS: Record<TeamClusterRole, string> = {
    cluster: 'Hybrid cluster',
    'compute-node': 'Compute node',
    'storage-server': 'Storage server'
};

const ROLE_PRIORITY: Record<TeamClusterRole, number> = {
    'storage-server': 0,
    'compute-node': 1,
    cluster: 2
};

const formatClusterLatency = (value: number | null): string | null => {
    if (value === null || !Number.isFinite(value)) {
        return null;
    }

    return `${Math.round(value)} ms`;
};

const getClusterStatusClassName = (variant: 'success' | 'warning' | 'danger' | 'inactive'): string => {
    return `dashboard-operations-cluster-status is-${variant}`;
};

const ClusterSummaryMetric = ({ icon, label, value }: ClusterSummaryMetricProps) => {
    return (
        <span className='dashboard-operations-cluster-metric'>
            <span className='dashboard-operations-cluster-metric-icon'>{icon}</span>
            <span className='dashboard-operations-cluster-metric-label'>{label} {value}</span>
        </span>
    );
};

const DashboardOperationsCard = () => {
    const [activeTab, setActiveTab] = useState<DashboardOperationsTabId>('compute-jobs');
    const selectedTeamId = useSelectedTeamId();
    const teamClustersQuery = useTeamClustersQuery(selectedTeamId ?? '', {
        enabled: Boolean(selectedTeamId)
    });
    const teamClusters = teamClustersQuery.data?.data ?? [];
    const { clusters, isConnected } = useClusterMetrics();
    const jobsStatusCounts = useJobStatusCounts();

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

    const jobsEmptyState = (
        <EmptyState
            icon={<HiOutlineServerStack size={20} />}
            title='No jobs yet'
            description='Start a simulation or analysis to see activity here.'
            className='flex-1 dashboard-operations-jobs-empty-state'
        />
    );

    const headerSummary = activeTab === 'clusters'
        ? (
            <span className='font-size-1 color-muted'>
                {orderedClusters.length} cluster{orderedClusters.length === 1 ? '' : 's'}
                {!isConnected && orderedClusters.length > 0 ? ' · live metrics offline' : ''}
            </span>
        )
        : (
            <StatusCounts
                queued={jobsStatusCounts.queued}
                running={jobsStatusCounts.running}
                completed={jobsStatusCounts.completed}
            />
        );

    const renderClusters = (): ReactNode => {
        if (teamClustersQuery.isLoading && teamClusters.length === 0) {
            return (
                <Container className='dashboard-operations-panel d-flex flex-center'>
                    <Loader scale={0.4} />
                </Container>
            );
        }

        if (teamClustersQuery.error && teamClusters.length === 0) {
            const errorMessage = teamClustersQuery.error instanceof Error
                ? teamClustersQuery.error.message
                : 'We could not load the team clusters right now.';

            return (
                <RecoveryState
                    title='Unable to load clusters'
                    description={errorMessage}
                    tone={RecoveryStateTone.Error}
                    className='dashboard-card-state'
                />
            );
        }

        if (!orderedClusters.length) {
            return (
                <RecoveryState
                    title='No clusters connected yet'
                    description='Connect a storage server or compute node to monitor runtime health and live workload activity here.'
                    tone={RecoveryStateTone.Info}
                    className='dashboard-card-state'
                />
            );
        }

        return (
            <Container className='dashboard-operations-panel dashboard-operations-cluster-list y-auto d-flex column'>
                {orderedClusters.map((teamCluster) => {
                    const liveMetrics = metricsByClusterId.get(teamCluster._id) ?? null;
                    const liveMetricsStatus = getClusterLiveMetricsStatus({
                        metrics: liveMetrics,
                        isMetricsConnected: isConnected
                    });
                    const latencyLabel = formatClusterLatency(liveMetrics?.responseTimes.self ?? null);
                    const networkIncomingLabel = liveMetrics ? formatNetworkSpeed(liveMetrics.network.incoming) : null;
                    const networkOutgoingLabel = liveMetrics ? formatNetworkSpeed(liveMetrics.network.outgoing) : null;

                    return (
                        <Container key={teamCluster._id} className='dashboard-operations-cluster-item d-flex column'>
                            <Container className='dashboard-operations-cluster-head d-flex items-center content-between gap-1'>
                                <Container className='d-flex column gap-025 min-w-0'>
                                    <span className='font-size-2 color-primary font-weight-6 text-truncate'>
                                        {teamCluster.name}
                                    </span>
                                    <span className='font-size-1 color-muted'>
                                        {ROLE_LABELS[teamCluster.roleConfig.effectiveRole]}
                                    </span>
                                </Container>

                                <span className={getClusterStatusClassName(liveMetricsStatus.variant)}>
                                    {liveMetricsStatus.label}
                                </span>
                            </Container>

                            {liveMetrics
                                ? (
                                    <>
                                        <Container className='dashboard-operations-cluster-metrics-row'>
                                            <ClusterSummaryMetric
                                                icon={<Cpu size={12} strokeWidth={1.8} />}
                                                label='CPU'
                                                value={`${Math.round(liveMetrics.cpu.usage)}% · ${liveMetrics.cpu.cores} cores`}
                                            />
                                            <ClusterSummaryMetric
                                                icon={<MemoryStick size={12} strokeWidth={1.8} />}
                                                label='MEM'
                                                value={`${liveMetrics.memory.used.toFixed(1)} / ${liveMetrics.memory.total.toFixed(1)} GB`}
                                            />
                                            <ClusterSummaryMetric
                                                icon={<HardDrive size={12} strokeWidth={1.8} />}
                                                label='DISK'
                                                value={`${liveMetrics.disk.used.toFixed(1)} / ${liveMetrics.disk.total.toFixed(1)} GB`}
                                            />
                                        </Container>

                                        <Container className='dashboard-operations-cluster-footer d-flex items-center gap-075'>
                                            <span className='dashboard-operations-cluster-footer-item'>
                                                <ArrowDown size={12} strokeWidth={1.8} />
                                                {networkIncomingLabel}
                                            </span>
                                            <span className='dashboard-operations-cluster-footer-item'>
                                                <ArrowUp size={12} strokeWidth={1.8} />
                                                {networkOutgoingLabel}
                                            </span>
                                            {latencyLabel && (
                                                <span className='dashboard-operations-cluster-footer-item'>
                                                    <Clock3 size={12} strokeWidth={1.8} />
                                                    {latencyLabel}
                                                </span>
                                            )}
                                        </Container>
                                    </>
                                )
                                : (
                                    <span className='font-size-1 color-muted dashboard-operations-cluster-unavailable'>
                                        {liveMetricsStatus.label}
                                    </span>
                                )}
                        </Container>
                    );
                })}
            </Container>
        );
    };

    const renderJobs = (): ReactNode => {
        return (
            <Container className='dashboard-operations-panel d-flex column flex-1 min-h-0'>
                <JobsHistoryViewer
                    variant='embedded'
                    displayMode='full'
                    hideAfterComplete={false}
                    emptyState={jobsEmptyState}
                />
            </Container>
        );
    };

    return (
        <DashboardCard className='dashboard-operations-card d-flex column' overflowHidden={true}>
            <Container className='dashboard-tabbed-card-header'>
                <DashboardTabs
                    tabs={DASHBOARD_OPERATIONS_TABS}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    ariaLabel='Dashboard operations views'
                />

                {headerSummary}
            </Container>

            {activeTab === 'clusters' ? renderClusters() : renderJobs()}
        </DashboardCard>
    );
};

export default DashboardOperationsCard;
