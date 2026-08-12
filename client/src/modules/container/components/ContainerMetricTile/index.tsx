import { cn } from '@heroui/react';
import { useId } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';

interface MetricSecondaryStat {
    label: string;
    value: string;
}

interface ContainerMetricTileProps {
    label: string;
    value: string;
    badge?: string;
    secondary?: MetricSecondaryStat[];
    history: number[];
    color: string;
    isLoading?: boolean;
    idleHint?: string;
}

const SPARKLINE_HEIGHT = 32;

interface SparklinePoint {
    value: number;
}

const toSparklineData = (values: number[]): SparklinePoint[] => {
    if (!values.length) {
        return [{ value: 0 }, { value: 0 }];
    }

    if (values.length === 1) {
        const only = Number.isFinite(values[0]) ? values[0] : 0;
        return [{ value: only }, { value: only }];
    }

    return values.map((entry) => {
        const raw = Number(entry);
        return { value: Number.isFinite(raw) ? raw : 0 };
    });
};

const MIN_DATA_MAX = 1;
const SPARKLINE_DOMAIN: [string, (dataMax: number) => number] = ['dataMin', (dataMax: number) => Math.max(dataMax, MIN_DATA_MAX)];
const SPARKLINE_MARGIN = {
    top: 2,
    right: 0,
    left: 0,
    bottom: 0
};

const ContainerMetricTile = ({
    label,
    value,
    badge,
    secondary,
    history,
    color,
    isLoading = false,
    idleHint = 'Idle'
}: ContainerMetricTileProps) => {
    const fillId = `${useId()}-sparkline-fill`;
    const hasHistory = history.length > 0;
    const isIdle = isLoading || !hasHistory;
    const displayValue = hasHistory ? value : idleHint;

    return (
        <div className='flex min-w-0 flex-col gap-3 rounded-xl border border-border p-6'>
            <div className='flex flex-row items-center gap-2'>
                <span className='text-2xs font-semibold uppercase leading-none tracking-[0.05em] text-muted'>{label}</span>
            </div>
            <div className='flex flex-row items-baseline gap-2 tabular-nums'>
                <span className={cn('text-3xl leading-[1.15]', isIdle ? 'font-normal text-muted' : 'font-semibold text-foreground')}>
                    <span aria-label={`${label} ${displayValue}`}>{displayValue}</span>
                </span>
                {badge && <span className='inline-flex items-center text-xs font-medium tabular-nums text-muted'>{badge}</span>}
            </div>
            <div className='pt-1'>
                <div className='pointer-events-none h-8 w-full' aria-hidden='true'>
                    <ResponsiveContainer width='100%' height={SPARKLINE_HEIGHT}>
                        <AreaChart data={toSparklineData(history)} margin={SPARKLINE_MARGIN}>
                            <defs>
                                <linearGradient id={fillId} x1='0' y1='0' x2='0' y2='1'>
                                    <stop offset='0%' stopColor={color} stopOpacity={0.18} />
                                    <stop offset='100%' stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <YAxis hide domain={SPARKLINE_DOMAIN} />
                            <Area
                                type='monotone'
                                dataKey='value'
                                stroke={color}
                                strokeWidth={1.5}
                                fill={`url(#${fillId})`}
                                fillOpacity={1}
                                dot={false}
                                activeDot={false}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {secondary && secondary.length > 0 && (
                    <div className='flex flex-row flex-wrap items-center text-xs leading-[1.2] lining-nums tabular-nums text-muted'>
                        {secondary.map((stat, index) => (
                            <span className='flex flex-row items-center' key={stat.label}>
                                {index > 0 && <span className='mx-1.5 opacity-40' aria-hidden='true'>·</span>}
                                <span>
                                    {stat.label} <span className='text-muted'>{stat.value}</span>
                                </span>
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ContainerMetricTile;
