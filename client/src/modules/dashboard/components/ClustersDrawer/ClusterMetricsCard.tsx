import { getClusterLiveMetricsStatus } from '@/modules/cluster/utils/cluster-live-metrics-status';
import { formatNetworkSpeed } from '@/modules/cluster/utils/format-network';
import { Card, Chip, Label, ProgressBar, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { useState } from 'react';
import type { ClusterLiveMetricsVariant } from '@/modules/cluster/utils/cluster-live-metrics-status';
import type { ChipProps } from '@heroui/react';
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

const STATUS_CHIP_COLORS: Record<ClusterLiveMetricsVariant, ChipProps['color']> = {
    success: 'success',
    warning: 'warning',
    danger: 'danger',
    inactive: 'default'
};

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

const ClusterProgressMetric = ({ label, percent, detail }: ClusterProgressMetricProps) => {
    const clamped = clampPercent(percent);
    const isCritical = clamped >= CRITICAL_THRESHOLD;
    const title = detail ? `${label} · ${clamped.toFixed(0)}% · ${detail}` : `${label} · ${clamped.toFixed(0)}%`;

    return (
        <div className='flex min-w-0 flex-col gap-1' role='group' aria-label={title} title={title}>
            <ProgressBar
                aria-label={label}
                value={Math.round(clamped)}
                color={isCritical ? 'danger' : 'default'}
                size='sm'
            >
                <Label>{label}</Label>
                <ProgressBar.Output>{`${Math.round(clamped)}%`}</ProgressBar.Output>
                <ProgressBar.Track>
                    <ProgressBar.Fill style={{ width: `${clamped}%` }} />
                </ProgressBar.Track>
            </ProgressBar>
            {detail && (
                <span className='text-xs text-muted tabular-nums'>
                    {detail}
                </span>
            )}
        </div>
    );
};

const ClusterUsageMetric = ({ label, usage }: ClusterUsageMetricProps) => (
    <ClusterProgressMetric
        label={label}
        percent={usage.total > 0 ? (usage.used / usage.total) * 100 : 0}
        detail={`${usage.used.toFixed(1)} / ${usage.total.toFixed(1)} GB`}
    />
);

const ClusterMetricsCard = ({ teamCluster, liveMetrics, isMetricsConnected }: ClusterMetricsCardProps) => {
    const [activeMetric, setActiveMetric] = useState<ClusterMetricTabId>('cpu');
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
        <Card variant='secondary'>
            <Card.Header>
                <div className='flex w-full flex-row items-center justify-between gap-3 min-w-0'>
                    <div className='flex min-w-0 flex-col gap-0.5'>
                        <Card.Title className='truncate'>{teamCluster.name}</Card.Title>
                        <Card.Description>{CLUSTER_ROLE_LABELS[teamCluster.roleConfig.effectiveRole]}</Card.Description>
                    </div>
                    <Chip color={STATUS_CHIP_COLORS[liveMetricsStatus.variant]} variant='soft' size='sm' className='shrink-0'>
                        <Chip.Label>{liveMetricsStatus.label}</Chip.Label>
                    </Chip>
                </div>
            </Card.Header>

            {liveMetrics !== null && (
                <Card.Content>
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

                    <div className='flex flex-col gap-3 mt-2'>
                        {activeMetric === 'cpu' && (
                            <ClusterProgressMetric
                                label='CPU'
                                percent={liveMetrics.cpu.usage}
                                detail={`${liveMetrics.cpu.cores} cores`}
                            />
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
                                    <span className='text-sm font-medium text-muted'>Incoming</span>
                                    <span className='text-sm text-foreground tabular-nums whitespace-nowrap'>
                                        <span aria-hidden='true'>↓</span> {formatNetworkSpeed(liveMetrics.network.incoming)}
                                    </span>
                                </div>
                                <div className='flex items-center justify-between gap-3 tabular-nums'>
                                    <span className='text-sm font-medium text-muted'>Outgoing</span>
                                    <span className='text-sm text-foreground tabular-nums whitespace-nowrap'>
                                        <span aria-hidden='true'>↑</span> {formatNetworkSpeed(liveMetrics.network.outgoing)}
                                    </span>
                                </div>
                                <span className='text-xs text-muted tabular-nums'>
                                    Latency · {Math.round(liveMetrics.responseTimes.self)} ms
                                </span>
                            </div>
                        )}
                    </div>
                </Card.Content>
            )}

            {liveMetrics === null && (
                <Card.Content>
                    <span className='text-xs text-muted leading-[1.4]'>
                        {liveMetricsStatus.label}
                    </span>
                </Card.Content>
            )}
        </Card>
    );
};

export default ClusterMetricsCard;
