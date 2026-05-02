import MetricBar from '../MetricBar';
import './ResourceUsage.css';
import Box from '@/shared/presentation/primitives/Box';
import Heading from '@/shared/presentation/primitives/Heading';
import Row from '@/shared/presentation/primitives/Row';
import Skeleton from '@/shared/presentation/primitives/Skeleton';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';

interface ResourceUsageProps {
    metrics: ClusterMetrics | null;
}

interface ResourceItem {
    name: string;
    value: number;
    isAvailableSpace: boolean;
}

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
            <Stack key={resource.name} className='resource-usage-item'>
                <Row justify='between' className='mb-05'>
                    <Text size='sm' tone='secondary'>{resource.name}</Text>
                    <Text size='md' weight='bold' style={{ color }}>
                        {resource.value}%
                    </Text>
                </Row>
                <MetricBar value={resource.value} color={color} glow={glow} />
            </Stack>
        );
    };

    let content = (
        <Stack gap='1-5' flex='1' className='resource-usage-list'>
            {[...Array(4)].map((_, i) => (
                <Box key={i} className='resource-usage-item'>
                    <Row justify='between' className='resource-usage-item-header'>
                        <Skeleton variant='text' width={80} height={20} />
                        <Skeleton variant='text' width={40} height={20} />
                    </Row>
                    <Skeleton variant='rectangular' width='100%' height={8} style={{ borderRadius: 4, marginTop: 8 }} />
                </Box>
            ))}
        </Stack>
    );

    if (!isLoading) {
        content = (
            <Stack gap='1-5' flex='1' className='resource-usage-list'>
                {resources.map(renderResourceItem)}
            </Stack>
        );
    }

    return (
        <Stack height='max' p='1-5' radius='lg' className='resource-usage'>
            <Row align='start' justify='between' shrink='0' className='resource-usage-header mb-1-5'>
                <Heading level={3} size='lg' weight='bold'>Resource Usage</Heading>
            </Row>
            {content}
        </Stack>
    );
};

export default ResourceUsage;
