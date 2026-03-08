import type { ReactNode } from 'react';
import { format } from 'date-fns';
import Container from '@/shared/presentation/components/Container';
import type { ActivityItem } from '../api/entities/daily-activity';

// TODO: THIS SHOULD BE A COMPONENT 
const formatActivityTooltip = (activity: ActivityItem[]): ReactNode => {
    if(!activity.length){
        return <span className='color-secondary font-size-2'>No activity</span>;
    }

    return (
        <Container className='d-flex column gap-1 y-scroll activity-tooltip-content'>
            {activity.map((item, index) => (
                <Container key={`${item.createdAt}-${index}`} className='d-flex column gap-025'>
                    <span className='font-size-1 color-secondary'>
                        {format(new Date(item.createdAt), 'HH:mm')}
                    </span>
                    <span className='font-size-2 color-primary'>{item.description}</span>
                </Container>
            ))}
        </Container>
    );
};

export default formatActivityTooltip;
