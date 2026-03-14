import ChartContainer from '@/shared/presentation/components/ChartContainer';
import ChartTooltip from '@/shared/presentation/components/ChartTooltip';
import { Activity } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { AreaChart, Area, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import type { ContentType } from 'recharts/types/component/Tooltip';

interface ChartColors {
    rx: string;
    tx: string;
    grid: string;
    axis: string;
    legend: string;
};

export interface NetworkData {
    rx: number;
    tx: number;
};

interface NetworkChartProps {
    data: NetworkData | null;
    isLoading?: boolean;
    /** If true, calculate delta between data points (for cumulative counters) */
    calculateDelta?: boolean;
    title?: string;
    height?: number;
};

interface DataPoint {
    time: string;
    rx: number;
    tx: number;
};

interface DataPointPayloadRecord {
    time: string;
};

interface ChartStats {
    totalRx: number;
    totalTx: number;
};

const MAX_HISTORY_POINTS = 60;
const RECENT_SAMPLE_COUNT = 5;
const CHART_COLORS: ChartColors = {
    rx: 'var(--accent-blue)',
    tx: 'var(--accent-green)',
    grid: 'var(--color-border-soft)',
    axis: 'var(--color-text-muted)',
    legend: 'var(--color-text-primary)'
};
const EMPTY_DATA: DataPoint[] = [{ time: '', rx: 0, tx: 0 }];
const CHART_MARGIN = {
    top: 10,
    right: 10,
    left: 0,
    bottom: 0
};
const RECENT_SAMPLES_LIST_STYLE = {
    listStyle: 'none'
};
const LEGEND_WRAPPER_STYLE = {
    fontSize: '12px',
    paddingTop: '20px',
    color: CHART_COLORS.legend
};

const byteNumberFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
});

const formatTime = (date: Date): string => {
    return timeFormatter.format(date);
};

const formatByteSize = (value: number): string => {
    if (value === 0) {
        return '0 B';
    }

    const absoluteValue = Math.abs(value);
    const unitBase = 1024;
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const unitIndex = Math.min(
        Math.max(0, Math.floor(Math.log(absoluteValue) / Math.log(unitBase))),
        units.length - 1
    );
    const scaledValue = value / (unitBase ** unitIndex);

    return `${byteNumberFormatter.format(scaledValue)} ${units[unitIndex]}`;
};

const isDataPointPayloadRecord = (value: unknown): value is DataPointPayloadRecord => {
    if(typeof value !== 'object' || value === null){
        return false;
    }

    if(!('time' in value)){
        return false;
    }

    return typeof value.time === 'string';
};

const formatTooltipValue = (value: ValueType): string => {
    if(typeof value === 'number'){
        return formatByteSize(value);
    }

    return String(value);
};

