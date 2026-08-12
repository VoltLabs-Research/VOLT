import { ACTIVITY_ICON, ACTIVITY_ACCENT } from '@/modules/daily-activity/utils/activity-mappings';
import type { DailyActivityHeatmapDetailEntry } from '@/modules/daily-activity/contracts/heatmap';

interface ActivityTooltipContentProps {
    activity: DailyActivityHeatmapDetailEntry[];
    dateLabel: string;
    minutesOnline: number;
    score: number;
};

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
});

const ActivityTooltipContent = ({ activity, dateLabel, minutesOnline, score }: ActivityTooltipContentProps) => {
    if (!activity.length) {
        return (
            <div className='flex flex-col gap-2'>
                <span className='text-sm font-medium text-foreground'>{dateLabel}</span>
                <span className='text-sm text-muted'>No recorded activity for this day.</span>
            </div>
        );
    }

    return (
        <div className='flex flex-col gap-4 max-h-[400px] overflow-y-scroll'>
            <div className='flex flex-col gap-1'>
                <span className='text-sm font-medium text-foreground'>{dateLabel}</span>
                <span className='text-xs text-muted'>
                    {activity.length.toLocaleString()} events · {minutesOnline.toLocaleString()} minutes online · score {score.toLocaleString()}
                </span>
            </div>
            {activity.map((item, index) => (
                <div className='flex items-start gap-2' key={`${item.createdAt}-${index}`}>
                    <span
                        className='flex size-[22px] shrink-0 items-center justify-center rounded-xl border border-border bg-surface-tertiary'
                        style={{ color: ACTIVITY_ACCENT[item.type] }}
                    >
                        {ACTIVITY_ICON[item.type]}
                    </span>
                    <div className='flex flex-col min-w-0 gap-0.5'>
                        <span className='text-xs text-muted'>
                            {item.userDisplayName} · {TIME_FORMATTER.format(new Date(item.createdAt))}
                        </span>
                        <span className='text-sm text-foreground'>{item.description}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ActivityTooltipContent;
