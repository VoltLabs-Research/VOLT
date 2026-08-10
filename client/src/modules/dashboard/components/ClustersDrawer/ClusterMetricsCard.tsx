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

/**
 * `.dashboard-operations-cluster-item`. `--radius-lg` is 16px → `rounded-2xl`
 * (spec §3b) and `--shadow-card` was `0 0 0 1px var(--border)`. The hover
 * `border-color: var(--color-border)` is dropped: it and the base's
 * `--color-border-soft` now resolve to the same token, so it changed nothing.
 */
const CLUSTER_ITEM = 'flex flex-col gap-[0.875rem] rounded-2xl border border-border bg-surface-secondary px-[1.125rem] py-4 transition-[border-color,box-shadow] duration-150 ease-[ease] hover:shadow-[0_0_0_1px_var(--border)]';

/** The 64px label / flexible track / 40px readout grid. */
const METRIC_ROW = 'grid grid-cols-[64px_1fr_40px] items-center gap-3 min-w-0';
const METRIC_LABEL = 'text-[0.8125rem] font-medium text-muted';
const METRIC_TRACK = 'h-[5px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--muted)_18%,transparent)]';

/**
 * The fill animates width over 400ms and its colour over 150ms — two properties on
 * two different durations, which no combination of `transition-*` utilities can
 * express. An arbitrary `transition` property keeps both exact. The sheet's
 * `prefers-reduced-motion` opt-out is NOT ported: `index.css` now neutralises every
 * transition duration app-wide.
 */
const METRIC_FILL = 'h-full rounded-[inherit] [transition:width_0.4s_cubic-bezier(0.32,0.72,0,1),background-color_0.15s_ease]';

/** The label column is 64px and the gap 0.75rem, so the caption lines up under the track. */
const METRIC_SUBTITLE = 'pl-[calc(64px+0.75rem)] text-xs text-muted tabular-nums';

/**
 * bravais's `StatusBadge size='compact'` was coloured UPPERCASE TEXT and nothing
 * else: its compact rule zeroed the padding and the radius and removed the border
 * with `!important`, so despite carrying `rounded-full` it never painted a pill. A
 * HeroUI `Chip` would add the background it has never had, so this stays a span.
 * `text-transform: uppercase` is the detail most easily lost — the call site passes
 * `Active` / `Pending` / `Paused` and the badge renders them upper-cased.
 */
const STATUS_BADGE = 'inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium uppercase';

/**
 * bravais mapped `inactive` and `neutral` to the same secondary grey, so both land
 * on `text-muted` (spec §3a). The other three are hue that carries meaning and
 * survive unchanged.
 */
const STATUS_BADGE_TONES: Record<ClusterLiveMetricsVariant, string> = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    inactive: 'text-muted'
};

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

const ClusterProgressMetric = ({ label, percent, detail }: ClusterProgressMetricProps) => {
    const clamped = clampPercent(percent);
    const isCritical = clamped >= CRITICAL_THRESHOLD;
    const title = detail ? `${label} · ${clamped.toFixed(0)}% · ${detail}` : `${label} · ${clamped.toFixed(0)}%`;

    return (
        <div
            className={METRIC_ROW}
            role='group'
            aria-label={title}
            title={title}
        >
            <span className={METRIC_LABEL}>{label}</span>
            <div
                className={METRIC_TRACK}
                role='progressbar'
                aria-valuenow={Math.round(clamped)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={label}
            >
                <div
                    className={cn(METRIC_FILL, isCritical ? 'bg-danger' : 'bg-muted')}
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
            <span className={METRIC_SUBTITLE}>
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

    /*
     * bravais's SegmentedTabs was fully controlled with exactly one active id and no
     * keyboard navigation at all. `disallowEmptySelection` keeps the "always exactly
     * one" half of that contract; the arrow keys React Aria adds are new, and welcome.
     */
    const handleMetricChange = (keys: Set<Key>) => {
        for (const key of keys) {
            if (typeof key === 'string' && isClusterMetricTabId(key)) {
                setActiveMetric(key);
                return;
            }
        }
    };

    return (
        <div className={CLUSTER_ITEM}>
            <div className='flex flex-row items-center justify-between gap-4 min-w-0'>
                <div className='flex flex-col gap-1 min-w-0'>
                    <span className='text-sm font-semibold text-foreground truncate'>
                        {teamCluster.name}
                    </span>
                    <span className='text-xs text-muted'>
                        {CLUSTER_ROLE_LABELS[teamCluster.roleConfig.effectiveRole]}
                    </span>
                </div>

                <span className={cn(STATUS_BADGE, STATUS_BADGE_TONES[liveMetricsStatus.variant])}>
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
                                    <span className={METRIC_SUBTITLE}>
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
