import { Server, Cpu, MemoryStick, Activity, TrendingUp, TrendingDown, MoreVertical } from 'lucide-react';
import { Skeleton } from '@mui/material';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { formatNetworkSpeedWithUnit } from '@/modules/cluster/utilities/format-network';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';
import './MetricsCards.css';

interface MetricsCardsProps {
    metrics: ClusterMetrics | null;
}

const MetricsCards = ({ metrics }: MetricsCardsProps) => {
    const isLoading = !metrics;

    if(isLoading){
        return (
            <Container className='metrics-cards gap-1'>
                {[...Array(4)].map((_, i) => (
                    <Container key={i} className='metric-card radius-lg transition-normal'>
                        <Container className='d-flex items-start content-between mb-075'>
                            <Container className='d-flex items-center gap-05'>
                                <Skeleton variant='circular' width={16} height={16} />
                                <Skeleton variant='text' width={120} height={20} />
                            </Container>
                            <Skeleton variant='circular' width={16} height={16} />
                        </Container>
                        <Container className='d-flex column gap-05'>
                            <Skeleton variant='rectangular' width={100} height={48} sx={{ borderRadius: '4px' }} />
                            <Container className='d-flex items-center content-between'>
                                <Skeleton variant='text' width={100} height={16} />
                                <Skeleton variant='text' width={80} height={16} />
                            </Container>
                        </Container>
                    </Container>
                ))}
            </Container>
        );
    }

    const cpuUsage = metrics.cpu.coresUsage?.length > 0
        ? metrics.cpu.coresUsage.reduce((sum, val) => sum + val, 0) / metrics.cpu.coresUsage.length
        : metrics.cpu.usage;

    const networkTotal = metrics.network.incoming + metrics.network.outgoing;
    const networkFormatted = formatNetworkSpeedWithUnit(networkTotal);
    const outgoingFormatted = formatNetworkSpeedWithUnit(metrics.network.outgoing);
    const incomingFormatted = formatNetworkSpeedWithUnit(metrics.network.incoming);

    const cards = [
        {
            icon: Server,
            title: 'Active Servers',
            value: '1',
            unit: 'Server',
            trend: metrics.status === 'Healthy' ? 'Online' : metrics.status === 'Warning' ? 'Warning' : 'Critical',
            trendUp: metrics.status === 'Healthy',
            subtitle: metrics.status
        },
        {
            icon: Cpu,
            title: 'CPU Load',
            value: `${cpuUsage.toFixed(1)}%`,
            trend: `${metrics.cpu.cores} cores`,
            trendUp: metrics.cpu.usage < 75,
            subtitle: `Load: ${metrics.cpu.loadAvg[0].toFixed(2)}`
        },
        {
            icon: MemoryStick,
            title: 'Memory Usage',
            value: `${metrics.memory.usagePercent}%`,
            trend: `${metrics.memory.used.toFixed(1)}GB / ${metrics.memory.total.toFixed(1)}GB`,
            trendUp: metrics.memory.usagePercent < 75,
            subtitle: `Free: ${metrics.memory.free.toFixed(1)}GB`
        },
        {
            icon: Activity,
            title: 'Network Traffic',
            value: networkFormatted.value,
            unit: networkFormatted.unit,
            trend: `↑${outgoingFormatted.value} ↓${incomingFormatted.value} ${outgoingFormatted.unit}`,
            trendUp: true,
            subtitle: 'Total Traffic'
        }
    ];

    return (
        <Container className='metrics-cards gap-1'>
            {cards.map((card) => (
                <Container key={card.title} className='metric-card radius-lg transition-normal'>
                    <Container className='d-flex items-start content-between mb-075'>
                        <Container className='d-flex items-center gap-05'>
                            <card.icon className='metric-card-icon color-muted-foreground' />
                            <span className='metric-card-title font-size-2 color-secondary'>
                                {card.title}
                            </span>
                        </Container>
                        <Tooltip content='More Options' placement='bottom'>
                            <Button variant='ghost' intent='neutral' iconOnly size='sm'>
                                <MoreVertical className='metric-card-icon color-muted-foreground' />
                            </Button>
                        </Tooltip>
                    </Container>
                    <Container className='d-flex column gap-05'>
                        <Container className='d-flex items-baseline gap-05'>
                            <span className='metric-card-value font-size-6 font-weight-6 color-primary'>
                                {card.value}
                            </span>
                            {card.unit && (
                                <span className='metric-card-unit font-size-2 font-weight-5 color-muted'>
                                    {card.unit}
                                </span>
                            )}
                        </Container>
                        <Container className='d-flex items-center content-between'>
                            <span className='metric-card-subtitle font-size-1 color-secondary'>
                                {card.subtitle}
                            </span>
                            <span
                                className='d-flex items-center metric-card-trend font-size-1 gap-025'
                                style={{ color: card.trendUp ? 'var(--status-success)' : 'var(--status-error)' }}
                            >
                                {card.trendUp ? <TrendingUp className='metric-card-trend-icon' /> : <TrendingDown className='metric-card-trend-icon' />}
                                {card.trend}
                            </span>
                        </Container>
                    </Container>
                </Container>
            ))}
        </Container>
    );
};

export default MetricsCards;
