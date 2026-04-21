import ActivityEntry from '@/modules/daily-activity/components/ActivityEntry';
import type { DailyActivityHeatmapDetailEntry } from '@/modules/daily-activity/api/entities/daily-activity';
import { useMemo } from 'react';
import type { FC } from 'react';

interface ActivityTooltipContentProps {
    activity: DailyActivityHeatmapDetailEntry[];
    dateLabel: string;
    minutesOnline: number;
    score: number;
};

const ActivityTooltipContent: FC<ActivityTooltipContentProps> = ({ activity, dateLabel, minutesOnline, score }) => {
    const timeFormatter = useMemo(() => {
        return new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: '2-digit'
        });
    }, []);

    if (!activity.length) {
        return (
            <div className='volt-container d-flex column gap-05 activity-tooltip-content'>
                <span className='font-size-2 font-weight-5 color-primary'>{dateLabel}</span>
                <span className='color-secondary font-size-2'>No recorded activity for this day.</span>
            </div>
        );
    }

    return (
        <div className='volt-container d-flex column gap-1 y-scroll activity-tooltip-content'>
            <div className='volt-container d-flex column gap-025'>
                <span className='font-size-2 font-weight-5 color-primary'>{dateLabel}</span>
                <span className='font-size-1 color-secondary'>
                    {activity.length.toLocaleString()} events · {minutesOnline.toLocaleString()} minutes online · score {score.toLocaleString()}
                </span>
            </div>
            {activity.map((item, index) => (
                <ActivityEntry
                    key={`${item.createdAt}-${index}`}
                    type={item.type}
                >
                    <span className='font-size-1 color-secondary'>
                        {item.userDisplayName} · {timeFormatter.format(new Date(item.createdAt))}
                    </span>
                    <span className='font-size-2 color-primary'>{item.description}</span>
                </ActivityEntry>
            ))}
        </div>
    );
};

export default ActivityTooltipContent;
