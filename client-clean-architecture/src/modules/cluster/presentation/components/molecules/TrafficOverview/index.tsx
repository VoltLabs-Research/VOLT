import { useState, useEffect, useMemo } from 'react';
import {
    AreaChart,
    Area,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { Activity } from 'lucide-react';
import type { ClusterMetrics } from '@/modules/cluster/domain/entities';
import { MAX_HISTORY_POINTS, CHART_COLORS } from '@/modules/cluster/domain/constants';
import { formatNetworkSpeed } from '@/modules/cluster/presentation/utilities/format-network';
import ChartContainer from '@/modules/cluster/presentation/components/atoms/ChartContainer';
import ChartTooltip from '@/modules/cluster/presentation/components/atoms/ChartTooltip';

interface DataPoint {
    time: string;
    incoming: number;
    outgoing: number;
    total: number;
};

interface TrafficOverviewProps {
    metrics: ClusterMetrics | null;
};

const EMPTY_DATA: DataPoint[] = [{ time: '', incoming: 0, outgoing: 0, total: 0 }];

const formatTime = (date: Date): string => {
    const h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const TrafficOverview = ({ metrics }: TrafficOverviewProps) => {
    const [data, setData] = useState<DataPoint[]>([]);

    useEffect(() => {
        if(!metrics?.network) return;

        const { incoming, outgoing } = metrics.network;
        const newPoint: DataPoint = {
            time: formatTime(new Date()),
            incoming,
            outgoing,
            total: incoming + outgoing
        };

        setData((prev) => {
            const updated = [...prev, newPoint];
            return updated.slice(-MAX_HISTORY_POINTS);
        });
    }, [metrics]);

    const stats = useMemo(() => {
        if(!data.length) return { peak: 0, avg: 0 };
        
        const totals = data.map((d) => d.total);
        return {
            peak: Math.max(...totals),
            avg: totals.reduce((sum, v) => sum + v, 0) / totals.length
        };
    }, [data]);

    const renderTooltip = ({ active, payload }: any) => {
        if(!active || !payload?.length) return null;
        
        return (
            <ChartTooltip
                title={payload[0].payload.time}
                items={payload.map((entry: any) => ({
                    label: entry.name,
                    value: formatNetworkSpeed(entry.value),
                    color: entry.color
                }))}
            />
        );
    };

    return (
        <ChartContainer
            icon={Activity}
            title='Network Traffic'
            isLoading={!metrics}
            stats={[
                { label: 'Peak', value: formatNetworkSpeed(stats.peak) },
                { label: 'Avg', value: formatNetworkSpeed(stats.avg) }
            ]}
            statsLoading={!metrics}
        >
            <ResponsiveContainer width='100%' height={300}>
                <AreaChart
                    data={data.length ? data : EMPTY_DATA}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id='colorIncoming' x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='5%' stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
                            <stop offset='95%' stopColor={CHART_COLORS.blue} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id='colorOutgoing' x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='5%' stopColor={CHART_COLORS.green} stopOpacity={0.3} />
                            <stop offset='95%' stopColor={CHART_COLORS.green} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray='3 3' stroke='var(--color-border-soft)' />
                    <YAxis
                        stroke='var(--color-text-muted)'
                        style={{ fontSize: '12px' }}
                        tickFormatter={(v) => `${v} M`}
                    />
                    <Tooltip content={renderTooltip} />
                    <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                        iconType='circle'
                    />
                    <Area
                        type='monotone'
                        dataKey='incoming'
                        stroke={CHART_COLORS.blue}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill='url(#colorIncoming)'
                        name='Incoming'
                        isAnimationActive={false}
                    />
                    <Area
                        type='monotone'
                        dataKey='outgoing'
                        stroke={CHART_COLORS.green}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill='url(#colorOutgoing)'
                        name='Outgoing'
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default TrafficOverview;
