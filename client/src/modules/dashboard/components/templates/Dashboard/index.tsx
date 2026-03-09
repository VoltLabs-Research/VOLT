import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import DashboardOverviewCard from '@/modules/dashboard/components/atoms/DashboardOverviewCard';
import DashboardOverviewSkeleton from '@/modules/dashboard/components/atoms/DashboardOverviewSkeleton';
import { DashboardQuickActions } from '@/modules/dashboard/components/molecules/DashboardQuickActions';
import DashboardClusterHealth from '@/modules/dashboard/components/molecules/DashboardClusterHealth';
import DashboardInAppActivity from '@/modules/dashboard/components/molecules/DashboardInAppActivity';
import DashboardNotificationsFeed from '@/modules/dashboard/components/molecules/DashboardNotificationsFeed';
import DashboardPreviewCard from '@/modules/dashboard/components/molecules/DashboardPreviewCard';
import DashboardRecentAnalyses from '@/modules/dashboard/components/molecules/DashboardRecentAnalyses';
import DashboardTeamPresence from '@/modules/dashboard/components/molecules/DashboardTeamPresence';
import DashboardTeamTimeline from '@/modules/dashboard/components/molecules/DashboardTeamTimeline';
import useDashboardMetrics from '@/modules/dashboard/hooks/use-dashboard-metrics';
import JobsHistoryViewer from '@/modules/jobs/components/organisms/JobsHistoryViewer';
import TrajectoryUploaderContainer from '@/modules/trajectory/components/organisms/TrajectoryUploaderContainer';
import SimulationGrid from '@/modules/trajectory/components/molecules/SimulationGrid';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import './Dashboard.css';
import { useMemo } from 'react';
import { FlaskConical, Puzzle } from 'lucide-react';
import { HiOutlineServerStack } from 'react-icons/hi2';
import type { DashboardCard } from '@/modules/dashboard/api/entities/dashboard';
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
    const { loading, cards, accessDenied, accessDeniedMessage } = useDashboardMetrics(selectedTeam?._id);

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
    let statCards = cards.map((card: DashboardCard, index: number) => (
        <DashboardOverviewCard
            key={`${card.key}-${index}`}
            card={card}
            icon={getCardIcon(card.key)}
        />
    ));

    if (accessDenied) {
        statCards = [
            <Container key='denied' className='dashboard-stat-card' style={{ gridColumn: 'span 4' }}>
                <AccessDenied description={accessDeniedMessage} showBack={false} />
            </Container>
        ];
    } else if (loading) {
        statCards = [<DashboardOverviewSkeleton key='loading' count={3} />];
    }

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
                {/* Welcome section */}
                <Container className='dashboard-welcome'>
                    <Title className='font-size-5 color-primary font-weight-6'>
                        {getGreeting()}, {firstName}
                    </Title>
                    <Paragraph className='font-size-2 color-muted dashboard-welcome-subtitle' style={{ marginTop: '0.25rem' }}>
                        {today} &middot; {selectedTeam.name}
                    </Paragraph>
                </Container>

                {/* Stat overview cards */}
                {statCards}

                {/* Spacer card to fill remaining columns when 3 stat cards */}
                {!loading && cards.length === 3 && (
                    <Container className='dashboard-stat-card' style={{ opacity: 0, pointerEvents: 'none' }} />
                )}

                {/* Team activity timeline */}
                <DashboardTeamTimeline />

                {/* In-app activity history (365d) */}
                <DashboardInAppActivity />

                {/* Quick actions */}
                <DashboardQuickActions />

                {/* Infrastructure & team overview */}
                <DashboardClusterHealth />
                <DashboardTeamPresence />
                <DashboardNotificationsFeed />

                {/* 3D Preview + Jobs & Analyses */}
                <Container className='dashboard-bottom-row'>
                    <DashboardPreviewCard />

                    <Container className='dashboard-bottom-sidebar'>
                        <Container className='dashboard-jobs-card'>
                            <Container className='d-flex items-center content-between w-max' style={{ padding: '1.25rem 1.25rem 0 1.25rem' }}>
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
                        </Container>

                        <DashboardRecentAnalyses />
                    </Container>
                </Container>

                {/* Simulations grid */}
                <Container className='dashboard-simulations-section'>
                    <Title className='font-size-4 color-primary font-weight-5'>Trajectories</Title>
                    <SimulationGrid />
                </Container>
            </Container>
        </TrajectoryUploaderContainer>
    );
};

export default DashboardPage;
