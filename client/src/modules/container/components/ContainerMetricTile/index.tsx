import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { useId, useMemo } from 'react';
import './ContainerMetricTile.css';

export interface MetricSecondaryStat {
    label: string;
    value: string;
};

export interface ContainerMetricTileProps {
    label: string;
    value: string;
    badge?: string;
    secondary?: MetricSecondaryStat[];
    history: number[];
    color: string;
    isLoading?: boolean;
    idleHint?: string;
};

const SPARKLINE_HEIGHT = 32;

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
    const gradientId = useId();
    const fillId = `${gradientId}-metric-fill`;

    const sparklineData = useMemo(() => {
        if (!history.length) {
            return [{ v: 0 }, { v: 0 }];
        }

        if (history.length === 1) {
            return [{ v: history[0] }, { v: history[0] }];
        }

        return history.map((v) => ({ v }));
    }, [history]);

    const hasHistory = history.length > 0;
    const stateClass = isLoading || !hasHistory ? 'container-metric-tile--idle' : '';

    return (
        <div className={`volt-container container-metric-tile d-flex column gap-05 ${stateClass}`}>
            <div className='volt-container d-flex items-baseline content-between gap-05'>
                <span className='container-metric-tile-label'>{label}</span>
                {badge && <span className='container-metric-tile-badge'>{badge}</span>}
            </div>

            <span className='container-metric-tile-value' aria-label={`${label} ${hasHistory ? value : idleHint}`}>
                {hasHistory ? value : idleHint}
            </span>

            <div className='volt-container container-metric-tile-sparkline' aria-hidden='true'>
                <ResponsiveContainer width='100%' height={SPARKLINE_HEIGHT}>
                    <AreaChart
                        data={sparklineData}
                        margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id={fillId} x1='0' y1='0' x2='0' y2='1'>
                                <stop offset='0%' stopColor={color} stopOpacity={0.18} />
                                <stop offset='100%' stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <YAxis hide domain={['dataMin', (max: number) => Math.max(max, 1)]} />
                        <Area
                            type='monotone'
                            dataKey='v'
                            stroke={color}
                            strokeWidth={1.5}
                            fill={`url(#${fillId})`}
                            isAnimationActive={false}
                            dot={false}
                            activeDot={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {secondary && secondary.length > 0 && (
                <div className='volt-container container-metric-tile-secondary d-flex items-center flex-wrap'>
                    {secondary.map((stat, index) => (
                        <span key={stat.label} className='d-flex items-center'>
                            {index > 0 && <span className='container-metric-tile-secondary-dot' aria-hidden='true'>·</span>}
                            <span>
                                {stat.label} <span className='color-secondary'>{stat.value}</span>
                            </span>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ContainerMetricTile;
