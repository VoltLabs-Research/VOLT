import { Theme } from '@/shared/presentation/hooks/use-theme';
import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/presentation/utilities/ensure-monaco';
import ChartContainer from '@/shared/presentation/components/ChartContainer';
import ChartTooltip from '@/shared/presentation/components/ChartTooltip';
import { formatSize } from '@/shared/utils/format';
import { Activity } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
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

const DEFAULT_CHART_COLORS: ChartColors = {
    rx: '#0062FF',
    tx: '#2dcc70',
    grid: '#1D1D20',
    axis: '#7e808b',
    legend: '#f0f0f0'
};

const LIGHT_CHART_COLORS: ChartColors = {
    rx: '#007aff',
    tx: '#34c759',
    grid: 'rgb(0 0 0 / 8%)',
    axis: '#8e8e93',
    legend: '#1d1d1f'
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

const MAX_HISTORY_POINTS = 60;

const formatTime = (date: Date): string => {
    const h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
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
        return formatSize(value);
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
    const [theme, setTheme] = useState<Theme>(() => getActiveAppTheme());

    useEffect(() => {
        return subscribeToAppTheme(setTheme);
    }, []);

    const chartColors = useMemo<ChartColors>(() => {
        const styles = getComputedStyle(document.documentElement);
        const fallbackColors = theme === Theme.Light ? LIGHT_CHART_COLORS : DEFAULT_CHART_COLORS;

        return {
            rx: styles.getPropertyValue('--accent-blue').trim() || fallbackColors.rx,
            tx: styles.getPropertyValue('--accent-green').trim() || fallbackColors.tx,
            grid: styles.getPropertyValue('--color-border-soft').trim() || fallbackColors.grid,
            axis: styles.getPropertyValue('--color-text-muted').trim() || fallbackColors.axis,
            legend: styles.getPropertyValue('--color-text-primary').trim() || fallbackColors.legend
        };
    }, [theme]);

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

    const stats = useMemo(() => {
        if(!history.length) return { totalRx: 0, totalTx: 0, peakRx: 0, peakTx: 0 };

        const rxValues = history.map((d) => d.rx);
        const txValues = history.map((d) => d.tx);

        return {
            totalRx: calculateDelta ? (data?.rx || 0) : rxValues.reduce((sum, v) => sum + v, 0),
            totalTx: calculateDelta ? (data?.tx || 0) : txValues.reduce((sum, v) => sum + v, 0),
            peakRx: Math.max(...rxValues),
            peakTx: Math.max(...txValues)
        };
    }, [history, data, calculateDelta]);

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

    const emptyData: DataPoint[] = [{ time: '', rx: 0, tx: 0 }];

    return (
        <ChartContainer
            icon={Activity}
            title={title}
            isLoading={isLoading}
            stats={[
                { label: 'RX Total', value: formatSize(stats.totalRx) },
                { label: 'TX Total', value: formatSize(stats.totalTx) }
            ]}
            statsLoading={isLoading}
        >
            <ResponsiveContainer width='100%' height={height}>
                <AreaChart
                    data={history.length ? history : emptyData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id='colorNetRx' x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='5%' stopColor={chartColors.rx} stopOpacity={0.3} />
                            <stop offset='95%' stopColor={chartColors.rx} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id='colorNetTx' x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='5%' stopColor={chartColors.tx} stopOpacity={0.3} />
                            <stop offset='95%' stopColor={chartColors.tx} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray='3 3' stroke={chartColors.grid} />
                    <YAxis
                        stroke={chartColors.axis}
                        style={{ fontSize: '12px' }}
                        tickFormatter={(v) => formatSize(v)}
                    />
                    <Tooltip content={renderTooltip} />
                    <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '20px', color: chartColors.legend }}
                        iconType='circle'
                    />
                    <Area
                        type='monotone'
                        dataKey='rx'
                        stroke={chartColors.rx}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill='url(#colorNetRx)'
                        name='Received'
                        isAnimationActive={false}
                    />
                    <Area
                        type='monotone'
                        dataKey='tx'
                        stroke={chartColors.tx}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill='url(#colorNetTx)'
                        name='Transmitted'
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

export default NetworkChart;
