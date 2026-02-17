import { useEffect, useMemo } from 'react';
import { GoUpload, GoTrash, GoBeaker } from 'react-icons/go';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import useDailyActivityData from '@/modules/daily-activity/presentation/hooks/use-daily-activity-data';
import type { ActivityItem, PopulatedUser } from '@/modules/daily-activity/domain/entities/DailyActivity';
import './DashboardTeamTimeline.css';

interface TimelineEntry {
    userName: string;
    type: ActivityItem['type'];
    description: string;
    timestamp: string;
};

const ACTIVITY_ICON: Record<ActivityItem['type'], React.ReactNode> = {
    'trajectory-upload': <GoUpload size={14} />,
    'trajectory-deletion': <GoTrash size={14} />,
    'analysis-performed': <GoBeaker size={14} />
};

const ACTIVITY_ACCENT: Record<ActivityItem['type'], string> = {
    'trajectory-upload': 'var(--accent-blue)',
    'trajectory-deletion': 'var(--accent-red)',
    'analysis-performed': 'var(--accent-green)'
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
    const { activityData, isLoading, fetchActivity } = useDailyActivityData();

    useEffect(() => {
        fetchActivity(7);
    }, [fetchActivity]);

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

        // Sort newest first
        items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return items;
    }, [activityData]);

    if (isLoading) {
        return (
            <Container className='dashboard-timeline-card'>
                <Container className='dashboard-timeline-header'>
                    <Title className='font-size-3 color-primary font-weight-5'>Activity</Title>
                </Container>
                <Container className='dashboard-timeline-list'>
                    {Array.from({ length: 4 }, (_, i) => (
                        <Container key={i} className='dashboard-timeline-item'>
                            <Container className='dashboard-timeline-dot-col'>
                                <span className='dashboard-timeline-dot dashboard-skeleton-pulse' />
                                {i < 3 && <span className='dashboard-timeline-line' />}
                            </Container>
                            <Container className='dashboard-timeline-content'>
                                <span className='dashboard-skeleton-pulse' style={{ width: '70%', height: 12, display: 'block' }} />
                                <span className='dashboard-skeleton-pulse' style={{ width: '40%', height: 10, display: 'block', marginTop: 4 }} />
                            </Container>
                        </Container>
                    ))}
                </Container>
            </Container>
        );
    }

    const hasData = entries.length > 0;

    return (
        <Container className='dashboard-timeline-card'>
            <Container className='dashboard-timeline-header'>
                <Title className='font-size-3 color-primary font-weight-5'>Activity</Title>
                <span className='font-size-1 color-muted'>Last 7 days</span>
            </Container>

            <Container className='dashboard-timeline-list'>
                {hasData ? (
                    entries.map((entry, i) => (
                        <Container key={`${entry.timestamp}-${i}`} className='dashboard-timeline-item'>
                            <Container className='dashboard-timeline-dot-col'>
                                <span
                                    className='dashboard-timeline-dot'
                                    style={{ color: ACTIVITY_ACCENT[entry.type] }}
                                >
                                    {ACTIVITY_ICON[entry.type]}
                                </span>
                                {i < entries.length - 1 && <span className='dashboard-timeline-line' />}
                            </Container>
                            <Container className='dashboard-timeline-content'>
                                <span className='font-size-2 color-primary'>
                                    <strong className='font-weight-5'>{entry.userName}</strong>
                                    {' '}
                                    <span className='color-secondary'>{entry.description}</span>
                                </span>
                                <span className='font-size-1 color-muted'>
                                    {formatRelativeTime(entry.timestamp)}
                                </span>
                            </Container>
                        </Container>
                    ))
                ) : (
                    <Container className='dashboard-timeline-empty'>
                        <span className='color-muted font-size-2'>No activity this week</span>
                    </Container>
                )}
            </Container>
        </Container>
    );
};

export default DashboardTeamTimeline;
