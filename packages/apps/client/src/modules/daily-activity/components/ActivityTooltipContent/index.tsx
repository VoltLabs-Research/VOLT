import type { DailyActivityHeatmapDetailEntry } from '@/modules/daily-activity/contracts/heatmap';
import Scrollable from '@/shared/ui/components/Scrollable';

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
            <div className='flex flex-col gap-1'>
                <span className='text-sm font-medium text-foreground'>{dateLabel}</span>
                <span className='text-sm text-muted'>No recorded activity for this day.</span>
            </div>
        );
    }

    return (
        <Scrollable className='flex max-h-[400px] flex-col gap-3'>
            <div className='flex flex-col gap-1'>
                <span className='text-sm font-medium text-foreground'>{dateLabel}</span>
                <span className='text-xs text-muted'>
                    {activity.length.toLocaleString()} events · {minutesOnline.toLocaleString()} minutes online · score {score.toLocaleString()}
                </span>
            </div>
            {activity.map((item, index) => (
                <div className='flex min-w-0 flex-col gap-0.5' key={`${item.createdAt}-${index}`}>
                    <span className='text-xs text-muted'>
                        {item.userDisplayName} · {TIME_FORMATTER.format(new Date(item.createdAt))}
                    </span>
                    <span className='text-sm text-foreground'>{item.description}</span>
                </div>
            ))}
        </Scrollable>
    );
};

export default ActivityTooltipContent;
