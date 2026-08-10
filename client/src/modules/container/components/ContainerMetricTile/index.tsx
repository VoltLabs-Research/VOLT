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

/**
 * bravais's `StatCard` at `surface='soft' tabular`, flattened into the one shape
 * this tile ever used.
 *
 * Two things the card did through CSS rather than through classes, and that a
 * class-level rewrite would silently lose:
 *
 *   • the label was `.text-eyebrow` — 0.7rem/600/uppercase/0.05em, muted — with
 *     `line-height: 1` on top. Losing that class changes every metric label's
 *     casing, so it is spelled out here.
 *   • the value and unit both pinned `line-height: 1.15`.
 *
 * The value row emitted `items-center items-baseline` from bravais's un-merged
 * `cn`; Tailwind's sheet order made `items-baseline` the winner, so only that one
 * is emitted here.
 *
 * `.container-metric-tile--idle .volt-stat-card__value` reached into the card's
 * internal value node to mute it and drop it to weight 400. That override now
 * lives on the value span itself, as the two-branch lookup below.
 */
const TILE_CLASS_NAMES = 'flex min-w-0 flex-col gap-3 rounded-xl border border-border p-6';
const LABEL_CLASS_NAMES = 'text-[0.7rem] font-semibold uppercase leading-none tracking-[0.05em] text-muted';
const VALUE_CLASS_NAMES = 'text-3xl leading-[1.15]';
const VALUE_READY_CLASS_NAMES = 'font-semibold text-foreground';
const VALUE_IDLE_CLASS_NAMES = 'font-normal text-muted';
const BADGE_CLASS_NAMES = 'inline-flex items-center text-xs font-medium tabular-nums text-muted';
const SECONDARY_CLASS_NAMES = 'flex flex-row flex-wrap items-center text-xs leading-[1.2] lining-nums tabular-nums text-muted';
const SEPARATOR_DOT_CLASS_NAMES = 'mx-[0.4rem] opacity-40';

interface SparklinePoint {
    value: number;
}

/**
 * bravais's `Sparkline` normalisation, kept verbatim because "empty" is not
 * empty: no values draws two zero points (a flat line on the baseline) and a
 * single value is duplicated so there is a segment to draw at all. Non-finite
 * numbers coerce to 0.
 */
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

/**
 * `minDataMax={1}` at the call site: the top of the domain is the data max, but
 * never below 1, so an all-zero series does not blow the y-scale up to fill the
 * band. `margin.top = 2` keeps the 1.5px stroke from being clipped.
 */
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
    /*
     * The gradient id is per-instance, as bravais's was. A module constant would
     * make every tile on the page share one `<linearGradient>` and take the first
     * one's colour.
     */
    const fillId = `${useId()}-sparkline-fill`;
    const hasHistory = history.length > 0;
    const isIdle = isLoading || !hasHistory;
    const displayValue = hasHistory ? value : idleHint;

    return (
        <div className={TILE_CLASS_NAMES}>
            <div className='flex flex-row items-center gap-2'>
                <span className={LABEL_CLASS_NAMES}>{label}</span>
            </div>

            <div className='flex flex-row items-baseline gap-2 tabular-nums'>
                <span className={cn(VALUE_CLASS_NAMES, isIdle ? VALUE_IDLE_CLASS_NAMES : VALUE_READY_CLASS_NAMES)}>
                    <span aria-label={`${label} ${displayValue}`}>{displayValue}</span>
                </span>
                {badge && <span className={BADGE_CLASS_NAMES}>{badge}</span>}
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
                    <div className={SECONDARY_CLASS_NAMES}>
                        {secondary.map((stat, index) => (
                            <span className='flex flex-row items-center' key={stat.label}>
                                {index > 0 && <span className={SEPARATOR_DOT_CLASS_NAMES} aria-hidden='true'>·</span>}
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
