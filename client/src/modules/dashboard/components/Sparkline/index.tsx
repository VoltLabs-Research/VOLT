import { usePrefersReducedMotion } from '@/shared/ui/hooks/use-prefers-reduced-motion';
import { useId } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';

interface SparklineProps {
    color: string;
    values: number[];
    labels?: string[];
    yDomain?: {
        min: number;
        max: number;
    };
    width?: number | `${number}%`;
    height?: number;
    strokeWidth?: number;
    fillOpacityStart?: number;
    fillOpacityEnd?: number;
    interpolation?: 'linear' | 'monotone';
    animate?: boolean;
};

interface SparklinePoint {
    label: string;
    value: number;
};

const toChartData = (values: number[], labels?: string[]): SparklinePoint[] => {
    if (!values.length) {
        return [
            {
                label: '',
                value: 0
            },
            {
                label: '',
                value: 0
            }
        ];
    }

    if (values.length === 1) {
        const only = Number.isFinite(values[0]) ? values[0] : 0;

        return [
            {
                label: labels?.[0] ?? '',
                value: only
            },
            {
                label: labels?.[0] ?? '',
                value: only
            }
        ];
    }

    const length = Math.max(labels?.length || 0, values.length);

    return Array.from({ length }, (_, index) => {
        const raw = Number(values[index]);

        return {
            label: labels?.[index] ?? '',
            value: Number.isFinite(raw) ? raw : 0
        };
    });
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
    animate
}: SparklineProps) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const fillId = `${useId()}-sparkline-fill`;

    const chartData = toChartData(values, labels);
    const yAxisDomain: [number, number] | ['auto', 'auto'] = yDomain
        ? [yDomain.min, yDomain.max]
        : ['auto', 'auto'];
    const isAnimationActive = animate !== undefined ? animate : !prefersReducedMotion;

    return (
        <ResponsiveContainer width={width} height={height}>
            <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
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
