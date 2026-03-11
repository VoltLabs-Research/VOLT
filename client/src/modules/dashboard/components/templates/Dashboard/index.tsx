import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import DashboardCard from '@/modules/dashboard/components/atoms/DashboardCard';
import DashboardOverviewCard from '@/modules/dashboard/components/atoms/DashboardOverviewCard';
import DashboardOverviewSkeleton from '@/modules/dashboard/components/atoms/DashboardOverviewSkeleton';
import DashboardClusterHealth from '@/modules/dashboard/components/molecules/DashboardClusterHealth';
import DashboardInAppActivity from '@/modules/dashboard/components/molecules/DashboardInAppActivity';
import DashboardNotificationsFeed from '@/modules/dashboard/components/molecules/DashboardNotificationsFeed';
import DashboardPreviewCard from '@/modules/dashboard/components/molecules/DashboardPreviewCard';
import { DashboardQuickActions } from '@/modules/dashboard/components/molecules/DashboardQuickActions';
import DashboardRecentAnalyses from '@/modules/dashboard/components/molecules/DashboardRecentAnalyses';
import DashboardTeamPresence from '@/modules/dashboard/components/molecules/DashboardTeamPresence';
import DashboardTeamTimeline from '@/modules/dashboard/components/molecules/DashboardTeamTimeline';
import useDashboardMetrics from '@/modules/dashboard/hooks/use-dashboard-metrics';
import JobsHistoryViewer from '@/modules/jobs/components/organisms/JobsHistoryViewer';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import SimulationGrid from '@/modules/trajectory/components/molecules/SimulationGrid';
import TrajectoryUploaderContainer from '@/modules/trajectory/components/organisms/TrajectoryUploaderContainer';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Paragraph from '@/shared/presentation/components/Paragraph';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import Title from '@/shared/presentation/components/Title';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import './Dashboard.css';
import { useMemo } from 'react';
import { FlaskConical, Puzzle } from 'lucide-react';
import { HiOutlineServerStack } from 'react-icons/hi2';
import type { DashboardCard as DashboardMetricsCard } from '@/modules/dashboard/api/entities/dashboard';
import type { ReactNode } from 'react';

const CARD_ICONS: Record<string, ReactNode> = {
    trajectories: <HiOutlineServerStack size={16} />,
    analysis: <FlaskConical size={16} strokeWidth={1.8} />
};

const getCardIcon = (key: string): ReactNode => {
    return CARD_ICONS[key] || <Puzzle size={16} strokeWidth={1.8} />;
};

const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    if (hour >= 17 && hour < 21) return 'Good Evening';
    return 'Good Night';
};

const DashboardPage = () => {
    usePageTitle('Dashboard');

    const selectedTeam = useSelectedTeam();
    const user = useCurrentUser();
    const { loading, error, cards, accessDenied, accessDeniedMessage } = useDashboardMetrics(selectedTeam?._id);

    const firstName = useMemo(() => {
        const name = user?.firstName || '';
        return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    }, [user?.firstName]);

    const today = useMemo(() => {
        return new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
    }, []);
    let statCards = cards.map((card: DashboardMetricsCard, index: number) => (
        <DashboardOverviewCard
            key={`${card.key}-${index}`}
            card={card}
            icon={getCardIcon(card.key)}
        />
    ));

    if (accessDenied) {
        statCards = [
            <DashboardCard key='denied' className='dashboard-stat-card' isRelative={true} overflowHidden={true} style={{ gridColumn: 'span 4' }}>
                <RecoveryState
                    title='Access denied'
                    description={accessDeniedMessage ?? 'You do not have permission to view dashboard metrics.'}
                    tone={RecoveryStateTone.AccessDenied}
                    className='dashboard-card-state'
                />
            </DashboardCard>
        ];
    } else if (error) {
        statCards = [
            <DashboardCard key='error' className='dashboard-stat-card' isRelative={true} overflowHidden={true} style={{ gridColumn: 'span 4' }}>
                <RecoveryState
                    title='Unable to load dashboard metrics'
                    description={error}
                    tone={RecoveryStateTone.Error}
                    className='dashboard-card-state'
                />
            </DashboardCard>
        ];
    } else if (loading) {
        statCards = [<DashboardOverviewSkeleton key='loading' count={3} />];
    }

    // TOOD: Possible dead code? We have now this:
    // /home/rodyherrera/Desktop/voltlabs-ecosystem/app/Volt/client/src/modules/onboarding/components/templates/PostAuthOnboarding/index.tsx
    if (!selectedTeam) {
        return (
            <TrajectoryUploaderContainer>
                <Container className='dashboard-bento'>
                    <Container className='dashboard-welcome'>
                        <Title className='font-size-5 color-primary font-weight-6'>
                            {getGreeting()}, {firstName}
                        </Title>
                        <Paragraph className='font-size-2 color-muted dashboard-welcome-subtitle' style={{ marginTop: '0.25rem' }}>
                            {today}
                        </Paragraph>
                    </Container>

                    <Container className='dashboard-bottom-row'>
                        <EmptyState
                            icon={<HiOutlineServerStack size={20} />}
                            title='Create your first team'
                            description='Use the team creation dialog to finish setup and unlock the dashboard.'
                            className='w-max'
                        />
                    </Container>
                </Container>
            </TrajectoryUploaderContainer>
        );
    }

    return (
        <TrajectoryUploaderContainer>
            <Container className='dashboard-bento'>
                <Container className='dashboard-welcome'>
                    <Title className='font-size-5 color-primary font-weight-6'>
                        {getGreeting()}, {firstName}
                    </Title>
                    <Paragraph className='font-size-2 color-muted dashboard-welcome-subtitle' style={{ marginTop: '0.25rem' }}>
                        {today} &middot; {selectedTeam.name}
                    </Paragraph>
                </Container>

                {statCards}

                {!loading && cards.length === 3 && (
                    <DashboardCard className='dashboard-stat-card' isRelative={true} overflowHidden={true} style={{ opacity: 0, pointerEvents: 'none' }} />
                )}

                <DashboardTeamTimeline />
                <DashboardInAppActivity />
                <DashboardQuickActions />
                <DashboardClusterHealth />
                <DashboardTeamPresence />
                <DashboardNotificationsFeed />

                <Container className='dashboard-bottom-row'>
                    <DashboardPreviewCard />

                    <Container className='dashboard-bottom-sidebar'>
                        <DashboardCard className='dashboard-jobs-card d-flex column flex-1 min-h-0' overflowHidden={true}>
                            <Container className='d-flex items-center content-between w-max dashboard-jobs-card-header'>
                                <Title className='font-size-2 color-primary font-weight-6'>
                                    Jobs History
                                </Title>
                            </Container>
                            <JobsHistoryViewer
                                variant='embedded'
                                displayMode='full'
                                hideAfterComplete={false}
                                emptyState={(
                                    <EmptyState
                                        icon={<HiOutlineServerStack size={20} />}
                                        title='No jobs yet'
                                        description='Start a simulation or analysis to see activity here.'
                                        className='flex-1 dashboard-jobs-empty-state'
                                    />
                                )}
                            />
                        </DashboardCard>

                        <DashboardRecentAnalyses />
                    </Container>
                </Container>

                <Container className='dashboard-simulations-section'>
                    <Title className='font-size-4 color-primary font-weight-5'>Trajectories</Title>
                    <SimulationGrid />
                </Container>
            </Container>
        </TrajectoryUploaderContainer>
    );
};

export default DashboardPage;
