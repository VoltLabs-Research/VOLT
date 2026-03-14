import { getTeamClusterStatusLabel } from '@/modules/cluster/utilities/team-cluster-status';
import { formatNetworkSpeedWithUnit } from '@/modules/cluster/utilities/format-network';
import { ClusterStatus } from '@/modules/cluster/api/entities/cluster-metrics';
import './MetricsCards.css';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { Server, Cpu, MemoryStick, Activity, TrendingUp, TrendingDown, MoreVertical } from 'lucide-react';
import { Skeleton } from '@mui/material';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';

interface MetricsCardsProps {
    metrics: ClusterMetrics | null;
};

const getStatusLabel = (status: ClusterStatus): string => {
    if (status === ClusterStatus.Healthy) {
        return 'Online';
    }

    if (status === ClusterStatus.Warning) {
        return 'Warning';
    }

    return 'Critical';
};

const renderTrendIcon = (trendUp: boolean) => {
    if (trendUp) {
        return <TrendingUp className='metric-card-trend-icon' />;
    }

    return <TrendingDown className='metric-card-trend-icon' />;
};

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

    let cpuUsage = metrics.cpu.usage;

    if (metrics.cpu.coresUsage?.length > 0) {
        cpuUsage = metrics.cpu.coresUsage.reduce((sum, val) => sum + val, 0) / metrics.cpu.coresUsage.length;
    }

    const networkTotal = metrics.network.incoming + metrics.network.outgoing;
    const networkFormatted = formatNetworkSpeedWithUnit(networkTotal);
    const outgoingFormatted = formatNetworkSpeedWithUnit(metrics.network.outgoing);
    const incomingFormatted = formatNetworkSpeedWithUnit(metrics.network.incoming);
    const lifecycleStatusLabel = metrics.teamClusterStatus
        ? getTeamClusterStatusLabel(metrics.teamClusterStatus)
        : getStatusLabel(metrics.status);

    const cards = [
        {
            icon: Server,
            title: 'Active Servers',
            value: '1',
            unit: 'Cluster',
            trend: lifecycleStatusLabel,
            trendUp: metrics.status === ClusterStatus.Healthy,
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
                            <Button variant='ghost' intent='neutral' iconOnly size='sm' aria-label='More metric options' title='More metric options'>
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
                                {renderTrendIcon(card.trendUp)}
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
