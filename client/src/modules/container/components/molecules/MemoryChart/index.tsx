import { formatChartTime } from '../../../utilities/format-chart-time';
import { useEffect, useMemo } from 'react';
import { CHART_COLORS } from '@/modules/cluster/utilities/chart-colors';
import useTimeSeriesBuffer from '@/modules/container/hooks/use-time-series-buffer';
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
import type { MemoryData } from '../../../services/container-stats-view';

const MAX_HISTORY_POINTS = 60;

const MEMORY_CHART_COLORS = {
    used: CHART_COLORS.blue,
    free: CHART_COLORS.green
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

interface MemoryTooltipEntry {
    name?: string;
    value?: number | string;
    color?: string;
    payload?: DataPoint;
};

interface MemoryTooltipContentProps {
    active?: boolean;
    payload?: readonly unknown[];
};

const isMemoryTooltipEntry = (value: unknown): value is MemoryTooltipEntry => {
    return typeof value === 'object' && value !== null && 'payload' in value;
};

const MemoryChart = ({ data, isLoading = false, unit = 'GB' }: MemoryChartProps) => {
    const { history, pushPoint } = useTimeSeriesBuffer<DataPoint>({
        maxPoints: MAX_HISTORY_POINTS
    });

    useEffect(() => {
        if (!data) return;

        const used = data.used;
        const free = data.free ?? (data.total - data.used);

        pushPoint({
            time: formatChartTime(new Date()),
            used,
            free
        });
    }, [data, pushPoint]);

    const stats = useMemo(() => {
        if (!history.length) {
            return {
                peak: 0,
                avg: 0,
                total: 0
            };
        }

        const usedValues = history.map((d) => d.used);
        return {
            peak: Math.max(...usedValues),
            avg: usedValues.reduce((sum, v) => sum + v, 0) / usedValues.length,
            total: data?.total || 0
        };
    }, [history, data]);

    const formatValue = (value: number): string => {
        if (unit === 'MB') return `${value.toFixed(0)} MB`;
        return `${value.toFixed(1)} GB`;
    };

    const renderTooltip = ({ active, payload }: MemoryTooltipContentProps) => {
        if (!active || !Array.isArray(payload) || payload.length < 1) return null;

        const firstEntry = payload[0];
        if (!isMemoryTooltipEntry(firstEntry)) {
            return null;
        }

        const items = payload.filter(isMemoryTooltipEntry).map((entry) => ({
            label: String(entry.name ?? ''),
            value: formatValue(Number(entry.value)),
            color: String(entry.color ?? '')
        }));

        return (
            <ChartTooltip
                title={String(firstEntry.payload?.time ?? '')}
                items={items}
            />
        );
    };

    const emptyData: DataPoint[] = [{
        time: '',
        used: 0,
        free: 0
    }];

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
                    margin={{
                        top: 10,
                        right: 10,
                        left: 0,
                        bottom: 0
                    }}
                >
                    <defs>
                        <linearGradient id='colorMemUsed' x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='5%' stopColor={MEMORY_CHART_COLORS.used} stopOpacity={0.3} />
                            <stop offset='95%' stopColor={MEMORY_CHART_COLORS.used} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id='colorMemFree' x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='5%' stopColor={MEMORY_CHART_COLORS.free} stopOpacity={0.3} />
                            <stop offset='95%' stopColor={MEMORY_CHART_COLORS.free} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray='3 3' stroke='var(--color-border-soft)' />
                    <YAxis
                        stroke='var(--color-text-muted)'
                        style={{ fontSize: '12px' }}
                        tickFormatter={(v) => {
                            if (unit === 'MB') return `${v}`;
                            return `${Number(v).toFixed(0)}`;
                        }}
                    />
                    <Tooltip content={renderTooltip} />
                    <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                        iconType='circle'
                    />
                    <Area
                        type='monotone'
                        dataKey='used'
                        stroke={MEMORY_CHART_COLORS.used}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill='url(#colorMemUsed)'
                        name='Used'
                        isAnimationActive={false}
                    />
                    <Area
                        type='monotone'
                        dataKey='free'
                        stroke={MEMORY_CHART_COLORS.free}
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
