import MetricBar from '../MetricBar';
import './ResourceUsage.css';
import Skeleton from '@/shared/presentation/components/Skeleton';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';

interface ResourceUsageProps {
    metrics: ClusterMetrics | null;
};

interface ResourceItem {
    name: string;
    value: number;
    isAvailableSpace: boolean;
};

const getLoadColor = (value: number): string => {
    if(value >= 80) return 'var(--status-error)';
    if(value >= 60) return 'var(--status-warning)';
    return 'var(--status-success)';
};

const getLoadGlow = (value: number): string => {
    if(value >= 80) return '0 0 20px color-mix(in srgb, var(--status-error) 40%, transparent)';
    if(value >= 60) return '0 0 20px color-mix(in srgb, var(--status-warning) 40%, transparent)';
    return '0 0 20px color-mix(in srgb, var(--status-success) 40%, transparent)';
};

const getAvailableSpaceColor = (value: number): string => {
    if(value <= 20) return 'var(--status-error)';
    if(value <= 40) return 'var(--status-warning)';
    return 'var(--status-success)';
};

const getAvailableSpaceGlow = (value: number): string => {
    if(value <= 20) return '0 0 20px color-mix(in srgb, var(--status-error) 40%, transparent)';
    if(value <= 40) return '0 0 20px color-mix(in srgb, var(--status-warning) 40%, transparent)';
    return '0 0 20px color-mix(in srgb, var(--status-success) 40%, transparent)';
};

const getCpuLoad = (metrics: ClusterMetrics): number => {
    let cpuLoad = Math.round(metrics.cpu.usage);

    if (metrics.cpu.coresUsage?.length > 0) {
        cpuLoad = Math.round(metrics.cpu.coresUsage.reduce((sum, val) => sum + val, 0) / metrics.cpu.coresUsage.length);
    }

    return cpuLoad;
};

const getResourceColor = (resource: ResourceItem): string => {
    let color = getLoadColor(resource.value);

    if (resource.isAvailableSpace) {
        color = getAvailableSpaceColor(resource.value);
    }

    return color;
};

const getResourceGlow = (resource: ResourceItem): string => {
    let glow = getLoadGlow(resource.value);

    if (resource.isAvailableSpace) {
        glow = getAvailableSpaceGlow(resource.value);
    }

    return glow;
};

const ResourceUsage = ({ metrics }: ResourceUsageProps) => {
    const isLoading = !metrics;
    const resources: ResourceItem[] = [];

    if (metrics) {
        resources.push(
            {
                name: 'CPU Load',
                value: getCpuLoad(metrics),
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
        );
    }

    const renderResourceItem = (resource: ResourceItem) => {
        const color = getResourceColor(resource);
        const glow = getResourceGlow(resource);

        return (
            <div key={resource.name} className='volt-container d-flex column resource-usage-item'>
                <div className='volt-container d-flex items-center content-between mb-05'>
                    <span className='font-size-1 color-secondary'>{resource.name}</span>
                    <span className='font-size-2 font-weight-6' style={{ color }}>
                        {resource.value}%
                    </span>
                </div>
                <MetricBar value={resource.value} color={color} glow={glow} />
            </div>
        );
    };

    let content = (
        <div className='volt-container d-flex column gap-1-5 resource-usage-list flex-1'>
            {[...Array(4)].map((_, i) => (
                <div key={i} className='volt-container resource-usage-item'>
                    <div className='volt-container d-flex items-center content-between resource-usage-item-header'>
                        <Skeleton variant='text' width={80} height={20} />
                        <Skeleton variant='text' width={40} height={20} />
                    </div>
                    <Skeleton variant='rectangular' width='100%' height={8} style={{ borderRadius: 4, marginTop: 8 }} />
                </div>
            ))}
        </div>
    );

    if (!isLoading) {
        content = (
            <div className='volt-container d-flex column gap-1-5 resource-usage-list flex-1'>
                {resources.map(renderResourceItem)}
            </div>
        );
    }

    return (
        <div className='volt-container d-flex column resource-usage h-max p-1-5 radius-lg'>
            <div className='volt-container d-flex items-start content-between resource-usage-header mb-1-5 f-shrink-0'>
                <h3 className='volt-title font-size-3 font-weight-6 color-primary'>Resource Usage</h3>
            </div>
            {content}
        </div>
    );
};

export default ResourceUsage;
