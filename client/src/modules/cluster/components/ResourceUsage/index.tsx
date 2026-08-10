import MetricBar from '../MetricBar';
import './ResourceUsage.css';
import { getClusterCpuUsage } from '@/modules/cluster/utils/cluster-cpu-usage';
import { Skeleton } from '@voltstack/bravais';
import type { ClusterMetrics } from '@volt/contracts/modules/cluster/domain';

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
        if (value <= 20) return 'var(--status-error)';
        if (value <= 40) return 'var(--status-warning)';
        return 'var(--status-success)';
    }

    if (value >= 80) return 'var(--status-error)';
    if (value >= 60) return 'var(--status-warning)';
    return 'var(--status-success)';
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
            <div className='flex flex-col resource-usage-item' key={resource.name}>
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
        <div className='flex flex-col gap-6 flex-1 resource-usage-list'>
            {metrics
                ? resources.map(renderResourceItem)
                : [...Array(4)].map((_, i) => (
                    <div className='resource-usage-item' key={i}>
                        <div className='flex flex-row items-center justify-between resource-usage-item-header'>
                            <Skeleton variant='text' width={80} height={20} />
                            <Skeleton variant='text' width={40} height={20} />
                        </div>
                        <Skeleton variant='rectangular' width='100%' height={8} style={{
                            borderRadius: 4,
                            marginTop: 8
                        }} />
                    </div>
                ))}
        </div>
    );

    return (
        <div className='flex flex-col p-6 rounded-2xl h-full resource-usage'>
            <div className='flex flex-row items-start justify-between shrink-0 resource-usage-header mb-6'>
                <h3 className='text-base font-semibold text-foreground'>Resource Usage</h3>
            </div>
            {content}
        </div>
    );
};

export default ResourceUsage;