const NetworkChart = ({
    data,
    isLoading = false,
    calculateDelta = true,
    title = 'Network I/O',
    height = 250
}: NetworkChartProps) => {
    const [history, setHistory] = useState<DataPoint[]>([]);
    const [prevData, setPrevData] = useState<NetworkData | null>(null);
    const gradientId = useId();

    useEffect(() => {
        if(!data) return;

        let rxValue = data.rx;
        let txValue = data.tx;

        if(calculateDelta){
            if(prevData){
                rxValue = Math.max(0, data.rx - prevData.rx);
                txValue = Math.max(0, data.tx - prevData.tx);
            }else{
                setPrevData(data);
                return;
            }
        }

        setPrevData(data);

        const newPoint: DataPoint = {
            time: formatTime(new Date()),
            rx: rxValue,
            tx: txValue
        };

        setHistory((prev) => {
            const updated = [...prev, newPoint];
            return updated.slice(-MAX_HISTORY_POINTS);
        });
    }, [data, calculateDelta]);

    const stats = useMemo<ChartStats>(() => {
        if(!history.length) {
            return {
                totalRx: 0,
                totalTx: 0
            };
        }

        const rxValues = history.map((d) => d.rx);
        const txValues = history.map((d) => d.tx);

        return {
            totalRx: calculateDelta ? (data?.rx || 0) : rxValues.reduce((sum, v) => sum + v, 0),
            totalTx: calculateDelta ? (data?.tx || 0) : txValues.reduce((sum, v) => sum + v, 0)
        };
    }, [history, data, calculateDelta]);

    const latestPoint = history[history.length - 1] ?? null;
    const recentSamples = useMemo<DataPoint[]>(() => {
        return history.slice(-RECENT_SAMPLE_COUNT).reverse();
    }, [history]);

    const chartDescription = useMemo(() => {
        if (!latestPoint) {
            return 'Waiting for network samples.';
        }

        return `Latest sample at ${latestPoint.time}. Received ${formatByteSize(latestPoint.rx)}. Transmitted ${formatByteSize(latestPoint.tx)}.`;
    }, [latestPoint]);

    const statItems = useMemo(() => {
        return [
            { label: 'RX Total', value: formatByteSize(stats.totalRx) },
            { label: 'TX Total', value: formatByteSize(stats.totalTx) }
        ];
    }, [stats.totalRx, stats.totalTx]);

    const renderTooltip: ContentType<ValueType, NameType> = ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
        if(!active || !payload?.length) return null;

        const firstPayload = payload[0]?.payload;
        if(!isDataPointPayloadRecord(firstPayload)){
            return null;
        }

        return (
            <ChartTooltip
                title={firstPayload.time}
                items={payload.map((entry) => ({
                    label: String(entry.name || ''),
                    value: formatTooltipValue(entry.value || 0),
                    color: entry.color
                }))}
            />
        );
    };

    const rxGradientId = `${gradientId}-network-rx`;
    const txGradientId = `${gradientId}-network-tx`;

    return (
        <ChartContainer
            icon={Activity}
            title={title}
            isLoading={isLoading}
            stats={statItems}
            statsLoading={isLoading}
        >
            <div className='d-flex column gap-1'>
                <div aria-hidden='true'>
                    <ResponsiveContainer width='100%' height={height}>
                        <AreaChart
                            data={history.length ? history : EMPTY_DATA}
                            margin={CHART_MARGIN}
                        >
                            <defs>
                                <linearGradient id={rxGradientId} x1='0' y1='0' x2='0' y2='1'>
                                    <stop offset='5%' stopColor={CHART_COLORS.rx} stopOpacity={0.3} />
                                    <stop offset='95%' stopColor={CHART_COLORS.rx} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id={txGradientId} x1='0' y1='0' x2='0' y2='1'>
                                    <stop offset='5%' stopColor={CHART_COLORS.tx} stopOpacity={0.3} />
                                    <stop offset='95%' stopColor={CHART_COLORS.tx} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray='3 3' stroke={CHART_COLORS.grid} />
                            <YAxis
                                stroke={CHART_COLORS.axis}
                                style={{ fontSize: '12px' }}
                                tickFormatter={formatByteSize}
                            />
                            <Tooltip content={renderTooltip} />
                            <Legend
                                wrapperStyle={LEGEND_WRAPPER_STYLE}
                                iconType='circle'
                            />
                            <Area
                                type='monotone'
                                dataKey='rx'
                                stroke={CHART_COLORS.rx}
                                strokeWidth={2}
                                fillOpacity={1}
                                fill={`url(#${rxGradientId})`}
                                name='Received'
                                isAnimationActive={false}
                            />
                            <Area
                                type='monotone'
                                dataKey='tx'
                                stroke={CHART_COLORS.tx}
                                strokeWidth={2}
                                fillOpacity={1}
                                fill={`url(#${txGradientId})`}
                                name='Transmitted'
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className='d-flex column gap-05'>
                    <span className='font-size-1 color-muted'>
                        {chartDescription}
                    </span>

                    {recentSamples.length > 0 ? (
                        <ul className='d-flex column gap-025 m-0 p-0' style={RECENT_SAMPLES_LIST_STYLE}>
                            {recentSamples.map((point) => (
                                <li key={`${point.time}-${point.rx}-${point.tx}`} className='font-size-1 color-secondary'>
                                    <strong className='color-primary'>{point.time}</strong>
                                    {' · '}
                                    Received {formatByteSize(point.rx)}
                                    {' · '}
                                    Transmitted {formatByteSize(point.tx)}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            </div>
        </ChartContainer>
    );
};

export default NetworkChart;
