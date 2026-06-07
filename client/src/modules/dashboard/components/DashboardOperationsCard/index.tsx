import './DashboardOperationsCard.css';
import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import { AsyncBoundary, Box, Loader, Row, SegmentedTabs, Stack, StatusBadge, Text } from '@voltstack/bravais';
import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import { getClusterLiveMetricsStatus } from '@/modules/cluster/utilities/cluster-live-metrics-status';
import { formatNetworkSpeed } from '@/modules/cluster/utilities/format-network';
import { resolveClusterMetricId } from '@/modules/cluster/utilities/resolve-cluster-metric-id';
import StatusCounts from '@/modules/canvas/components/StatusCounts';
import useJobStatusCounts from '@/modules/canvas/hooks/use-job-status-counts';
import JobsHistoryViewer from '@/modules/jobs/components/JobsHistoryViewer';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import { useCallback, useMemo, useState } from 'react';
import type { TeamClusterRole } from '@/modules/cluster/api/entities/team-cluster';
import type { ReactNode } from 'react';

type DashboardOperationsTabId = 'clusters' | 'compute-jobs';
type ClusterMetricTabId = 'cpu' | 'memory' | 'disk' | 'network';

interface ClusterProgressMetricProps {
    label: string;
    percent: number;
    detail?: string;
}

interface ClusterNetworkMetricProps {
    incomingLabel: string | null;
    outgoingLabel: string | null;
    latencyLabel: string | null;
}

const CRITICAL_THRESHOLD = 85;

const clampPercent = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 100) return 100;
    return value;
};

const DASHBOARD_OPERATIONS_TABS: Array<{ id: DashboardOperationsTabId; label: string }> = [
    { id: 'clusters', label: 'Clusters' },
    { id: 'compute-jobs', label: 'Compute Jobs' }
];

