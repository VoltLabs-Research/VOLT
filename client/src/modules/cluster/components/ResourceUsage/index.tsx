import MetricBar from '../MetricBar';
import { getClusterCpuUsage } from '@/modules/cluster/utils/cluster-cpu-usage';
import { Skeleton } from '@heroui/react';
import type { ClusterMetrics } from '@volt/contracts/modules/cluster/domain';

/**
 * `.resource-usage` was `border: 1px solid var(--glass-border)` plus
 * `backdrop-filter: var(--glass-blur)` and its `-webkit-` twin. Glass was already
 * flattened onto solid surfaces before this migration — the shim resolves
 * `--glass-blur` to `none` — so the blur is dead weight and only the border survives
 * (spec §3a). Tailwind's own `backdrop-blur-*` emits the vendor pair, so nothing here
 * needs a hand-written prefix either way.
 */
const PANEL_CLASS = 'flex flex-col h-full rounded-2xl border border-border p-6';

/**
 * bravais's `Skeleton` at `variant='text'` carried `transform: scale(1, .6)` even
 * against an explicit height, so `height={20}` painted about 12px while still
 * reserving 20px of layout. These heights are the painted ones — what the eye had —
 * with `variant='text'`'s 6px `--radius-xs` becoming `rounded-md` (spec §3b) and the
 * bar keeping its literal 4px. bravais defaulted to `pulse`; HeroUI defaults to
 * shimmer, hence the explicit `animationType`.
 */
const SKELETON_LABEL_CLASS = 'h-3 w-20 rounded-md';

const SKELETON_VALUE_CLASS = 'h-3 w-10 rounded-md';

const SKELETON_BAR_CLASS = 'mt-2 h-2 w-full rounded-[4px]';

const LOADING_ITEM_KEYS = ['resource-0', 'resource-1', 'resource-2', 'resource-3'];

interface ResourceUsageProps {
    metrics: ClusterMetrics | null;
}

interface ResourceItem {
    name: string;
    value: number;
    isAvailableSpace: boolean;
}

/*
 * These are inline `style` values rather than classes — `MetricBar` needs the colour
 * as a string to build a `box-shadow` from — so they name HeroUI's tokens directly
 * instead of going through the temporary shim's `--status-*` aliases, which are
 * deleted with the last component stylesheet (spec §5b.1).
 */
const getResourceColor = ({ value, isAvailableSpace }: ResourceItem): string => {
    if (isAvailableSpace) {
        if (value <= 20) return 'var(--danger)';
        if (value <= 40) return 'var(--warning)';
        return 'var(--success)';
    }

    if (value >= 80) return 'var(--danger)';
    if (value >= 60) return 'var(--warning)';
    return 'var(--success)';
};

const buildResourceGlow = (color: string): string => {
    return `0 0 20px color-mix(in srgb, ${color} 40%, transparent)`;
};

const ResourceUsage = ({ metrics }: ResourceUsageProps) => {
    const resources: ResourceItem[] = metrics
        ? [
            {
                name: 'CPU Load',
                value: Math.round(getClusterCpuUsage(metrics.cpu)),
                isAvailableSpace: false
            },
            {
                name: 'Memory',
                value: Math.round(metrics.memory.usagePercent),
                isAvailableSpace: false
            },
            {
                name: 'Available Space',
                value: Math.max(0, 100 - metrics.disk.usagePercent),
                isAvailableSpace: true
            },
            {
                name: 'Network TX',
                value: Math.min(100, Math.round((metrics.network.outgoing / 1024) * 10)),
                isAvailableSpace: false
            }
        ]
        : [];

    const renderResourceItem = (resource: ResourceItem) => {
        const color = getResourceColor(resource);

        return (
            <div className='flex flex-col' key={resource.name}>
                <div className='flex flex-row items-center justify-between mb-2'>
                    <span className='text-xs text-muted'>{resource.name}</span>
                    <span className='text-sm font-semibold' style={{ color }}>
                        {resource.value}%
                    </span>
                </div>
                <MetricBar value={resource.value} color={color} glow={buildResourceGlow(color)} />
            </div>
        );
    };

    const content = (
        /* `.resource-usage-list { justify-content: space-around }`. */
        <div className='flex flex-col gap-6 flex-1 justify-around'>
            {metrics
                ? resources.map(renderResourceItem)
                : LOADING_ITEM_KEYS.map((key) => (
                    <div key={key}>
                        <div className='flex flex-row items-center justify-between'>
                            <Skeleton animationType='pulse' className={SKELETON_LABEL_CLASS} />
                            <Skeleton animationType='pulse' className={SKELETON_VALUE_CLASS} />
                        </div>
                        <Skeleton animationType='pulse' className={SKELETON_BAR_CLASS} />
                    </div>
                ))}
        </div>
    );

    return (
        <div className={PANEL_CLASS}>
            <div className='flex flex-row items-start justify-between shrink-0 mb-6'>
                <h3 className='text-base font-semibold text-foreground'>Resource Usage</h3>
            </div>
            {content}
        </div>
    );
};

export default ResourceUsage;
