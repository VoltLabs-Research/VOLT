import './DashboardActivityCard.css';
import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import { AsyncBoundary, Box, SegmentedTabs, Skeleton, Stack, Text, Timeline, TimelineItem, EmptyState } from '@voltstack/bravais';
import useDailyActivityData from '@/modules/daily-activity/hooks/use-daily-activity-data';
import { ACTIVITY_ACCENT, ACTIVITY_ICON } from '@/modules/daily-activity/utilities/activity-mappings';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import { formatDuration } from '@/shared/utils/format';
import { Activity as ActivityIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    Legend,
    PolarAngleAxis,
    PolarGrid,
    Radar,
    RadarChart,
    ResponsiveContainer,
    Tooltip
} from 'recharts';
import { GoBeaker } from 'react-icons/go';
import type { DailyActivity, ActivityItem, PopulatedUser } from '@/modules/daily-activity/api/entities/daily-activity';
import type { ReactNode } from 'react';

type DashboardActivityTabId = 'activity' | 'in-app-activity';

interface TimelineEntry {
    description: string;
    timestamp: string;
    type: ActivityItem['type'];
    userName: string;
}

interface DashboardInAppActivityBucket {
    actions: number;
    count: number;
    minutes: number;
}

interface DashboardChartTooltipEntry {
    color?: string;
    dataKey?: string;
    name?: string;
    value?: number | string;
}

interface DashboardChartTooltipProps {
    active?: boolean;
    label?: number | string;
    payload?: readonly unknown[];
}

const ACTIVITY_LOOKBACK_DAYS = 7;
const ACTIVITY_REFRESH_INTERVAL_MS = 10_000;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DASHBOARD_ACTIVITY_TABS: Array<{ id: DashboardActivityTabId; label: string }> = [
    { id: 'activity', label: 'Activity' },
    { id: 'in-app-activity', label: 'In-app Activity' }
];

const formatRelativeTime = (iso: string): string => {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60_000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;

    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return 'yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;

    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
};

const getUserName = (user: string | PopulatedUser): string => {
    if (typeof user === 'string') {
        return 'Team member';
    }

    return `${user.firstName} ${user.lastName}`.trim() || 'Team member';
};

const toMondayIndex = (jsDay: number): number => {
    if (jsDay === 0) {
        return 6;
    }

    return jsDay - 1;
};

const isDashboardChartTooltipEntry = (value: unknown): value is DashboardChartTooltipEntry => {
    return typeof value === 'object' && value !== null;
};

