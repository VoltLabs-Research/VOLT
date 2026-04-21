import { useMemo } from 'react';
import { AreaChart, Area, YAxis, ResponsiveContainer } from 'recharts';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';

interface TinyLineChartProps {
    lineColor: string;
    xLabels: string[];
    pData: number[];
    yDomain?: { min: number; max: number };
    width?: number;
    height?: number;
};

interface TinyLineChartDatum {
    label: string;
    value: number;
};

const TinyLineChart = ({
    lineColor,
    xLabels,
    pData,
    yDomain,
    width = 300,
    height = 80
}: TinyLineChartProps) => {
    const prefersReducedMotion = usePrefersReducedMotion();

    const chartData = useMemo<TinyLineChartDatum[]>(() => {
        const length = Math.max(xLabels?.length || 0, pData?.length || 0);
        return Array.from({ length }, (_, i) => {
            const raw = Number(pData?.[i]);
            return {
                label: xLabels?.[i] ?? '',
                value: Number.isFinite(raw) ? raw : 0
            };
        });
    }, [xLabels, pData]);

    const gradientId = useMemo(
        () => `tiny-line-gradient-${Math.random().toString(36).slice(2, 11)}`,
        []
    );

    const yAxisDomain: [number | 'auto', number | 'auto'] = [
        yDomain?.min ?? 'auto',
        yDomain?.max ?? 'auto'
    ];

    return (
        <ResponsiveContainer width={width} height={height}>
            <AreaChart
                data={chartData}
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            >
                <defs>
                    <linearGradient id={gradientId} x1='0' y1='0' x2='0' y2='1'>
                        <stop offset='0%' stopColor={lineColor} stopOpacity={0.25} />
                        <stop offset='100%' stopColor={lineColor} stopOpacity={0.25} />
                    </linearGradient>
                </defs>
                <YAxis hide domain={yAxisDomain} />
                <Area
                    type='linear'
                    dataKey='value'
                    stroke={lineColor}
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    fillOpacity={1}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={!prefersReducedMotion}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
};

export default TinyLineChart;
