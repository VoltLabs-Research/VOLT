import './DashboardActivityCard.css';
import DashboardCard from '@/modules/dashboard/components/atoms/DashboardCard';
import DashboardTabs from '@/modules/dashboard/components/molecules/DashboardTabs';
import useDailyActivityData from '@/modules/daily-activity/hooks/use-daily-activity-data';
import { ACTIVITY_ACCENT, ACTIVITY_ICON } from '@/modules/daily-activity/utilities/activity-mappings';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import { Skeleton } from '@mui/material';
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

const formatMinutes = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)}m`;

    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours < 24) {
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
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
    const { activityData, isLoading, error, accessDenied, accessDeniedMessage, fetchActivity } = useDailyActivityData();

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
                        ? formatMinutes(entry.value)
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

    const renderLoadingState = (): ReactNode => {
        if (activeTab === 'in-app-activity') {
            return <Container className='dashboard-activity-chart-surface d-flex flex-center' />;
        }

        return (
            <Container className='dashboard-activity-list flex-1 min-h-0 y-auto d-flex column'>
                {Array.from({ length: 10 }, (_, index) => (
                    <Container key={index} className='dashboard-activity-timeline-item'>
                        <Container className='dashboard-activity-timeline-dot-col'>
                            <Skeleton variant='rounded' width={20} height={20} sx={{ borderRadius: 'var(--radius-md)' }} />
                            {index < 3 && <span className='dashboard-activity-timeline-line' />}
                        </Container>
                        <Container className='dashboard-activity-timeline-content w-max'>
                            <Skeleton variant='text' width='70%' height={12} />
                            <Skeleton variant='text' width='40%' height={10} sx={{ marginTop: '4px' }} />
                        </Container>
                    </Container>
                ))}
            </Container>
        );
    };

    const renderAccessDeniedState = (): ReactNode => {
        return (
            <RecoveryState
                title='Access denied'
                description={accessDeniedMessage ?? 'You do not have permission to view activity.'}
                tone={RecoveryStateTone.AccessDenied}
                className='dashboard-card-state'
            />
        );
    };

    const renderErrorState = (): ReactNode => {
        return (
            <RecoveryState
                title='Unable to load activity'
                description={error || 'Unknown error'}
                tone={RecoveryStateTone.Error}
                onRetry={() => {
                    fetchActivity().catch(() => undefined);
                }}
                className='dashboard-card-state'
            />
        );
    };

    const renderTimeline = (): ReactNode => {
        if (!hasTimelineEntries) {
            return (
                <EmptyState
                    icon={<GoBeaker size={20} />}
                    title='No activity this week'
                    description='Team activity from the last 7 days will appear here.'
                    className='flex-1'
                />
            );
        }

        return (
            <Container className='dashboard-activity-list flex-1 min-h-0 y-auto d-flex column'>
                {timelineEntries.map((entry, index) => (
                    <Container key={`${entry.timestamp}-${index}`} className='dashboard-activity-timeline-item'>
                        <Container className='dashboard-activity-timeline-dot-col'>
                            <span
                                className='dashboard-activity-timeline-dot d-flex flex-center radius-md'
                                style={{ color: ACTIVITY_ACCENT[entry.type] }}
                            >
                                {ACTIVITY_ICON[entry.type]}
                            </span>
                            {index < timelineEntries.length - 1 && <span className='dashboard-activity-timeline-line' />}
                        </Container>
                        <Container className='dashboard-activity-timeline-content'>
                            <span className='font-size-2 color-primary'>
                                <strong className='font-weight-5' style={{ textTransform: 'capitalize' }}>
                                    {entry.userName}
                                </strong>
                                {' '}
                                <span className='color-secondary'>{entry.description}</span>
                            </span>
                            <span className='font-size-1 color-muted'>
                                {formatRelativeTime(entry.timestamp)}
                            </span>
                        </Container>
                    </Container>
                ))}
            </Container>
        );
    };

    const renderInAppActivity = (): ReactNode => {
        if (!hasInAppActivity) {
            return (
                <EmptyState
                    className='dashboard-activity-empty-state h-max'
                    icon={<ActivityIcon size={20} strokeWidth={1.6} />}
                    title='No activity yet'
                    description='Once your team starts navigating the app, this chart will compare time spent and actions taken across the week.'
                />
            );
        }

        return (
            <Container className='dashboard-activity-panel d-flex gap-05 column flex-1 min-h-0'>
                <Container className='dashboard-activity-chart-surface'>
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
                </Container>

                <Container className='dashboard-activity-summary'>
                    <Container className='dashboard-activity-summary-item'>
                        <span className='font-size-3 color-primary font-weight-6'>{formatMinutes(inAppActivity.totalMinutes)}</span>
                        <span className='font-size-1 color-muted'>Total time</span>
                    </Container>
                    <Container className='dashboard-activity-summary-item'>
                        <span className='font-size-3 color-primary font-weight-6'>{inAppActivity.totalActions}</span>
                        <span className='font-size-1 color-muted'>Actions</span>
                    </Container>
                    <Container className='dashboard-activity-summary-item dashboard-activity-summary-item-end'>
                        <span className='font-size-2 color-primary font-weight-5'>{inAppActivity.peakDay}</span>
                        <span className='font-size-1 color-muted'>Peak day</span>
                    </Container>
                </Container>
            </Container>
        );
    };

    let content = activeTab === 'activity' ? renderTimeline() : renderInAppActivity();

    if (accessDenied) {
        content = renderAccessDeniedState();
    } else if (error) {
        content = renderErrorState();
    } else if (isLoading) {
        content = renderLoadingState();
    }

    return (
        <DashboardCard className='dashboard-activity-card d-flex column'>
            <Container className='dashboard-tabbed-card-header'>
                <DashboardTabs
                    tabs={DASHBOARD_ACTIVITY_TABS}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    ariaLabel='Dashboard activity views'
                />
                <span className='font-size-1 color-muted'>{tabDescription}</span>
            </Container>

            {content}
        </DashboardCard>
    );
};

export default DashboardActivityCard;
