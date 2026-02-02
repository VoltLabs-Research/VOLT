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
import { MemoryStick } from 'lucide-react';
import ChartContainer from '@/shared/presentation/components/ChartContainer';
import ChartTooltip from '@/shared/presentation/components/ChartTooltip';

const MAX_HISTORY_POINTS = 60;

const CHART_COLORS = {
    used: '#0A84FF',
    free: '#30D158'
};

export interface MemoryData {
    used: number;
    total: number;
    free?: number;
};

interface MemoryChartProps {
    data: MemoryData | null;
    isLoading?: boolean;
    unit?: 'MB' | 'GB';
};

interface DataPoint {
    time: string;
    used: number;
    free: number;
};

const formatTime = (date: Date): string => {
    const h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const MemoryChart = ({ data, isLoading = false, unit = 'GB' }: MemoryChartProps) => {
    const [history, setHistory] = useState<DataPoint[]>([]);

    useEffect(() => {
        if(!data) return;

        const used = data.used;
        const free = data.free ?? (data.total - data.used);

        const newPoint: DataPoint = {
            time: formatTime(new Date()),
            used,
            free
        };

        setHistory((prev) => {
            const updated = [...prev, newPoint];
            return updated.slice(-MAX_HISTORY_POINTS);
        });
    }, [data]);

    const stats = useMemo(() => {
        if(!history.length) return { peak: 0, avg: 0, total: 0 };

        const usedValues = history.map((d) => d.used);
        return {
            peak: Math.max(...usedValues),
            avg: usedValues.reduce((sum, v) => sum + v, 0) / usedValues.length,
            total: data?.total || 0
        };
    }, [history, data]);

    const formatValue = (value: number): string => {
        if(unit === 'MB') return `${value.toFixed(0)} MB`;
        return `${value.toFixed(1)} GB`;
    };

    const renderTooltip = ({ active, payload }: any) => {
        if(!active || !payload?.length) return null;

        return (
            <ChartTooltip
                title={payload[0].payload.time}
                items={payload.map((entry: any) => ({
                    label: entry.name,
                    value: formatValue(entry.value),
                    color: entry.color
                }))}
            />
        );
    };

    const emptyData: DataPoint[] = [{ time: '', used: 0, free: 0 }];

    return (
        <ChartContainer
            icon={MemoryStick}
            title='Memory Usage'
            isLoading={isLoading}
            stats={[
                { label: 'Total', value: formatValue(stats.total) },
                { label: 'Peak', value: formatValue(stats.peak) },
                { label: 'Avg', value: formatValue(stats.avg) }
            ]}
            statsLoading={isLoading}
        >
            <ResponsiveContainer width='100%' height={250}>
                <AreaChart
                    data={history.length ? history : emptyData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id='colorMemUsed' x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='5%' stopColor={CHART_COLORS.used} stopOpacity={0.3} />
                            <stop offset='95%' stopColor={CHART_COLORS.used} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id='colorMemFree' x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='5%' stopColor={CHART_COLORS.free} stopOpacity={0.3} />
                            <stop offset='95%' stopColor={CHART_COLORS.free} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray='3 3' stroke='var(--color-border-soft)' />
                    <YAxis
                        stroke='var(--color-text-muted)'
                        style={{ fontSize: '12px' }}
                        tickFormatter={(v) => unit === 'MB' ? `${v}` : `${v.toFixed(0)}`}
                    />
                    <Tooltip content={renderTooltip} />
                    <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                        iconType='circle'
                    />
                    <Area
                        type='monotone'
                        dataKey='used'
                        stroke={CHART_COLORS.used}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill='url(#colorMemUsed)'
                        name='Used'
                        isAnimationActive={false}
                    />
                    <Area
                        type='monotone'
                        dataKey='free'
                        stroke={CHART_COLORS.free}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill='url(#colorMemFree)'
                        name='Free'
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default MemoryChart;
