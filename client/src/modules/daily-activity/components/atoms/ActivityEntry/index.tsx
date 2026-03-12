import './ActivityEntry.css';
import Container from '@/shared/presentation/components/Container';
import { ACTIVITY_ICON, ACTIVITY_ACCENT } from '@/modules/daily-activity/utilities/activity-mappings';
import type { ActivityItem } from '@/modules/daily-activity/api/entities/daily-activity';
import type { FC, ReactNode } from 'react';

interface ActivityEntryProps {
    type: ActivityItem['type'];
    children: ReactNode;
    className?: string;
};

const ActivityEntry: FC<ActivityEntryProps> = ({ type, children, className = '' }) => (
    <Container className={`activity-entry ${className}`.trim()}>
        <span
            className='activity-entry-dot d-flex flex-center radius-md'
            style={{ color: ACTIVITY_ACCENT[type] }}
        >
            {ACTIVITY_ICON[type]}
        </span>
        <Container className='activity-entry-content'>
            {children}
        </Container>
    </Container>
);

export default ActivityEntry;
