import Container from '@/shared/presentation/components/Container';
import ActivityEntry from '@/modules/daily-activity/components/atoms/ActivityEntry';
import { format } from 'date-fns';
import type { ActivityItem } from '@/modules/daily-activity/api/entities/daily-activity';
import type { FC } from 'react';

interface ActivityTooltipContentProps {
    activity: ActivityItem[];
};

const ActivityTooltipContent: FC<ActivityTooltipContentProps> = ({ activity }) => {
    if(!activity.length){
        return <span className='color-secondary font-size-2'>No activity</span>;
    }

    return (
        <Container className='d-flex column gap-1 y-scroll activity-tooltip-content'>
            {activity.map((item, index) => (
                <ActivityEntry
                    key={`${item.createdAt}-${index}`}
                    type={item.type}
                >
                    <span className='font-size-1 color-secondary'>
                        {format(new Date(item.createdAt), 'HH:mm')}
                    </span>
                    <span className='font-size-2 color-primary'>{item.description}</span>
                </ActivityEntry>
            ))}
        </Container>
    );
};

export default ActivityTooltipContent;
