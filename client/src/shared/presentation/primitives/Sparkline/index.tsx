import { useId, useMemo } from 'react';
import { AreaChart, Area, YAxis, ResponsiveContainer } from 'recharts';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';

export interface SparklineProps {
    color: string;
    values: number[];
    labels?: string[];
    yDomain?: { min: number; max: number };
    width?: number | `${number}%`;
    height?: number;
    strokeWidth?: number;
    fillOpacityStart?: number;
    fillOpacityEnd?: number;
    interpolation?: 'linear' | 'monotone';
    animate?: boolean;
    minDataMax?: number;
};

interface SparklineDatum {
    label: string;
    value: number;
};

const Sparkline = ({
    color,
    values,
    labels,
    yDomain,
    width = '100%',
    height = 80,
    strokeWidth = 2,
    fillOpacityStart = 0.25,
    fillOpacityEnd = 0.25,
    interpolation = 'linear',
    animate,
    minDataMax
}: SparklineProps) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const gradientId = useId();
    const fillId = `${gradientId}-sparkline-fill`;

    const chartData = useMemo<SparklineDatum[]>(() => {
        if (!values.length) {
            return [{ label: '', value: 0 }, { label: '', value: 0 }];
        }
        if (values.length === 1) {
            const only = Number.isFinite(values[0]) ? values[0] : 0;
            return [{ label: labels?.[0] ?? '', value: only }, { label: labels?.[0] ?? '', value: only }];
        }
        const length = Math.max(labels?.length || 0, values.length);
        return Array.from({ length }, (_, i) => {
            const raw = Number(values[i]);
            return {
                label: labels?.[i] ?? '',
                value: Number.isFinite(raw) ? raw : 0
            };
        });
    }, [values, labels]);

    const yAxisDomain: [number | string | ((v: number) => number), number | string | ((v: number) => number)] = yDomain
        ? [yDomain.min, yDomain.max]
        : minDataMax !== undefined
            ? ['dataMin', (max: number) => Math.max(max, minDataMax)]
            : ['auto', 'auto'];

    const isAnimationActive = animate !== undefined ? animate : !prefersReducedMotion;

    return (
        <ResponsiveContainer width={width} height={height}>
            <AreaChart
                data={chartData}
                margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
            >
                <defs>
                    <linearGradient id={fillId} x1='0' y1='0' x2='0' y2='1'>
                        <stop offset='0%' stopColor={color} stopOpacity={fillOpacityStart} />
                        <stop offset='100%' stopColor={color} stopOpacity={fillOpacityEnd} />
                    </linearGradient>
                </defs>
                <YAxis hide domain={yAxisDomain} />
                <Area
                    type={interpolation}
                    dataKey='value'
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill={`url(#${fillId})`}
                    fillOpacity={1}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={isAnimationActive}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
};

export default Sparkline;
