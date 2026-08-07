import MetricBar from '../MetricBar';
import './ResourceUsage.css';
import { getClusterCpuUsage } from '@/modules/cluster/utils/cluster-cpu-usage';
import { Box, Heading, Row, Skeleton, Stack, Text } from '@voltstack/bravais';
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
            <Stack key={resource.name} className='resource-usage-item'>
                <Row justify='between' className='mb-2'>
                    <Text size='sm' tone='secondary'>{resource.name}</Text>
                    <Text size='md' weight='bold' style={{ color }}>
                        {resource.value}%
                    </Text>
                </Row>
                <MetricBar value={resource.value} color={color} glow={buildResourceGlow(color)} />
            </Stack>
        );
    };

    const content = (
        <Stack gap='1-5' flex='1' className='resource-usage-list'>
            {metrics
                ? resources.map(renderResourceItem)
                : [...Array(4)].map((_, i) => (
                    <Box key={i} className='resource-usage-item'>
                        <Row justify='between' className='resource-usage-item-header'>
                            <Skeleton variant='text' width={80} height={20} />
                            <Skeleton variant='text' width={40} height={20} />
                        </Row>
                        <Skeleton variant='rectangular' width='100%' height={8} style={{
                            borderRadius: 4,
                            marginTop: 8
                        }} />
                    </Box>
                ))}
        </Stack>
    );

    return (
        <Stack height='max' p='1-5' radius='lg' className='resource-usage'>
            <Row align='start' justify='between' shrink='0' className='resource-usage-header mb-6'>
                <Heading level={3} size='lg' weight='bold'>Resource Usage</Heading>
            </Row>
            {content}
        </Stack>
    );
};

export default ResourceUsage;
