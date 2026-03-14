import Container from '@/shared/presentation/components/Container';
import ActivityEntry from '@/modules/daily-activity/components/atoms/ActivityEntry';
import type { ActivityItem } from '@/modules/daily-activity/api/entities/daily-activity';
import { useMemo } from 'react';
import type { FC } from 'react';

interface ActivityTooltipContentProps {
    activity: ActivityItem[];
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
            <Container className='d-flex column gap-05 activity-tooltip-content'>
                <span className='font-size-2 font-weight-5 color-primary'>{dateLabel}</span>
                <span className='color-secondary font-size-2'>No recorded activity for this day.</span>
            </Container>
        );
    }

    return (
        <Container className='d-flex column gap-1 y-scroll activity-tooltip-content'>
            <Container className='d-flex column gap-025'>
                <span className='font-size-2 font-weight-5 color-primary'>{dateLabel}</span>
                <span className='font-size-1 color-secondary'>
                    {activity.length.toLocaleString()} events · {minutesOnline.toLocaleString()} minutes online · score {score.toLocaleString()}
                </span>
            </Container>
            {activity.map((item, index) => (
                <ActivityEntry
                    key={`${item.createdAt}-${index}`}
                    type={item.type}
                >
                    <span className='font-size-1 color-secondary'>
                        {timeFormatter.format(new Date(item.createdAt))}
                    </span>
                    <span className='font-size-2 color-primary'>{item.description}</span>
                </ActivityEntry>
            ))}
        </Container>
    );
};

export default ActivityTooltipContent;
