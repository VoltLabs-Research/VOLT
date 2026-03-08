import { useMemo } from 'react';
import { HiOutlineServerStack } from 'react-icons/hi2';
import { FlaskConical, Puzzle } from 'lucide-react';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import useDashboardMetrics from '@/modules/dashboard/hooks/use-dashboard-metrics';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import EmptyState from '@/shared/presentation/components/EmptyState';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import DashboardOverviewCard from '@/modules/dashboard/components/atoms/DashboardOverviewCard';
import DashboardOverviewSkeleton from '@/modules/dashboard/components/atoms/DashboardOverviewSkeleton';
import DashboardTeamTimeline from '@/modules/dashboard/components/molecules/DashboardTeamTimeline';
import { DashboardQuickActions } from '@/modules/dashboard/components/molecules/DashboardQuickActions';
import DashboardInAppActivity from '@/modules/dashboard/components/molecules/DashboardInAppActivity';
import DashboardClusterHealth from '@/modules/dashboard/components/molecules/DashboardClusterHealth';
import DashboardTeamPresence from '@/modules/dashboard/components/molecules/DashboardTeamPresence';
import DashboardNotificationsFeed from '@/modules/dashboard/components/molecules/DashboardNotificationsFeed';
import DashboardPreviewCard from '@/modules/dashboard/components/molecules/DashboardPreviewCard';
import DashboardRecentAnalyses from '@/modules/dashboard/components/molecules/DashboardRecentAnalyses';
import JobsHistoryViewer from '@/modules/jobs/components/organisms/JobsHistoryViewer';
import SimulationGrid from '@/modules/trajectory/components/molecules/SimulationGrid';
import TrajectoryUploaderContainer from '@/modules/trajectory/components/organisms/TrajectoryUploaderContainer';
import type { DashboardCard } from '@/modules/dashboard/api/entities/dashboard';
import '../../atoms/DashboardContainer/DashboardContainer.css';
import './Dashboard.css';

const CARD_ICONS: Record<string, React.ReactNode> = {
    trajectories: <HiOutlineServerStack size={16} />,
    analysis: <FlaskConical size={16} strokeWidth={1.8} />
};

const getCardIcon = (key: string): React.ReactNode => {
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

    const selectedTeam = useSelectedTeam()!;
    const user = useCurrentUser();
    const { loading, cards, accessDenied, accessDeniedMessage } = useDashboardMetrics(selectedTeam._id);

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
                {accessDenied ? (
                    <Container className='dashboard-stat-card' style={{ gridColumn: 'span 4' }}>
                        <AccessDenied description={accessDeniedMessage} showBack={false} />
                    </Container>
                ) : loading ? (
                    <DashboardOverviewSkeleton count={3} />
                ) : (
                    cards.map((card: DashboardCard, index: number) => (
                        <DashboardOverviewCard
                            key={`${card.key}-${index}`}
                            card={card}
                            icon={getCardIcon(card.key)}
                        />
                    ))
                )}

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
