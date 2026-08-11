import { Skeleton } from '@heroui/react';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import { ACTIVITY_ACCENT, ACTIVITY_ICON } from '@/modules/daily-activity/utils/activity-mappings';
import { formatCompactRelativeTime } from '@/shared/utils/format-relative-time';
import { useMemo } from 'react';
import { Beaker } from 'lucide-react';
import type { ActivityItem, DailyActivity, DailyActivityUserSummary } from '@volt/contracts/modules/daily-activity/domain';
import type { ReactNode } from 'react';

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

interface TimelineRowProps {
    connector: boolean;
    icon: ReactNode;
    children: ReactNode;
}

const TimelineRow = ({ connector, icon, children }: TimelineRowProps) => (
    <li className='grid grid-cols-[28px_1fr] items-start gap-3'>
        <span className='flex min-h-7 flex-col items-center' aria-hidden='true'>
            <span className='inline-flex size-[22px] shrink-0 items-center justify-center rounded-full border border-border bg-surface-tertiary text-muted z-[1]'>{icon}</span>
            {connector && <span className='mt-0.5 w-px flex-1 bg-border' />}
        </span>
        <div className='flex min-w-0 flex-col gap-1 pb-3'>{children}</div>
    </li>
);

export const ActivityTimelineSkeleton = () => (
    <ol className='flex min-h-0 flex-1 list-none flex-col gap-0 overflow-y-auto p-0 m-0' role='list'>
        {Array.from({ length: 10 }, (_, index) => (
            <TimelineRow
                key={index}
                connector={index < 3}
                icon={<Skeleton className='size-4 shrink-0 rounded-xl' aria-hidden='true' />}
            >
                <Skeleton className='h-3 w-[70%] shrink-0 origin-[0_55%] scale-y-[0.6] rounded-md' aria-hidden='true' />
                <Skeleton className='mt-1 h-2.5 w-[40%] shrink-0 origin-[0_55%] scale-y-[0.6] rounded-md' aria-hidden='true' />
            </TimelineRow>
        ))}
    </ol>
);

const ActivityTimelinePanel = ({ activityData, lookbackDays }: ActivityTimelinePanelProps) => {
    const entries = useMemo(() => buildTimelineEntries(activityData, lookbackDays), [activityData, lookbackDays]);

    if (entries.length === 0) {
        return (
            <RecoveryState
                icon={<Beaker size={20} />}
                title='No activity this week'
                description='Your activity from the last 7 days will appear here.'
                className='flex-1'
            />
        );
    }

    return (
        <ol className='flex min-h-0 flex-1 list-none flex-col gap-0 overflow-y-auto p-0 m-0' role='list'>
            {entries.map((entry, index) => (
                <TimelineRow
                    key={`${entry.timestamp}-${index}`}
                    connector={index < entries.length - 1}
                    icon={
                        <span className='inline-flex' style={{ color: ACTIVITY_ACCENT[entry.type] }}>
                            {ACTIVITY_ICON[entry.type]}
                        </span>
                    }
                >
                    <span className='text-sm text-foreground'>
                        <strong className='font-medium capitalize'>
                            {entry.userName}
                        </strong>
                        {' '}
                        <span className='text-muted'>{entry.description}</span>
                    </span>
                    <span className='text-xs text-muted'>
                        {formatCompactRelativeTime(entry.timestamp)}
                    </span>
                </TimelineRow>
            ))}
        </ol>
    );
};

export default ActivityTimelinePanel;
