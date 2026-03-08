import { MoreVertical } from 'lucide-react';
import { Skeleton } from '@mui/material';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Button from '@/shared/presentation/components/Button';
import MetricBar from '../../atoms/MetricBar';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';
import './ResourceUsage.css';

interface ResourceUsageProps {
    metrics: ClusterMetrics | null;
}

const getLoadColor = (value: number): string => {
    if(value >= 80) return '#FF453A';
    if(value >= 60) return '#FF9F0A';
    return '#32D74B';
};

const getLoadGlow = (value: number): string => {
    if(value >= 80) return '0 0 20px rgba(255, 69, 58, 0.4)';
    if(value >= 60) return '0 0 20px rgba(255, 159, 10, 0.4)';
    return '0 0 20px rgba(50, 215, 75, 0.4)';
};

const getAvailableSpaceColor = (value: number): string => {
    if(value <= 20) return '#FF453A';
    if(value <= 40) return '#FF9F0A';
    return '#32D74B';
};

const getAvailableSpaceGlow = (value: number): string => {
    if(value <= 20) return '0 0 20px rgba(255, 69, 58, 0.4)';
    if(value <= 40) return '0 0 20px rgba(255, 159, 10, 0.4)';
    return '0 0 20px rgba(50, 215, 75, 0.4)';
};

const ResourceUsage = ({ metrics }: ResourceUsageProps) => {
    const isLoading = !metrics;

    const resources = metrics ? [
        {
            name: 'CPU Load',
            value: metrics.cpu.coresUsage?.length > 0
                ? Math.round(metrics.cpu.coresUsage.reduce((sum, val) => sum + val, 0) / metrics.cpu.coresUsage.length)
                : Math.round(metrics.cpu.usage),
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
    ] : [];

    return (
        <Container className='d-flex column resource-usage h-max p-1-5 radius-lg'>
            <Container className='d-flex items-start content-between resource-usage-header mb-1-5 f-shrink-0'>
                <Title className='font-size-3 font-weight-6 color-primary'>Resource Usage</Title>
                <Button variant='ghost' intent='neutral' iconOnly size='sm'>
                    <MoreVertical className='color-muted' style={{ width: '1rem', height: '1rem' }} />
                </Button>
            </Container>

            {isLoading ? (
                <Container className='d-flex column gap-1-5 resource-usage-list flex-1'>
                    {[...Array(4)].map((_, i) => (
                        <Container key={i} className='resource-usage-item'>
                            <Container className='d-flex items-center content-between resource-usage-item-header'>
                                <Skeleton variant='text' width={80} height={20} />
                                <Skeleton variant='text' width={40} height={20} />
                            </Container>
                            <Skeleton variant='rectangular' width='100%' height={8} sx={{ borderRadius: '4px', marginTop: '8px' }} />
                        </Container>
                    ))}
                </Container>
            ) : (
                <Container className='d-flex column gap-1-5 resource-usage-list flex-1'>
                    {resources.map((resource) => {
                        const color = resource.isAvailableSpace
                            ? getAvailableSpaceColor(resource.value)
                            : getLoadColor(resource.value);
                        const glow = resource.isAvailableSpace
                            ? getAvailableSpaceGlow(resource.value)
                            : getLoadGlow(resource.value);

                        return (
                            <Container key={resource.name} className='d-flex column resource-usage-item'>
<Container className='d-flex items-center content-between mb-05'>
                                    <span className='font-size-1 color-secondary'>{resource.name}</span>
                                    <span className='font-size-2 font-weight-6' style={{ color }}>
                                        {resource.value}%
                                    </span>
                                </Container>
                                <MetricBar value={resource.value} color={color} glow={glow} />
                            </Container>
                        );
                    })}
                </Container>
            )}
        </Container>
    );
};

export default ResourceUsage;
