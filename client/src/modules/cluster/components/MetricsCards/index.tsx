import { formatNetworkSpeedWithUnit } from '@/modules/cluster/utils/format-network';
import { getClusterCpuUsage } from '@/modules/cluster/utils/cluster-cpu-usage';
import './MetricsCards.css';
import { Cpu, MemoryStick, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { Box, Row, StatCard, Text } from '@voltstack/bravais';
import type { ClusterMetrics } from '@volt/contracts/modules/cluster/domain';
import type { ReactNode } from 'react';

interface MetricsCardsProps {
    metrics: ClusterMetrics | null;
}

interface MetricCardItem {
    icon: ReactNode;
    title: string;
    value: string;
    unit?: string;
    trend: string;
    trendUp: boolean;
    subtitle: string;
}

const MetricsCards = ({ metrics }: MetricsCardsProps) => {
    if(!metrics){
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

    const cpuUsage = getClusterCpuUsage(metrics.cpu);
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
                        <Row align='center' justify='between' gap='05'>
                            <Text as='span' size='sm' tone='secondary'>{card.subtitle}</Text>
                            <Row as='span' align='center' gap='025' className={`font-size-1 ${card.trendUp ? 'metric-card-trend-positive' : 'metric-card-trend-negative'}`}>
                                {card.trendUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {card.trend}
                            </Row>
                        </Row>
                    )}
                />
            ))}
        </Box>
    );
};

export default MetricsCards;
