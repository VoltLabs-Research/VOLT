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

/**
 * bravais's `Timeline`, rebuilt with utilities — it had no HeroUI equivalent
 * (spec §4c).
 *
 * `role='list'` is added: `list-style: none` on an `<ol>` strips list semantics in
 * Safari/VoiceOver and bravais did not put them back, so a timeline of ten entries
 * announced as ten loose paragraphs. Nothing visual changes.
 *
 * `.dashboard-activity-list` overrode the container's `gap: .5rem` down to `0`; the
 * entries space themselves through the content column's bottom padding instead.
 */
const TIMELINE = 'flex min-h-0 flex-1 list-none flex-col gap-0 overflow-y-auto p-0 m-0';

/**
 * `.volt-timeline-item` is a GRID, not a flex row: a fixed 28px rail column and a
 * `1fr` content column. A flex rewrite loses the fixed rail and the content column's
 * min-width behaviour.
 */
const TIMELINE_ITEM = 'grid grid-cols-[28px_1fr] items-start gap-3';

/**
 * The rail is entirely `aria-hidden`, so an icon that carries meaning is invisible to
 * assistive tech — only the entry text is announced. That was true before and is left
 * alone here; the icons duplicate the description.
 */
const TIMELINE_RAIL = 'flex min-h-7 flex-col items-center';

/** `z-[1]` is what lifts the dot above the connector line running behind it. */
const TIMELINE_DOT = 'inline-flex size-[22px] shrink-0 items-center justify-center rounded-full border border-border bg-surface-tertiary text-muted z-[1]';

/**
 * `flex-1` plus the rail's `min-h-7` is why the connector stops just below the dot
 * rather than stretching to a tall entry: the rail's height is driven by its
 * min-height inside a grid cell that aligns to the start. Preserved as-is.
 */
const TIMELINE_LINE = 'mt-0.5 w-px flex-1 bg-border';

/** The bottom padding, not the container gap, is what spaces entries apart. */
const TIMELINE_CONTENT = 'flex min-w-0 flex-col gap-1 pb-3';

/** bravais's `variant='rounded'` was `--radius-md`, 12px → `rounded-xl`. */
const ICON_SKELETON = 'size-4 shrink-0 rounded-xl';

/** bravais's `variant='text'`: painted at 60% height from `0 55%`, full box reserved. */
const TEXT_SKELETON = 'shrink-0 origin-[0_55%] scale-y-[0.6] rounded-md';

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

interface TimelineRowProps {
    connector: boolean;
    icon: ReactNode;
    children: ReactNode;
}

const TimelineRow = ({ connector, icon, children }: TimelineRowProps) => (
    <li className={TIMELINE_ITEM}>
        <span className={TIMELINE_RAIL} aria-hidden='true'>
            <span className={TIMELINE_DOT}>{icon}</span>
            {connector && <span className={TIMELINE_LINE} />}
        </span>
        <div className={TIMELINE_CONTENT}>{children}</div>
    </li>
);

export const ActivityTimelineSkeleton = () => (
    <ol className={TIMELINE} role='list'>
        {Array.from({ length: 10 }, (_, index) => (
            <TimelineRow
                key={index}
                connector={index < 3}
                icon={<Skeleton className={ICON_SKELETON} aria-hidden='true' />}
            >
                <Skeleton className={`h-3 w-[70%] ${TEXT_SKELETON}`} aria-hidden='true' />
                <Skeleton className={`mt-1 h-2.5 w-[40%] ${TEXT_SKELETON}`} aria-hidden='true' />
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
        <ol className={TIMELINE} role='list'>
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
