import useActivityHeatmap, { getDayAriaLabel, getDayTooltipState } from './use-activity-heatmap';
import ActivityTooltipContent from '@/modules/daily-activity/components/ActivityTooltipContent';
import { ScrollShadow, Tooltip, cn } from '@heroui/react';
import type { DailyActivity } from '@volt/contracts/modules/daily-activity/domain';

interface ActivityHeatmapProps {
    data: DailyActivity[];
    range?: number;
};

const ActivityHeatmap = ({ data, range = 365 }: ActivityHeatmapProps) => {
    const { cells, weeks, legendItems } = useActivityHeatmap({
        data,
        range
    });

    const levelClassNames = [
        'bg-surface-tertiary',
        'bg-[color-mix(in_srgb,var(--accent)_25%,transparent)]',
        'bg-[color-mix(in_srgb,var(--accent)_45%,transparent)]',
        'bg-[color-mix(in_srgb,var(--accent)_70%,transparent)]',
        'bg-accent'
    ];

    return (
        <div className='flex flex-col gap-3 h-full w-full' role='group' aria-label='Daily activity heatmap'>
            <ScrollShadow orientation='horizontal' hideScrollBar className='flex w-full flex-col gap-1'>
                <div className='grid grid-flow-col auto-cols-fr gap-1 min-w-[52rem] max-[768px]:min-w-[42rem]' aria-hidden='true'>
                    {weeks.map((week) => (
                        <span className='text-2xs leading-none text-muted whitespace-nowrap' key={week.key}>
                            {week.monthLabel}
                        </span>
                    ))}
                </div>
                <div className='grid grid-rows-7 grid-flow-col auto-cols-fr gap-1 min-w-[52rem] max-[768px]:min-w-[42rem]'>
                    {cells.map((cell) => {
                        if (!cell.day) {
                            return <div className='aspect-square w-full' key={cell.key} aria-hidden='true' />;
                        }

                        return (
                            <Tooltip key={cell.key} delay={0} closeDelay={0}>
                                <Tooltip.Trigger
                                    role='img'
                                    aria-label={getDayAriaLabel(cell.day)}
                                    className={cn('aspect-square w-full rounded-sm cursor-pointer', levelClassNames[cell.day.level])}
                                />
                                <Tooltip.Content className='max-w-[350px] min-w-[200px] p-3 break-normal'>
                                    <ActivityTooltipContent {...getDayTooltipState(cell.day)} />
                                </Tooltip.Content>
                            </Tooltip>
                        );
                    })}
                </div>
            </ScrollShadow>
            <div className='flex flex-row items-center flex-wrap gap-3 gap-y-1.5'>
                {legendItems.map((item) => (
                    <div className='flex flex-row items-center gap-2 min-w-fit' key={item.label}>
                        <span
                            className={cn('inline-flex size-3.5 shrink-0 rounded-sm border border-border', levelClassNames[item.level])}
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
