import { useState, useEffect, useMemo } from 'react';
import {
    AreaChart,
    Area,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { Cpu } from 'lucide-react';
import ChartContainer from '@/shared/presentation/components/ChartContainer';
import ChartTooltip from '@/shared/presentation/components/ChartTooltip';

const MAX_HISTORY_POINTS = 60;

const CHART_COLOR = '#0A84FF';

export interface CpuData {
    usage: number;
    cores: number;
};

interface CpuChartProps {
    data: CpuData | null;
    isLoading?: boolean;
};

interface DataPoint {
    time: string;
    usage: number;
};

const formatTime = (date: Date): string => {
    const h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const CpuChart = ({ data, isLoading = false }: CpuChartProps) => {
    const [history, setHistory] = useState<DataPoint[]>([]);

    useEffect(() => {
        if(!data) return;

        const newPoint: DataPoint = {
            time: formatTime(new Date()),
            usage: data.usage
        };

        setHistory((prev) => {
            const updated = [...prev, newPoint];
            return updated.slice(-MAX_HISTORY_POINTS);
        });
    }, [data]);

    const stats = useMemo(() => {
        if(!history.length) return { peak: 0, avg: 0, cores: 0 };

        const usageValues = history.map((d) => d.usage);
        return {
            peak: Math.max(...usageValues),
            avg: usageValues.reduce((sum, v) => sum + v, 0) / usageValues.length,
            cores: data?.cores || 0
        };
    }, [history, data]);

    const renderTooltip = ({ active, payload }: any) => {
        if(!active || !payload?.length) return null;

        return (
            <ChartTooltip
                title={payload[0].payload.time}
                items={[{
                    label: 'Usage',
                    value: `${payload[0].value.toFixed(1)}%`,
                    color: CHART_COLOR
                }]}
            />
        );
    };

    const emptyData: DataPoint[] = [{ time: '', usage: 0 }];

    return (
        <ChartContainer
            icon={Cpu}
            title='CPU Usage'
            isLoading={isLoading}
            stats={[
                { label: 'Cores', value: stats.cores },
                { label: 'Peak', value: `${stats.peak.toFixed(1)}%` },
                { label: 'Avg', value: `${stats.avg.toFixed(1)}%` }
            ]}
            statsLoading={isLoading}
        >
            <ResponsiveContainer width='100%' height={250}>
                <AreaChart
                    data={history.length ? history : emptyData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id='colorCpuUsage' x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='5%' stopColor={CHART_COLOR} stopOpacity={0.3} />
                            <stop offset='95%' stopColor={CHART_COLOR} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray='3 3' stroke='var(--color-border-soft)' />
                    <YAxis
                        stroke='var(--color-text-muted)'
                        style={{ fontSize: '12px' }}
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={renderTooltip} />
                    <Area
                        type='monotone'
                        dataKey='usage'
                        stroke={CHART_COLOR}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill='url(#colorCpuUsage)'
                        name='CPU Usage'
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default CpuChart;
