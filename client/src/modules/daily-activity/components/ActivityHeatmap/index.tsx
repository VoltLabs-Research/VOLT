import useActivityHeatmap, { getDayAriaLabel, getDayTooltipState } from './use-activity-heatmap';
import ActivityTooltipContent from '@/modules/daily-activity/components/ActivityTooltipContent';
import { ScrollShadow, Tooltip, cn } from '@heroui/react';
import type { DailyActivity } from '@volt/contracts/modules/daily-activity/domain';

interface ActivityHeatmapProps {
    data: DailyActivity[];
    range?: number;
};

const ActivityHeatmap = ({ data, range = 365 }: ActivityHeatmapProps) => {
    const { cells, weeks } = useActivityHeatmap({
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
        <ScrollShadow
            orientation='horizontal'
            hideScrollBar
            className='flex w-full flex-col gap-1'
            role='group'
            aria-label='Daily activity heatmap'
        >
            <div className='grid w-max grid-flow-col auto-cols-[0.625rem] gap-1' aria-hidden='true'>
                {weeks.map((week) => (
                    <span className='text-2xs leading-none text-muted whitespace-nowrap' key={week.key}>
                        {week.monthLabel}
                    </span>
                ))}
            </div>
            <div className='grid w-max grid-rows-7 grid-flow-col auto-cols-[0.625rem] gap-1'>
                {cells.map((cell) => {
                    if (!cell.day) {
                        return <div className='size-2.5' key={cell.key} aria-hidden='true' />;
                    }

                    return (
                        <Tooltip key={cell.key} delay={0} closeDelay={0}>
                            <Tooltip.Trigger
                                role='img'
                                aria-label={getDayAriaLabel(cell.day)}
                                className={cn('size-2.5 rounded-sm cursor-pointer', levelClassNames[cell.day.level])}
                            />
                            <Tooltip.Content className='max-w-[350px] min-w-[200px] p-3 break-normal'>
                                <ActivityTooltipContent {...getDayTooltipState(cell.day)} />
                            </Tooltip.Content>
                        </Tooltip>
                    );
                })}
            </div>
        </ScrollShadow>
    );
};

export default ActivityHeatmap;
