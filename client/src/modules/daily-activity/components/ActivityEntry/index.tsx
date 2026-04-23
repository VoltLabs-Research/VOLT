import './ActivityEntry.css';
import { ACTIVITY_ICON, ACTIVITY_ACCENT } from '@/modules/daily-activity/utilities/activity-mappings';
import { Box } from '@/shared/presentation/primitives';
import type { ActivityItem } from '@/modules/daily-activity/api/entities/daily-activity';
import type { FC, ReactNode } from 'react';

interface ActivityEntryProps {
    type: ActivityItem['type'];
    children: ReactNode;
    className?: string;
};

const ActivityEntry: FC<ActivityEntryProps> = ({ type, children, className = '' }) => (
    <Box className={`activity-entry d-flex items-start gap-05 ${className}`.trim()}>
        <span
            className='activity-entry-dot d-flex flex-center radius-md f-shrink-0'
            style={{ color: ACTIVITY_ACCENT[type] }}
        >
            {ACTIVITY_ICON[type]}
        </span>
        <Box className='activity-entry-content d-flex column min-w-0'>
            {children}
        </Box>
    </Box>
);

export default ActivityEntry;