const CLUSTER_METRIC_TABS: ReadonlyArray<{ id: ClusterMetricTabId; label: string }> = [
    { id: 'cpu', label: 'CPU' },
    { id: 'memory', label: 'Memory' },
    { id: 'disk', label: 'Disk' },
    { id: 'network', label: 'Network' }
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

const ClusterProgressMetric = ({ label, percent, detail }: ClusterProgressMetricProps) => {
    const clamped = clampPercent(percent);
    const isCritical = clamped >= CRITICAL_THRESHOLD;
    const title = detail ? `${label} · ${clamped.toFixed(0)}% · ${detail}` : `${label} · ${clamped.toFixed(0)}%`;

    return (
        <div
            className={`dashboard-operations-cluster-metric ${isCritical ? 'is-critical' : ''}`}
            role='group'
            aria-label={title}
            title={title}
        >
            <span className='dashboard-operations-cluster-metric-label'>{label}</span>
            <div
                className='dashboard-operations-cluster-metric-track'
                role='progressbar'
                aria-valuenow={Math.round(clamped)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={label}
            >
                <div
                    className='dashboard-operations-cluster-metric-fill'
                    style={{ width: `${clamped}%` }}
                />
            </div>
            <span className='dashboard-operations-cluster-metric-value'>{Math.round(clamped)}%</span>
        </div>
    );
};

const ClusterNetworkMetric = ({ incomingLabel, outgoingLabel, latencyLabel }: ClusterNetworkMetricProps) => {
    return (
        <div className='dashboard-operations-cluster-network' role='group' aria-label='Network activity'>
            <div className='dashboard-operations-cluster-network-row'>
                <span className='dashboard-operations-cluster-network-label'>Incoming</span>
                <span className='dashboard-operations-cluster-network-value'>
                    <span aria-hidden='true'>↓</span> {incomingLabel ?? '—'}
                </span>
            </div>
            <div className='dashboard-operations-cluster-network-row'>
                <span className='dashboard-operations-cluster-network-label'>Outgoing</span>
                <span className='dashboard-operations-cluster-network-value'>
                    <span aria-hidden='true'>↑</span> {outgoingLabel ?? '—'}
                </span>
            </div>
            {latencyLabel && (
                <span className='dashboard-operations-cluster-network-latency'>
                    Latency · {latencyLabel}
                </span>
            )}
        </div>
    );
};

const DashboardOperationsCard = () => {
    const [activeTab, setActiveTab] = useState<DashboardOperationsTabId>('compute-jobs');
    const [activeMetricByClusterId, setActiveMetricByClusterId] = useState<Record<string, ClusterMetricTabId>>({});
    const clusterManagement = useClusterManagement();
    const teamClusters = clusterManagement.clusters;
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

    const setClusterMetricTab = useCallback((clusterId: string, metricTab: ClusterMetricTabId) => {
        setActiveMetricByClusterId((previous) => ({ ...previous, [clusterId]: metricTab }));
    }, []);

    const headerSummary = activeTab === 'clusters'
        ? (
            <Text size='sm' tone='muted'>
                {orderedClusters.length} cluster{orderedClusters.length === 1 ? '' : 's'}
                {!isConnected && orderedClusters.length > 0 ? ' · live metrics offline' : ''}
            </Text>
        )
        : (
            <StatusCounts
                queued={jobsStatusCounts.queued}
                running={jobsStatusCounts.running}
                completed={jobsStatusCounts.completed}
            />
        );

    const clustersLoadingState = (
        <Box display='flex' className='dashboard-operations-panel flex-center'>
            <Loader scale={0.4} />
        </Box>
    );

    const clustersEmptyState = (
        <RecoveryState
            title='No clusters connected yet'
            description='Connect a storage server or compute node to monitor runtime health and live workload activity here.'
            tone={RecoveryStateTone.Info}
            className='dashboard-card-state'
        />
    );

    const renderClustersError = (err: unknown): ReactNode => {
        const errorMessage = err instanceof Error
            ? err.message
            : 'We could not load the team clusters right now.';

        return (
            <RecoveryState
                title='Unable to load clusters'
                description={errorMessage}
                tone={RecoveryStateTone.Error}
                className='dashboard-card-state'
            />
        );
    };

    const renderClustersList = (): ReactNode => {
        return (
            <Stack overflow='y-auto' className='dashboard-operations-panel dashboard-operations-cluster-list'>
                {orderedClusters.map((teamCluster) => {
                    const liveMetrics = metricsByClusterId.get(teamCluster._id) ?? null;
                    const liveMetricsStatus = getClusterLiveMetricsStatus({
                        metrics: liveMetrics,
                        isMetricsConnected: isConnected
                    });
                    const latencyLabel = formatClusterLatency(liveMetrics?.responseTimes.self ?? null);
                    const networkIncomingLabel = liveMetrics ? formatNetworkSpeed(liveMetrics.network.incoming) : null;
                    const networkOutgoingLabel = liveMetrics ? formatNetworkSpeed(liveMetrics.network.outgoing) : null;
                    const activeMetric = activeMetricByClusterId[teamCluster._id] ?? 'cpu';

                    const memoryPercent = liveMetrics && liveMetrics.memory.total > 0
                        ? (liveMetrics.memory.used / liveMetrics.memory.total) * 100
                        : 0;
                    const diskPercent = liveMetrics && liveMetrics.disk.total > 0
                        ? (liveMetrics.disk.used / liveMetrics.disk.total) * 100
                        : 0;

                    const memoryDetail = liveMetrics
                        ? `${liveMetrics.memory.used.toFixed(1)} / ${liveMetrics.memory.total.toFixed(1)} GB`
                        : undefined;
                    const diskDetail = liveMetrics
                        ? `${liveMetrics.disk.used.toFixed(1)} / ${liveMetrics.disk.total.toFixed(1)} GB`
                        : undefined;

                    return (
                        <Stack key={teamCluster._id} className='dashboard-operations-cluster-item'>
                            <Row justify='between' gap='1' className='dashboard-operations-cluster-head'>
                                <Stack gap='025' minW='0'>
                                    <Text size='md' tone='primary' weight='bold' truncate>
                                        {teamCluster.name}
                                    </Text>
                                    <Text size='sm' tone='muted'>
                                        {ROLE_LABELS[teamCluster.roleConfig.effectiveRole]}
                                    </Text>
                                </Stack>

                                <StatusBadge variant={liveMetricsStatus.variant} size='compact'>
                                    {liveMetricsStatus.label}
                                </StatusBadge>
                            </Row>

                            {liveMetrics
                                ? (
                                    <>
                                        <SegmentedTabs
                                            tabs={CLUSTER_METRIC_TABS}
                                            activeTab={activeMetric}
                                            onChange={(id) => setClusterMetricTab(teamCluster._id, id)}
                                            ariaLabel={`${teamCluster.name} metrics view`}
                                            layoutId={teamCluster._id}
                                            size='sm'
                                        />

                                        <Stack className='dashboard-operations-cluster-tab-panel'>
                                            {activeMetric === 'cpu' && (
                                                <>
                                                    <ClusterProgressMetric
                                                        label='CPU'
                                                        percent={liveMetrics.cpu.usage}
                                                        detail={`${liveMetrics.cpu.cores} cores`}
                                                    />
                                                    <span className='dashboard-operations-cluster-tab-subtitle'>
                                                        {liveMetrics.cpu.cores} cores
                                                    </span>
                                                </>
                                            )}

                                            {activeMetric === 'memory' && (
                                                <>
                                                    <ClusterProgressMetric
                                                        label='Memory'
                                                        percent={memoryPercent}
                                                        detail={memoryDetail}
                                                    />
                                                    {memoryDetail && (
                                                        <span className='dashboard-operations-cluster-tab-subtitle'>
                                                            {memoryDetail}
                                                        </span>
                                                    )}
                                                </>
                                            )}

                                            {activeMetric === 'disk' && (
                                                <>
                                                    <ClusterProgressMetric
                                                        label='Disk'
                                                        percent={diskPercent}
                                                        detail={diskDetail}
                                                    />
                                                    {diskDetail && (
                                                        <span className='dashboard-operations-cluster-tab-subtitle'>
                                                            {diskDetail}
                                                        </span>
                                                    )}
                                                </>
                                            )}

                                            {activeMetric === 'network' && (
                                                <ClusterNetworkMetric
                                                    incomingLabel={networkIncomingLabel}
                                                    outgoingLabel={networkOutgoingLabel}
                                                    latencyLabel={latencyLabel}
                                                />
                                            )}
                                        </Stack>
                                    </>
                                )
                                : (
                                    <Text size='sm' tone='muted' className='dashboard-operations-cluster-unavailable'>
                                        {liveMetricsStatus.label}
                                    </Text>
                                )}
                        </Stack>
                    );
                })}
            </Stack>
        );
    };

    const renderJobs = (): ReactNode => {
        return (
            <Stack flex='1' minH='0' className='dashboard-operations-panel'>
                <JobsHistoryViewer
                    displayMode='full'
                    groupStatusPresentation='trajectory-name'
                />
            </Stack>
        );
    };

    return (
        <DashboardCard className='dashboard-operations-card d-flex column' overflowHidden={true}>
            <Box className='dashboard-tabbed-card-header'>
                <SegmentedTabs
                    tabs={DASHBOARD_OPERATIONS_TABS}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    ariaLabel='Dashboard operations views'
                />

                {headerSummary}
            </Box>

            {activeTab === 'clusters' ? (
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
                    {renderClustersList()}
                </AsyncBoundary>
            ) : renderJobs()}
        </DashboardCard>
    );
};

export default DashboardOperationsCard;
