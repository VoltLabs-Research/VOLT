import './DashboardTeamTimeline.css';
import DashboardCard from '@/modules/dashboard/components/atoms/DashboardCard';
import useDailyActivityData from '@/modules/daily-activity/hooks/use-daily-activity-data';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import Title from '@/shared/presentation/components/Title';
import { ACTIVITY_ICON, ACTIVITY_ACCENT } from '@/modules/daily-activity/utilities/activity-mappings';
import { useMemo } from 'react';
import { Skeleton } from '@mui/material';
import { GoBeaker } from 'react-icons/go';
import type { ActivityItem, PopulatedUser } from '@/modules/daily-activity/api/entities/daily-activity';

interface TimelineEntry {
    userName: string;
    type: ActivityItem['type'];
    description: string;
    timestamp: string;
};

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
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getUserName = (user: string | PopulatedUser): string => {
    if (typeof user === 'string') return 'Team member';
    return `${user.firstName} ${user.lastName}`.trim() || 'Team member';
};

const DashboardTeamTimeline = () => {
    const { activityData, isLoading, error, accessDenied, accessDeniedMessage, fetchActivity } = useDailyActivityData({ range: 7 });

    const entries = useMemo((): TimelineEntry[] => {
        const items: TimelineEntry[] = [];

        for (const day of activityData) {
            const userName = getUserName(day.user);
            for (const act of day.activity) {
                items.push({
                    userName,
                    type: act.type,
                    description: act.description,
                    timestamp: act.createdAt
                });
            }
        }

        items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return items;
    }, [activityData]);

    if (accessDenied) {
        return (
            <DashboardCard className='dashboard-timeline-card d-flex column'>
                <RecoveryState
                    title='Access denied'
                    description={accessDeniedMessage ?? 'You do not have permission to view team activity.'}
                    tone={RecoveryStateTone.AccessDenied}
                    className='dashboard-card-state dashboard-timeline-empty'
                />
            </DashboardCard>
        );
    }

    if (error) {
        return (
            <DashboardCard className='dashboard-timeline-card d-flex column'>
                <RecoveryState
                    title='Unable to load activity'
                    description={error}
                    tone={RecoveryStateTone.Error}
                    onRetry={() => {
                        fetchActivity().catch(() => undefined);
                    }}
                    className='dashboard-card-state dashboard-timeline-empty'
                />
            </DashboardCard>
        );
    }

    if (isLoading) {
        return (
            <DashboardCard className='dashboard-timeline-card d-flex column'>
                <Container className='dashboard-timeline-header'>
                    <Title className='font-size-3 color-primary font-weight-5'>Activity</Title>
                </Container>
                <Container className='dashboard-timeline-list flex-1 min-h-0 y-auto d-flex column'>
                    {Array.from({ length: 10 }, (_, i) => (
                        <Container key={i} className='dashboard-timeline-item'>
                            <Container className='dashboard-timeline-dot-col'>
                                <Skeleton variant='rounded' width={20} height={20} sx={{ borderRadius: 'var(--radius-md)' }} />
                                {i < 3 && <span className='dashboard-timeline-line' />}
                            </Container>
                            <Container className='dashboard-timeline-content w-max'>
                                <Skeleton variant='text' width='70%' height={12} />
                                <Skeleton variant='text' width='40%' height={10} sx={{ marginTop: '4px' }} />
                            </Container>
                        </Container>
                    ))}
                </Container>
            </DashboardCard>
        );
    }

    const hasData = entries.length > 0;
    let timelineContent = (
        <EmptyState
            icon={<GoBeaker size={20} />}
            title='No activity this week'
            description='Team activity from the last 7 days will appear here.'
            className='flex-1'
        />
    );

    if (hasData) {
        timelineContent = (
            <>
                {entries.map((entry, i) => (
                    <Container key={`${entry.timestamp}-${i}`} className='dashboard-timeline-item'>
                        <Container className='dashboard-timeline-dot-col'>
                            <span
                                className='dashboard-timeline-dot d-flex flex-center radius-md'
                                style={{ color: ACTIVITY_ACCENT[entry.type] }}
                            >
                                {ACTIVITY_ICON[entry.type]}
                            </span>
                            {i < entries.length - 1 && <span className='dashboard-timeline-line' />}
                        </Container>
                        <Container className='dashboard-timeline-content'>
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
            </>
        );
    }

    return (
        <DashboardCard className='dashboard-timeline-card d-flex column'>
            <Container className='dashboard-timeline-header'>
                <Title className='font-size-3 color-primary font-weight-5'>Activity</Title>
                <span className='font-size-1 color-muted'>Last 7 days</span>
            </Container>

            <Container className='dashboard-timeline-list flex-1 min-h-0 y-auto d-flex column'>
                {timelineContent}
            </Container>
        </DashboardCard>
    );
};

export default DashboardTeamTimeline;