const buildTimelineEntries = (activityData: DailyActivity[]): TimelineEntry[] => {
    const cutoffTime = Date.now() - ACTIVITY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    const entries: TimelineEntry[] = [];

    for (const day of activityData) {
        const userName = getUserName(day.user);

        for (const activity of day.activity) {
            const timestamp = new Date(activity.createdAt).getTime();
            if (!Number.isFinite(timestamp) || timestamp < cutoffTime) {
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

const buildInAppActivitySummary = (activityData: DailyActivity[]) => {
    const buckets = DAY_LABELS.map<DashboardInAppActivityBucket>(() => ({
        actions: 0,
        count: 0,
        minutes: 0
    }));
    let totalMinutes = 0;
    let totalActions = 0;

    for (const day of activityData) {
        const index = toMondayIndex(new Date(day.date).getDay());
        const minutes = day.minutesOnline || 0;
        const actions = day.activity.length;

        buckets[index].minutes += minutes;
        buckets[index].actions += actions;
        buckets[index].count += 1;

        totalMinutes += minutes;
        totalActions += actions;
    }

    const radarData = DAY_LABELS.map((dayLabel, index) => {
        const bucket = buckets[index];
        const averageMinutes = bucket.count > 0 ? Math.round(bucket.minutes / bucket.count) : 0;
        const averageActions = bucket.count > 0 ? Math.round((bucket.actions / bucket.count) * 10) / 10 : 0;

        return {
            actions: averageActions,
            day: dayLabel,
            minutes: averageMinutes
        };
    });

    let peakDay = DAY_LABELS[0];
    let peakMinutes = 0;

    for (const day of radarData) {
        if (day.minutes <= peakMinutes) {
            continue;
        }

        peakMinutes = day.minutes;
        peakDay = day.day;
    }

    return {
        peakDay,
        radarData,
        totalActions,
        totalMinutes
    };
};

const DashboardActivityCard = () => {
    const [activeTab, setActiveTab] = useState<DashboardActivityTabId>('in-app-activity');
    const { activityData, isLoading, error, accessDenied, accessDeniedMessage, fetchActivity } = useDailyActivityData({
        range: ACTIVITY_LOOKBACK_DAYS,
        scope: 'self',
        refetchIntervalMs: ACTIVITY_REFRESH_INTERVAL_MS
    });

    const timelineEntries = useMemo(() => buildTimelineEntries(activityData), [activityData]);
    const inAppActivity = useMemo(() => buildInAppActivitySummary(activityData), [activityData]);

    const tabDescription = activeTab === 'activity' ? 'Last 7 days' : 'Avg / day of week';
    const hasTimelineEntries = timelineEntries.length > 0;
    const hasInAppActivity = activityData.length > 0;

    const renderTooltip = ({ active, payload, label }: DashboardChartTooltipProps) => {
        if (!active || !Array.isArray(payload) || payload.length < 1) {
            return null;
        }

        return (
            <div className='dashboard-activity-tooltip'>
                <span className='dashboard-activity-tooltip-label'>{label}</span>
                {payload.map((entry, index) => {
                    if (!isDashboardChartTooltipEntry(entry)) {
                        return null;
                    }

                    const formattedValue = entry.dataKey === 'minutes' && typeof entry.value === 'number'
                        ? formatDuration(entry.value)
                        : entry.value;

                    return (
                        <div key={index} className='dashboard-activity-tooltip-row'>
                            <span className='dashboard-activity-tooltip-dot' style={{ background: entry.color }} />
                            <span className='dashboard-activity-tooltip-name'>{entry.name}</span>
                            <span className='dashboard-activity-tooltip-value'>{formattedValue}</span>
                        </div>
                    );
                })}
            </div>
        );
    };

    const loadingState: ReactNode = activeTab === 'in-app-activity'
        ? <Box display='flex' className='dashboard-activity-chart-surface flex-center' />
        : (
            <Timeline className='dashboard-activity-list' style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
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

    const accessDeniedState: ReactNode = (
        <RecoveryState
            title='Access denied'
            description={accessDeniedMessage ?? 'You do not have permission to view activity.'}
            tone={RecoveryStateTone.AccessDenied}
            className='dashboard-card-state'
        />
    );

    const renderError = (errValue: unknown): ReactNode => (
        <RecoveryState
            title='Unable to load activity'
            description={typeof errValue === 'string' ? errValue : 'Unknown error'}
            tone={RecoveryStateTone.Error}
            onRetry={() => {
                fetchActivity().catch(() => undefined);
            }}
            className='dashboard-card-state'
        />
    );

    const renderTimeline = (): ReactNode => {
        if (!hasTimelineEntries) {
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
            <Timeline className='dashboard-activity-list' style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {timelineEntries.map((entry, index) => (
                    <TimelineItem
                        key={`${entry.timestamp}-${index}`}
                        connector={index < timelineEntries.length - 1}
                        icon={<span style={{ color: ACTIVITY_ACCENT[entry.type], display: 'inline-flex' }}>{ACTIVITY_ICON[entry.type]}</span>}
                    >
                        <Text size='md' tone='primary'>
                            <Text as='strong' weight='medium' style={{ textTransform: 'capitalize' }}>
                                {entry.userName}
                            </Text>
                            {' '}
                            <Text tone='secondary'>{entry.description}</Text>
                        </Text>
                        <Text size='sm' tone='muted'>
                            {formatRelativeTime(entry.timestamp)}
                        </Text>
                    </TimelineItem>
                ))}
            </Timeline>
        );
    };

    const renderInAppActivity = (): ReactNode => {
        if (!hasInAppActivity) {
            return (
                <EmptyState
                    className='dashboard-activity-empty-state h-max'
                    icon={<ActivityIcon size={20} strokeWidth={1.6} />}
                    title='No activity yet'
                    description='Once you start navigating the app, this chart will show your time spent and actions across the week.'
                />
            );
        }

        return (
            <Stack gap='05' flex='1' minH='0' className='dashboard-activity-panel'>
                <Box className='dashboard-activity-chart-surface'>
                    <ResponsiveContainer width='100%' height={250}>
                        <RadarChart
                            data={inAppActivity.radarData}
                            cx='50%'
                            cy='50%'
                            outerRadius='70%'
                        >
                            <PolarGrid
                                stroke='var(--color-border-strong)'
                                strokeDasharray='4 4'
                            />
                            <PolarAngleAxis
                                dataKey='day'
                                tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                            />
                            <Tooltip content={renderTooltip} />
                            <Legend verticalAlign='bottom' height={32} wrapperStyle={{ fontSize: '12px' }} />
                            <Radar
                                name='Avg. time'
                                dataKey='minutes'
                                stroke='var(--accent-blue)'
                                fill='var(--accent-blue)'
                                fillOpacity={0.12}
                                strokeWidth={2}
                            />
                            <Radar
                                name='Avg. actions'
                                dataKey='actions'
                                stroke='var(--accent-green)'
                                fill='var(--accent-green)'
                                fillOpacity={0.06}
                                strokeWidth={1.5}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </Box>

                <Box className='dashboard-activity-summary'>
                    <Box className='dashboard-activity-summary-item'>
                        <Text size='lg' tone='primary' weight='bold'>{formatDuration(inAppActivity.totalMinutes)}</Text>
                        <Text size='sm' tone='muted'>Total time</Text>
                    </Box>
                    <Box className='dashboard-activity-summary-item'>
                        <Text size='lg' tone='primary' weight='bold'>{inAppActivity.totalActions}</Text>
                        <Text size='sm' tone='muted'>Actions</Text>
                    </Box>
                    <Box className='dashboard-activity-summary-item dashboard-activity-summary-item-end'>
                        <Text size='md' tone='primary' weight='medium'>{inAppActivity.peakDay}</Text>
                        <Text size='sm' tone='muted'>Peak day</Text>
                    </Box>
                </Box>
            </Stack>
        );
    };

    const content = activeTab === 'activity' ? renderTimeline() : renderInAppActivity();

    return (
        <DashboardCard className='dashboard-activity-card d-flex column'>
            <Box className='dashboard-tabbed-card-header'>
                <SegmentedTabs
                    tabs={DASHBOARD_ACTIVITY_TABS}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    ariaLabel='Dashboard activity views'
                />
                <Text size='sm' tone='muted'>{tabDescription}</Text>
            </Box>

            <AsyncBoundary
                state={{ loading: isLoading, error: error || undefined, accessDenied }}
                loading={loadingState}
                error={renderError}
                accessDenied={accessDeniedState}
            >
                {content}
            </AsyncBoundary>
        </DashboardCard>
    );
};

export default DashboardActivityCard;
