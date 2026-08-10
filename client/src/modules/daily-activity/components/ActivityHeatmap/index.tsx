import useActivityHeatmap, { getDayAriaLabel, getDayTooltipState } from '@/modules/daily-activity/hooks/use-activity-heatmap';
import ActivityTooltipContent from '@/modules/daily-activity/components/ActivityTooltipContent';
import { ScrollShadow, Tooltip, cn } from '@heroui/react';
import type { DailyActivity } from '@volt/contracts/modules/daily-activity/domain';

interface ActivityHeatmapProps {
    data: DailyActivity[];
    range?: number;
};

/**
 * The sequential ramp, four strengths of the accent so it stays monotonic whatever
 * the accent is. The top step used to be the accent mixed towards black, which reads
 * as "more" only while the accent is a mid-tone blue: against a light-on-dark accent
 * that step is *darker* than the one below it and the ramp inverts.
 *
 * These were `fill:` on an `<svg><rect>`, which has no Tailwind utility at all — the
 * single reason this component needed a stylesheet. A grid of divs takes `background`.
 */
const LEVEL_CLASS_NAMES = [
    'bg-surface-tertiary',
    'bg-[color-mix(in_srgb,var(--accent)_25%,transparent)]',
    'bg-[color-mix(in_srgb,var(--accent)_45%,transparent)]',
    'bg-[color-mix(in_srgb,var(--accent)_70%,transparent)]',
    'bg-accent'
];

/**
 * Seven weekday rows, one auto column per week, filled column-major. `auto-cols-fr`
 * with a floor of 52rem is what the SVG's `width: 100%` over `min-width: 52rem` did:
 * stretch to fill a wide panel, scroll rather than shrink below that.
 */
const GRID_CLASS_NAMES = 'grid grid-rows-7 grid-flow-col auto-cols-fr gap-[5px] min-w-[52rem] max-[768px]:min-w-[42rem]';

const MONTH_ROW_CLASS_NAMES = 'grid grid-flow-col auto-cols-fr gap-[5px] min-w-[52rem] max-[768px]:min-w-[42rem]';

const CELL_CLASS_NAMES = 'aspect-square w-full rounded-xs cursor-pointer';

/**
 * HeroUI's tooltip is sized and worded for a one-line hint: `max-w-xs`, `p-2` and
 * `break-all`. This one carries a day's whole activity list, so it takes the panel
 * metrics the cursor tooltip had (350px, 12px of padding) and stops breaking words
 * mid-character. `break-normal`, not `break-words`: `break-all` is `word-break` and
 * `break-words` is `overflow-wrap`, so the two do not cancel — only `break-normal`
 * resets the property that is actually set. HeroUI's rules are in the `components`
 * layer, so a utility here wins without a specificity fight.
 */
const TOOLTIP_CLASS_NAMES = 'max-w-[350px] min-w-[200px] p-3 break-normal';

const ActivityHeatmap = ({ data, range = 365 }: ActivityHeatmapProps) => {
    const { cells, weeks, legendItems } = useActivityHeatmap({
        data,
        range
    });

    return (
        <div className='flex flex-col gap-3 h-full w-full' role='group' aria-label='Daily activity heatmap'>
            {/*
              * The two grids are direct children of the scroll container so they share
              * its origin and stay column-aligned. `min-w-*` on each makes them the
              * scrollable overflow; on a wide panel they stretch instead.
              */}
            <ScrollShadow orientation='horizontal' hideScrollBar className='flex w-full flex-col gap-1'>
                <div className={MONTH_ROW_CLASS_NAMES} aria-hidden='true'>
                    {weeks.map((week) => (
                        <span className='text-[11px] leading-none text-muted whitespace-nowrap' key={week.key}>
                            {week.monthLabel}
                        </span>
                    ))}
                </div>

                <div className={GRID_CLASS_NAMES}>
                    {cells.map((cell) => {
                        if (!cell.day) {
                            return <div className='aspect-square w-full' key={cell.key} aria-hidden='true' />;
                        }

                        return (
                            <Tooltip key={cell.key} delay={0} closeDelay={0}>
                                <Tooltip.Trigger
                                    role='img'
                                    aria-label={getDayAriaLabel(cell.day)}
                                    className={cn(CELL_CLASS_NAMES, LEVEL_CLASS_NAMES[cell.day.level])}
                                />
                                <Tooltip.Content className={TOOLTIP_CLASS_NAMES}>
                                    <ActivityTooltipContent {...getDayTooltipState(cell.day)} />
                                </Tooltip.Content>
                            </Tooltip>
                        );
                    })}
                </div>
            </ScrollShadow>

            <div className='flex flex-row items-center flex-wrap gap-3 gap-y-[0.35rem]'>
                {legendItems.map((item) => (
                    <div className='flex flex-row items-center gap-2 min-w-fit' key={item.label}>
                        <span
                            className={cn('inline-flex size-3.5 shrink-0 rounded-sm border border-border', LEVEL_CLASS_NAMES[item.level])}
                            aria-hidden='true'
                        />
                        <span className='text-xs text-muted'>{item.label}</span>
                    </div>
                ))}
            </div>

            <span className='text-xs text-muted leading-[1.4]'>Focus or hover a day to inspect activity details.</span>
        </div>
    );
};

export default ActivityHeatmap;
