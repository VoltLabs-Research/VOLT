import { Skeleton, Text, Timeline, TimelineItem, EmptyState } from '@voltstack/bravais';
import { ACTIVITY_ACCENT, ACTIVITY_ICON } from '@/modules/daily-activity/utils/activity-mappings';
import { formatCompactRelativeTime } from '@/shared/utils/format-relative-time';
import { useMemo } from 'react';
import { GoBeaker } from 'react-icons/go';
import type { ActivityItem, DailyActivity, DailyActivityUserSummary } from '@volt/contracts/modules/daily-activity/domain';

interface ActivityTimelinePanelProps {
    activityData: DailyActivity[];
    lookbackDays: number;
}

interface TimelineEntry {
    description: string;
    timestamp: string;
    type: ActivityItem['type'];
    userName: string;
}

const TIMELINE_STYLE = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto'
} as const;

// `DailyActivity.user` is `Ref<DailyActivityUserSummary>`: a string id when the query did not
// populate it, so the union has to be narrowed before reading the name fields.
const getUserName = (user: string | DailyActivityUserSummary): string => {
    if (typeof user === 'string') {
        return 'Team member';
    }

    return `${user.firstName} ${user.lastName}`.trim() || 'Team member';
};

const buildTimelineEntries = (activityData: DailyActivity[], lookbackDays: number): TimelineEntry[] => {
    const cutoffTime = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
    const entries: TimelineEntry[] = [];

    for (const day of activityData) {
        const userName = getUserName(day.user);

        for (const activity of day.activity) {
            const timestamp = new Date(activity.createdAt).getTime();
            if (timestamp < cutoffTime) {
                continue;
            }

            entries.push({
                description: activity.description,
                timestamp: activity.createdAt,
                type: activity.type,
                userName
            });
        }
    }

    entries.sort((left, right) => {
        return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
    });

    return entries;
};

export const ActivityTimelineSkeleton = () => (
    <Timeline className='dashboard-activity-list' style={TIMELINE_STYLE}>
        {Array.from({ length: 10 }, (_, index) => (
            <TimelineItem
                key={index}
                connector={index < 3}
                icon={<Skeleton variant='rounded' width={16} height={16} style={{ borderRadius: 'var(--radius-md)' }} />}
            >
                <Skeleton variant='text' width='70%' height={12} />
                <Skeleton variant='text' width='40%' height={10} style={{ marginTop: '4px' }} />
            </TimelineItem>
        ))}
    </Timeline>
);

const ActivityTimelinePanel = ({ activityData, lookbackDays }: ActivityTimelinePanelProps) => {
    const entries = useMemo(() => buildTimelineEntries(activityData, lookbackDays), [activityData, lookbackDays]);

    if (entries.length === 0) {
        return (
            <EmptyState
                icon={<GoBeaker size={20} />}
                title='No activity this week'
                description='Your activity from the last 7 days will appear here.'
                className='flex-1'
            />
        );
    }

    return (
        <Timeline className='dashboard-activity-list' style={TIMELINE_STYLE}>
            {entries.map((entry, index) => (
                <TimelineItem
                    key={`${entry.timestamp}-${index}`}
                    connector={index < entries.length - 1}
                    icon={<span style={{
                        color: ACTIVITY_ACCENT[entry.type],
                        display: 'inline-flex'
                    }}>{ACTIVITY_ICON[entry.type]}</span>}
                >
                    <Text size='md' tone='primary'>
                        <Text as='strong' weight='medium' style={{ textTransform: 'capitalize' }}>
                            {entry.userName}
                        </Text>
                        {' '}
                        <Text tone='secondary'>{entry.description}</Text>
                    </Text>
                    <Text size='sm' tone='muted'>
                        {formatCompactRelativeTime(entry.timestamp)}
                    </Text>
                </TimelineItem>
            ))}
        </Timeline>
    );
};

export default ActivityTimelinePanel;
