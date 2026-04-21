import { formatNetworkSpeedWithUnit } from '@/modules/cluster/utilities/format-network';
import './MetricsCards.css';
import { Cpu, MemoryStick, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import Skeleton from '@/shared/presentation/components/Skeleton';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';

interface MetricsCardsProps {
    metrics: ClusterMetrics | null;
};

interface MetricCardItem {
    icon: typeof Cpu;
    title: string;
    value: string;
    unit?: string;
    trend: string;
    trendUp: boolean;
    subtitle: string;
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
            <div className='volt-container metrics-cards gap-1'>
                {[...Array(4)].map((_, i) => (
                    <div key={i} className='volt-container metric-card radius-lg'>
                        <div className='volt-container d-flex items-start content-between mb-075'>
                            <div className='volt-container d-flex items-center gap-05'>
                                <Skeleton variant='circular' width={16} height={16} />
                                <Skeleton variant='text' width={120} height={20} />
                            </div>
                        </div>
                        <div className='volt-container d-flex column gap-05'>
                            <Skeleton variant='rectangular' width={100} height={48} style={{ borderRadius: 4 }} />
                            <div className='volt-container d-flex items-center content-between'>
                                <Skeleton variant='text' width={100} height={16} />
                                <Skeleton variant='text' width={80} height={16} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
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
    const cards: MetricCardItem[] = [
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
        <div className='volt-container metrics-cards gap-1'>
            {cards.map((card) => (
                <div key={card.title} className='volt-container metric-card radius-lg'>
                    <div className='volt-container d-flex items-start content-between mb-075'>
                        <div className='volt-container d-flex items-center gap-05'>
                            <card.icon className='metric-card-icon color-muted' />
                            <span className='metric-card-title font-size-2 color-secondary'>
                                {card.title}
                            </span>
                        </div>
                    </div>
                    <div className='volt-container d-flex column gap-05'>
                        <div className='volt-container d-flex items-baseline gap-05'>
                            <span className='metric-card-value font-size-6 font-weight-6 color-primary'>
                                {card.value}
                            </span>
                            {card.unit && (
                                <span className='metric-card-unit font-size-2 font-weight-5 color-muted'>
                                    {card.unit}
                                </span>
                            )}
                        </div>
                        <div className='volt-container d-flex items-center content-between'>
                            <span className='metric-card-subtitle font-size-1 color-secondary'>
                                {card.subtitle}
                            </span>
                            <span className={`d-flex items-center metric-card-trend font-size-1 gap-025 ${card.trendUp ? 'metric-card-trend-positive' : 'metric-card-trend-negative'}`}>
                                {renderTrendIcon(card.trendUp)}
                                {card.trend}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default MetricsCards;
