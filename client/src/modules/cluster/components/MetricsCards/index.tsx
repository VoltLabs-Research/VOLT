import { Skeleton, cn } from '@heroui/react';
import { formatNetworkSpeedWithUnit } from '@/modules/cluster/utils/format-network';
import { getClusterCpuUsage } from '@/modules/cluster/utils/cluster-cpu-usage';
import { Cpu, MemoryStick, Activity, TrendingUp, TrendingDown } from 'lucide-react';
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

const LOADING_CARD_KEYS = ['metric-card-0', 'metric-card-1', 'metric-card-2', 'metric-card-3'];

const MetricsCards = ({ metrics }: MetricsCardsProps) => {
    if(!metrics){
        return (
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
                {LOADING_CARD_KEYS.map((key) => (
                    <div className='flex flex-col gap-3 rounded-xl border border-border p-6' key={key}>
                        <div className='flex flex-row items-center gap-2'>
                            <span className='text-[0.7rem] font-semibold uppercase tracking-[0.05em] leading-none text-muted' />
                        </div>
                        <Skeleton animationType='pulse' className='h-[17px] w-[60%] rounded-md' />
                    </div>
                ))}
            </div>
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
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
            {cards.map((card) => (
                <div className='flex flex-col gap-3 rounded-xl border border-border p-6' key={card.title}>
                    <div className='flex flex-row items-center gap-2'>
                        <span className='text-muted' aria-hidden='true'>{card.icon}</span>
                        <span className='text-[0.7rem] font-semibold uppercase tracking-[0.05em] leading-none text-muted'>{card.title}</span>
                    </div>
                    <div className='flex flex-row items-baseline gap-2 tabular-nums'>
                        <span className='text-3xl font-semibold leading-[1.15] text-foreground'>{card.value}</span>
                        {card.unit && <span className='text-sm leading-[1.15] text-muted'>{card.unit}</span>}
                    </div>
                    <div className='pt-1'>
                        <div className='flex flex-row items-center justify-between gap-2'>
                            <span className='text-xs text-muted'>{card.subtitle}</span>
                            <span className={cn('inline-flex flex-row items-center gap-1 text-xs font-medium', card.trendUp ? 'text-success' : 'text-danger')}>
                                {card.trendUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
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
