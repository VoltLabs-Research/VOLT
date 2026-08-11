import { ToggleButton, ToggleButtonGroup, cn } from '@heroui/react';
import { getClusterLiveMetricsStatus } from '@/modules/cluster/utils/cluster-live-metrics-status';
import { formatNetworkSpeed } from '@/modules/cluster/utils/format-network';
import { useState } from 'react';
import type { ClusterLiveMetricsVariant } from '@/modules/cluster/utils/cluster-live-metrics-status';
import type { ClusterMetrics, TeamCluster, TeamClusterRole } from '@volt/contracts/modules/cluster/domain';
import type { Key } from 'react';

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

const CLUSTER_METRIC_TAB_IDS: ReadonlySet<string> = new Set(CLUSTER_METRIC_TABS.map((tab) => tab.id));

const isClusterMetricTabId = (value: string): value is ClusterMetricTabId => CLUSTER_METRIC_TAB_IDS.has(value);

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
            className='grid grid-cols-[64px_1fr_40px] items-center gap-3 min-w-0'
            role='group'
            aria-label={title}
            title={title}
        >
            <span className='text-[0.8125rem] font-medium text-muted'>{label}</span>
            <div
                className='h-[5px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--muted)_18%,transparent)]'
                role='progressbar'
                aria-valuenow={Math.round(clamped)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={label}
            >
                <div
                    className={cn('h-full rounded-[inherit] [transition:width_0.4s_cubic-bezier(0.32,0.72,0,1),background-color_0.15s_ease]', isCritical ? 'bg-danger' : 'bg-muted')}
                    style={{ width: `${clamped}%` }}
                />
            </div>
            <span className={cn('text-[0.8125rem] font-medium text-right tabular-nums', isCritical ? 'text-danger' : 'text-muted')}>
                {Math.round(clamped)}%
            </span>
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
            <span className='pl-[calc(64px+0.75rem)] text-xs text-muted tabular-nums'>
                {detail}
            </span>
        </>
    );
};

const ClusterMetricsCard = ({ teamCluster, liveMetrics, isMetricsConnected }: ClusterMetricsCardProps) => {
    const [activeMetric, setActiveMetric] = useState<ClusterMetricTabId>('cpu');
    const statusBadgeTones: Record<ClusterLiveMetricsVariant, string> = {
        success: 'text-success',
        warning: 'text-warning',
        danger: 'text-danger',
        inactive: 'text-muted'
    };
    const liveMetricsStatus = getClusterLiveMetricsStatus({
        metrics: liveMetrics,
        isMetricsConnected
    });

    const handleMetricChange = (keys: Set<Key>) => {
        for (const key of keys) {
            if (typeof key === 'string' && isClusterMetricTabId(key)) {
                setActiveMetric(key);
                return;
            }
        }
    };

    return (
        <div className='flex flex-col gap-[0.875rem] rounded-2xl border border-border bg-surface-secondary px-[1.125rem] py-4 transition-[border-color,box-shadow] duration-150 ease-[ease] hover:shadow-[0_0_0_1px_var(--border)]'>
            <div className='flex flex-row items-center justify-between gap-4 min-w-0'>
                <div className='flex flex-col gap-1 min-w-0'>
                    <span className='text-sm font-semibold text-foreground truncate'>
                        {teamCluster.name}
                    </span>
                    <span className='text-xs text-muted'>
                        {CLUSTER_ROLE_LABELS[teamCluster.roleConfig.effectiveRole]}
                    </span>
                </div>
                <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium uppercase', statusBadgeTones[liveMetricsStatus.variant])}>
                    {liveMetricsStatus.label}
                </span>
            </div>

            {liveMetrics === null
                ? (
                    <span className='text-xs text-muted leading-[1.4]'>
                        {liveMetricsStatus.label}
                    </span>
                )
                : (
                    <>
                        <ToggleButtonGroup
                            size='sm'
                            selectionMode='single'
                            disallowEmptySelection
                            selectedKeys={[activeMetric]}
                            onSelectionChange={handleMetricChange}
                            aria-label={`${teamCluster.name} metrics view`}
                        >
                            {CLUSTER_METRIC_TABS.map((tab) => (
                                <ToggleButton key={tab.id} id={tab.id}>
                                    {tab.label}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                        <div className='flex flex-col mt-3 gap-2'>
                            {activeMetric === 'cpu' && (
                                <>
                                    <ClusterProgressMetric
                                        label='CPU'
                                        percent={liveMetrics.cpu.usage}
                                        detail={`${liveMetrics.cpu.cores} cores`}
                                    />
                                    <span className='pl-[calc(64px+0.75rem)] text-xs text-muted tabular-nums'>
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
                                <div className='flex flex-col gap-1.5' role='group' aria-label='Network activity'>
                                    <div className='flex items-center justify-between gap-3 tabular-nums'>
                                        <span className='text-[0.8125rem] font-medium text-muted'>Incoming</span>
                                        <span className='text-[0.8125rem] text-foreground tabular-nums whitespace-nowrap'>
                                            <span aria-hidden='true'>↓</span> {formatNetworkSpeed(liveMetrics.network.incoming)}
                                        </span>
                                    </div>
                                    <div className='flex items-center justify-between gap-3 tabular-nums'>
                                        <span className='text-[0.8125rem] font-medium text-muted'>Outgoing</span>
                                        <span className='text-[0.8125rem] text-foreground tabular-nums whitespace-nowrap'>
                                            <span aria-hidden='true'>↑</span> {formatNetworkSpeed(liveMetrics.network.outgoing)}
                                        </span>
                                    </div>
                                    <span className='mt-0.5 text-xs text-muted tabular-nums'>
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
