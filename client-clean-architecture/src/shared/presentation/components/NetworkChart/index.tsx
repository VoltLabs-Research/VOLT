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
import ChartContainer from '@/shared/presentation/components/ChartContainer';
import ChartTooltip from '@/shared/presentation/components/ChartTooltip';
import { formatSize } from '@/shared/utils/format';

const MAX_HISTORY_POINTS = 60;

const CHART_COLORS = {
    rx: '#0A84FF',
    tx: '#30D158'
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

const formatTime = (date: Date): string => {
    const h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
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

    const renderTooltip = ({ active, payload }: any) => {
        if(!active || !payload?.length) return null;

        return (
            <ChartTooltip
                title={payload[0].payload.time}
                items={payload.map((entry: any) => ({
                    label: entry.name,
                    value: formatSize(entry.value),
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
                            <stop offset='5%' stopColor={CHART_COLORS.rx} stopOpacity={0.3} />
                            <stop offset='95%' stopColor={CHART_COLORS.rx} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id='colorNetTx' x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='5%' stopColor={CHART_COLORS.tx} stopOpacity={0.3} />
                            <stop offset='95%' stopColor={CHART_COLORS.tx} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray='3 3' stroke='var(--color-border-soft)' />
                    <YAxis
                        stroke='var(--color-text-muted)'
                        style={{ fontSize: '12px' }}
                        tickFormatter={(v) => formatSize(v)}
                    />
                    <Tooltip content={renderTooltip} />
                    <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                        iconType='circle'
                    />
                    <Area
                        type='monotone'
                        dataKey='rx'
                        stroke={CHART_COLORS.rx}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill='url(#colorNetRx)'
                        name='Received'
                        isAnimationActive={false}
                    />
                    <Area
                        type='monotone'
                        dataKey='tx'
                        stroke={CHART_COLORS.tx}
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
