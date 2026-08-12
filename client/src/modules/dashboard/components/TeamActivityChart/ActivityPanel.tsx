import { Area, AreaChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatBucketTick } from '@/modules/dashboard/utils/metric-buckets';
import type { DashboardRangeOption } from '@/modules/dashboard/contracts/range';
import type { TeamActivityPoint } from '@/modules/dashboard/hooks/use-team-activity-series';

/*
 * Small multiples: three panels, one measure each, sharing a single x-axis drawn
 * once under the last one. Deliberately NOT three series on one plot — actions
 * per bucket and trajectories per bucket differ by an order of magnitude, and
 * two y-scales on one axis would invent a correlation that is not in the data.
 *
 * Every panel therefore carries one series, so no color is asked to carry
 * identity: the row label does that, and the mark can stay a single quiet hue.
 */

/** Buckets up to this many points get a visible dot per bucket. */
const DOT_VISIBILITY_LIMIT = 14;

const PLOT_HEIGHT = 64;
const AXIS_BAND_HEIGHT = 24;

/*
 * Smallest top of the y-scale. Without it a series that only ever holds 0 or 1
 * swings the full height of the panel and a ±1 wobble reads as a mountain
 * range — the exact overstatement the old min/max sparkline domain produced.
 * Series above this are unaffected, so it costs nothing on a busy team.
 */
const MIN_Y_CEILING = 4;

const MARK_COLOR = 'var(--accent)';

export interface ActivityPanelProps {
    label: string;
    dataKey: 'trajectories' | 'analyses' | 'actions';
    points: TeamActivityPoint[];
    range: DashboardRangeOption;
    /** Bucket value under the cursor, or the window total when idle. */
    readout: string;
    readoutLabel: string;
    showAxis: boolean;
    animate: boolean;
    /**
     * Shared by the panels of one card so the cursor crosses all three. Scoped
     * to the card instance rather than a constant: recharts treats syncId as a
     * global channel, so a second card on the page would otherwise move this
     * one's crosshair too.
     */
    syncId: string;
    onActiveIndexChange: (index: number | null) => void;
}

const ActivityPanel = ({
    label,
    dataKey,
    points,
    range,
    readout,
    readoutLabel,
    showAxis,
    animate,
    syncId,
    onActiveIndexChange
}: ActivityPanelProps) => {
    const lastPoint = points[points.length - 1];
    const showDots = points.length <= DOT_VISIBILITY_LIMIT;
    const gradientId = `${syncId}-${dataKey}`;

    return (
        <div className='flex flex-col gap-1'>
            <div className='flex flex-row items-baseline justify-between gap-4'>
                <span className='text-xs font-medium text-muted'>{label}</span>
                <span className='flex flex-row items-baseline gap-1.5'>
                    <span className='tabular-nums lining-nums text-sm font-medium text-foreground'>
                        {readout}
                    </span>
                    <span className='text-2xs text-muted'>{readoutLabel}</span>
                </span>
            </div>

            {/*
              * The container is sized to include the axis band on the last panel;
              * a plot-only height would push the tick labels into a nested scroll.
              */}
            <div className='border-b border-border'>
                <ResponsiveContainer
                    width='100%'
                    height={showAxis ? PLOT_HEIGHT + AXIS_BAND_HEIGHT : PLOT_HEIGHT}
                >
                    <AreaChart
                        data={points}
                        syncId={syncId}
                        /* Side margins leave room for the first and last tick labels to sit centred. */
                        margin={{ top: 2, right: 14, left: 14, bottom: 0 }}
                        onMouseMove={(state) => {
                            /* recharts types this as number | string | undefined. */
                            const index = Number(state?.activeTooltipIndex);

                            onActiveIndexChange(Number.isFinite(index) ? index : null);
                        }}
                        onMouseLeave={() => onActiveIndexChange(null)}
                    >
                        <defs>
                            <linearGradient id={gradientId} x1='0' y1='0' x2='0' y2='1'>
                                <stop offset='0%' stopColor={MARK_COLOR} stopOpacity={0.16} />
                                <stop offset='100%' stopColor={MARK_COLOR} stopOpacity={0.02} />
                            </linearGradient>
                        </defs>

                        {/* Zero baseline, always: a min/max domain turns 3,4,3 into a mountain range. */}
                        <YAxis
                            hide
                            domain={[0, (dataMax: number) => Math.max(dataMax, MIN_Y_CEILING)]}
                        />

                        <XAxis
                            dataKey='label'
                            hide={!showAxis}
                            height={AXIS_BAND_HEIGHT}
                            stroke='var(--border)'
                            tick={{ fill: 'var(--muted)', fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={40}
                            /*
                             * Without this recharts drops the first tick, so a 7-bucket
                             * window showed six labels and the reader could not tell
                             * where the window started. Both ends are always kept.
                             */
                            interval='preserveStartEnd'
                            tickFormatter={(value: string) => formatBucketTick(value, range.bucket, range.days)}
                        />

                        {/*
                          * Content renders nothing on purpose — the panel headers are the
                          * readout. This Tooltip exists so recharts draws the synced
                          * cursor line across all three panels at the same bucket.
                          */}
                        <Tooltip
                            content={() => null}
                            cursor={{
                                stroke: 'var(--border-secondary)',
                                strokeWidth: 1
                            }}
                        />

                        <Area
                            type='linear'
                            dataKey={dataKey}
                            stroke={MARK_COLOR}
                            strokeWidth={2}
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            fill={`url(#${gradientId})`}
                            fillOpacity={1}
                            dot={showDots ? { r: 2, fill: MARK_COLOR, strokeWidth: 0 } : false}
                            activeDot={{
                                r: 4,
                                fill: MARK_COLOR,
                                stroke: 'var(--surface)',
                                strokeWidth: 2
                            }}
                            isAnimationActive={animate}
                        />

                        {/* The current bucket gets the end-dot, with a surface ring so it stays legible. */}
                        {lastPoint && (
                            <ReferenceDot
                                x={lastPoint.label}
                                y={lastPoint[dataKey]}
                                r={4}
                                fill={MARK_COLOR}
                                stroke='var(--surface)'
                                strokeWidth={2}
                            />
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ActivityPanel;
