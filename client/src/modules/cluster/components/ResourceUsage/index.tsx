import MetricBar from '../MetricBar';
import { getClusterCpuUsage } from '@/modules/cluster/utils/cluster-cpu-usage';
import { Skeleton } from '@heroui/react';
import type { ClusterMetrics } from '@volt/contracts/modules/cluster/domain';

const LOADING_ITEM_KEYS = ['resource-0', 'resource-1', 'resource-2', 'resource-3'];

interface ResourceUsageProps {
    metrics: ClusterMetrics | null;
}

interface ResourceItem {
    name: string;
    value: number;
    isAvailableSpace: boolean;
}

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

        <div className='flex flex-col gap-6 flex-1 justify-around'>
            {metrics
                ? resources.map(renderResourceItem)
                : LOADING_ITEM_KEYS.map((key) => (
                    <div key={key}>
                        <div className='flex flex-row items-center justify-between'>
                            <Skeleton animationType='pulse' className='h-3 w-20 rounded-md' />
                            <Skeleton animationType='pulse' className='h-3 w-10 rounded-md' />
                        </div>
                        <Skeleton animationType='pulse' className='mt-2 h-2 w-full rounded-[4px]' />
                    </div>
                ))}
        </div>
    );

    return (
        <div className='flex flex-col h-full rounded-2xl border border-border p-6'>
            <div className='flex flex-row items-start justify-between shrink-0 mb-6'>
                <h3 className='text-base font-semibold text-foreground'>Resource Usage</h3>
            </div>
            {content}
        </div>
    );
};

export default ResourceUsage;
