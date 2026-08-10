import { SegmentedTabs, StatusBadge } from '@voltstack/bravais';
import { getClusterLiveMetricsStatus } from '@/modules/cluster/utils/cluster-live-metrics-status';
import { formatNetworkSpeed } from '@/modules/cluster/utils/format-network';
import { useState } from 'react';
import type { ClusterMetrics, TeamCluster, TeamClusterRole } from '@volt/contracts/modules/cluster/domain';

type ClusterMetricTabId = 'cpu' | 'memory' | 'disk' | 'network';

interface ClusterMetricsCardProps {
    teamCluster: TeamCluster;
    liveMetrics: ClusterMetrics | null;
    isMetricsConnected: boolean;
}

interface ClusterProgressMetricProps {
    label: string;
    percent: number;
    detail?: string;
}

interface ClusterUsageMetricProps {
    label: string;
    usage: {
        total: number;
        used: number;
    };
}

const CRITICAL_THRESHOLD = 85;

const CLUSTER_METRIC_TABS: ReadonlyArray<{ id: ClusterMetricTabId; label: string }> = [
    {
        id: 'cpu',
        label: 'CPU'
    },
    {
        id: 'memory',
        label: 'Memory'
    },
    {
        id: 'disk',
        label: 'Disk'
    },
    {
        id: 'network',
        label: 'Network'
    }
];

const CLUSTER_ROLE_LABELS: Record<TeamClusterRole, string> = {
    cluster: 'Hybrid cluster',
    'compute-node': 'Compute node',
    'storage-server': 'Storage server'
};

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

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

const ClusterUsageMetric = ({ label, usage }: ClusterUsageMetricProps) => {
    const detail = `${usage.used.toFixed(1)} / ${usage.total.toFixed(1)} GB`;

    return (
        <>
            <ClusterProgressMetric
                label={label}
                percent={usage.total > 0 ? (usage.used / usage.total) * 100 : 0}
                detail={detail}
            />
            <span className='dashboard-operations-cluster-tab-subtitle'>
                {detail}
            </span>
        </>
    );
};

const ClusterMetricsCard = ({ teamCluster, liveMetrics, isMetricsConnected }: ClusterMetricsCardProps) => {
    const [activeMetric, setActiveMetric] = useState<ClusterMetricTabId>('cpu');
    const liveMetricsStatus = getClusterLiveMetricsStatus({
        metrics: liveMetrics,
        isMetricsConnected
    });

    return (
        <div className='flex flex-col dashboard-operations-cluster-item'>
            <div className='flex flex-row items-center justify-between gap-4 dashboard-operations-cluster-head'>
                <div className='flex flex-col gap-1 min-w-0'>
                    <span className='text-sm font-semibold text-foreground truncate'>
                        {teamCluster.name}
                    </span>
                    <span className='text-xs text-muted'>
                        {CLUSTER_ROLE_LABELS[teamCluster.roleConfig.effectiveRole]}
                    </span>
                </div>

                <StatusBadge variant={liveMetricsStatus.variant} size='compact'>
                    {liveMetricsStatus.label}
                </StatusBadge>
            </div>

            {liveMetrics === null
                ? (
                    <span className='text-xs text-muted dashboard-operations-cluster-unavailable'>
                        {liveMetricsStatus.label}
                    </span>
                )
                : (
                    <>
                        <SegmentedTabs
                            tabs={CLUSTER_METRIC_TABS}
                            activeTab={activeMetric}
                            onChange={setActiveMetric}
                            ariaLabel={`${teamCluster.name} metrics view`}
                            layoutId={teamCluster._id}
                            size='sm'
                        />

                        <div className='flex flex-col dashboard-operations-cluster-tab-panel'>
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
                                <ClusterUsageMetric label='Memory' usage={liveMetrics.memory} />
                            )}

                            {activeMetric === 'disk' && (
                                <ClusterUsageMetric label='Disk' usage={liveMetrics.disk} />
                            )}

                            {activeMetric === 'network' && (
                                <div className='dashboard-operations-cluster-network' role='group' aria-label='Network activity'>
                                    <div className='dashboard-operations-cluster-network-row'>
                                        <span className='dashboard-operations-cluster-network-label'>Incoming</span>
                                        <span className='dashboard-operations-cluster-network-value'>
                                            <span aria-hidden='true'>↓</span> {formatNetworkSpeed(liveMetrics.network.incoming)}
                                        </span>
                                    </div>
                                    <div className='dashboard-operations-cluster-network-row'>
                                        <span className='dashboard-operations-cluster-network-label'>Outgoing</span>
                                        <span className='dashboard-operations-cluster-network-value'>
                                            <span aria-hidden='true'>↑</span> {formatNetworkSpeed(liveMetrics.network.outgoing)}
                                        </span>
                                    </div>
                                    <span className='dashboard-operations-cluster-network-latency'>
                                        Latency · {Math.round(liveMetrics.responseTimes.self)} ms
                                    </span>
                                </div>
                            )}
                        </div>
                    </>
                )}
        </div>
    );
};

export default ClusterMetricsCard;
