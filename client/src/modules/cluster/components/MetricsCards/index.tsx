import { formatNetworkSpeedWithUnit } from '@/modules/cluster/utilities/format-network';
import './MetricsCards.css';
import { Cpu, MemoryStick, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { Box, StatCard } from '@/shared/presentation/primitives';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';
import type { ReactNode } from 'react';

interface MetricsCardsProps {
    metrics: ClusterMetrics | null;
};

interface MetricCardItem {
    icon: ReactNode;
    title: string;
    value: string;
    unit?: string;
    trend: string;
    trendUp: boolean;
    subtitle: string;
};

const renderTrendIcon = (trendUp: boolean) => {
    if (trendUp) {
        return <TrendingUp size={14} />;
    }

    return <TrendingDown size={14} />;
};

const MetricsCards = ({ metrics }: MetricsCardsProps) => {
    const isLoading = !metrics;

    if(isLoading){
        return (
            <Box gap='1' className='metrics-cards'>
                {[...Array(4)].map((_, i) => (
                    <StatCard
                        key={i}
                        label=''
                        state='loading'
                    />
                ))}
            </Box>
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
            icon: <Cpu size={16} />,
            title: 'CPU Load',
            value: `${cpuUsage.toFixed(1)}%`,
            trend: `${metrics.cpu.cores} cores`,
            trendUp: metrics.cpu.usage < 75,
            subtitle: `Load: ${metrics.cpu.loadAvg[0].toFixed(2)}`
        },
        {
            icon: <MemoryStick size={16} />,
            title: 'Memory Usage',
            value: `${metrics.memory.usagePercent}%`,
            trend: `${metrics.memory.used.toFixed(1)}GB / ${metrics.memory.total.toFixed(1)}GB`,
            trendUp: metrics.memory.usagePercent < 75,
            subtitle: `Free: ${metrics.memory.free.toFixed(1)}GB`
        },
        {
            icon: <Activity size={16} />,
            title: 'Network Traffic',
            value: networkFormatted.value,
            unit: networkFormatted.unit,
            trend: `↑${outgoingFormatted.value} ↓${incomingFormatted.value} ${outgoingFormatted.unit}`,
            trendUp: true,
            subtitle: 'Total Traffic'
        }
    ];

    return (
        <Box gap='1' className='metrics-cards'>
            {cards.map((card) => (
                <StatCard
                    key={card.title}
                    icon={card.icon}
                    label={card.title}
                    value={card.value}
                    unit={card.unit}
                    footer={(
                        <div className='d-flex items-center content-between gap-05'>
                            <span className='color-secondary font-size-1'>{card.subtitle}</span>
                            <span className={`d-flex items-center gap-025 font-size-1 ${card.trendUp ? 'metric-card-trend-positive' : 'metric-card-trend-negative'}`}>
                                {renderTrendIcon(card.trendUp)}
                                {card.trend}
                            </span>
                        </div>
                    )}
                />
            ))}
        </Box>
    );
};

export default MetricsCards;
