import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import DashboardCard from '@/modules/dashboard/components/atoms/DashboardCard';
import DashboardOverviewCard from '@/modules/dashboard/components/atoms/DashboardOverviewCard';
import DashboardOverviewSkeleton from '@/modules/dashboard/components/atoms/DashboardOverviewSkeleton';
import DashboardClusterHealth from '@/modules/dashboard/components/molecules/DashboardClusterHealth';
import DashboardInAppActivity from '@/modules/dashboard/components/molecules/DashboardInAppActivity';
import DashboardNotificationsFeed from '@/modules/dashboard/components/molecules/DashboardNotificationsFeed';
import { DashboardQuickActions } from '@/modules/dashboard/components/molecules/DashboardQuickActions';
import DashboardRecentAnalyses from '@/modules/dashboard/components/molecules/DashboardRecentAnalyses';
import DashboardTeamPresence from '@/modules/dashboard/components/molecules/DashboardTeamPresence';
import DashboardTeamTimeline from '@/modules/dashboard/components/molecules/DashboardTeamTimeline';
import StatusCounts from '@/modules/canvas/components/molecules/StatusCounts';
import useJobStatusCounts from '@/modules/canvas/hooks/use-job-status-counts';
import useDashboardMetrics from '@/modules/dashboard/hooks/use-dashboard-metrics';
import JobsHistoryViewer from '@/modules/jobs/components/organisms/JobsHistoryViewer';
import { NEW_TRAJECTORY_FOLDER_MODAL_ID } from '@/modules/trajectory/hooks/trajectory/use-trajectories-listing';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import SimulationGrid from '@/modules/trajectory/components/molecules/SimulationGrid';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import { openModal } from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import Title from '@/shared/presentation/components/Title';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import useTip from '@/shared/tips/use-tip';
import './Dashboard.css';
import { FlaskConical, FolderPlus, Puzzle } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { HiOutlineServerStack } from 'react-icons/hi2';
import type { DashboardCard as DashboardMetricsCard } from '@/modules/dashboard/api/entities/dashboard';
import type { FocusEventHandler, PointerEventHandler, ReactNode } from 'react';

enum DashboardBottomPanel {
    Jobs = 'jobs',
    Analyses = 'analyses'
};

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

const getSharedPanelStateClassName = (
    activePanel: DashboardBottomPanel | null,
    panel: DashboardBottomPanel
): string => {
    if (activePanel === null) {
        return '';
    }

    if (activePanel === panel) {
        return 'dashboard-shared-panel--expanded';
    }

    return 'dashboard-shared-panel--collapsed';
};

const DashboardPage = () => {
    usePageTitle('Dashboard');

    const selectedTeam = useSelectedTeam();
    const user = useCurrentUser();
    const { canAccess } = useTeamPermissions();
    const canCreateTrajectoryFolders = canAccess(['trajectory:create']);
    const { loading, error, cards, accessDenied, accessDeniedMessage } = useDashboardMetrics(selectedTeam?._id);
    const sharedPanelsRef = useRef<HTMLDivElement | null>(null);
    const [hoveredPanel, setHoveredPanel] = useState<DashboardBottomPanel | null>(null);
    const [focusedPanel, setFocusedPanel] = useState<DashboardBottomPanel | null>(null);
    const jobsStatusCounts = useJobStatusCounts();

    useTip('dashboard-drag-upload', {
        enabled: Boolean(selectedTeam)
    });

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
    const activePanel = focusedPanel ?? hoveredPanel;
    const jobsEmptyState = (
        <EmptyState
            icon={<HiOutlineServerStack size={20} />}
            title='No jobs yet'
            description='Start a simulation or analysis to see activity here.'
            className='flex-1 dashboard-jobs-empty-state'
        />
    );
    const jobsPanelClassName = useMemo(() => {
        return getSharedPanelStateClassName(activePanel, DashboardBottomPanel.Jobs);
    }, [activePanel]);
    const analysesPanelClassName = useMemo(() => {
        return getSharedPanelStateClassName(activePanel, DashboardBottomPanel.Analyses);
    }, [activePanel]);

    const handleSharedPanelsPointerLeave: PointerEventHandler<HTMLDivElement> = (event) => {
        if (event.pointerType !== 'mouse') {
            return;
        }

        setHoveredPanel(null);
    };

    const handleJobsPanelPointerEnter: PointerEventHandler<HTMLDivElement> = (event) => {
        if (event.pointerType !== 'mouse') {
            return;
        }

        setHoveredPanel(DashboardBottomPanel.Jobs);
    };

    const handleAnalysesPanelPointerEnter: PointerEventHandler<HTMLDivElement> = (event) => {
        if (event.pointerType !== 'mouse') {
            return;
        }

        setHoveredPanel(DashboardBottomPanel.Analyses);
    };

    const handleJobsPanelFocusCapture: FocusEventHandler<HTMLDivElement> = () => {
        setFocusedPanel(DashboardBottomPanel.Jobs);
    };

    const handleAnalysesPanelFocusCapture: FocusEventHandler<HTMLDivElement> = () => {
        setFocusedPanel(DashboardBottomPanel.Analyses);
    };

    const handleSharedPanelsBlurCapture: FocusEventHandler<HTMLDivElement> = (event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && sharedPanelsRef.current?.contains(nextTarget)) {
            return;
        }

        setFocusedPanel(null);
    };

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
        );
    }

    return (
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

            <Container className='dashboard-simulations-section'>
                <Container className='dashboard-simulations-header d-flex items-center content-between gap-1'>
                    <Title className='font-size-4 color-primary font-weight-5'>Trajectories</Title>
                    {canCreateTrajectoryFolders && (
                        <Button
                            variant='ghost'
                            intent='neutral'
                            size='sm'
                            shape='rounded'
                            className='dashboard-simulations-new-folder-btn'
                            onClick={() => openModal(NEW_TRAJECTORY_FOLDER_MODAL_ID)}
                        >
                            <FolderPlus size={14} />
                            New folder
                        </Button>
                    )}
                </Container>
                <SimulationGrid />
            </Container>

            <Container className='dashboard-bottom-row'>
                <DashboardClusterHealth />

                <Container
                    ref={sharedPanelsRef}
                    className='dashboard-bottom-sidebar'
                    onPointerLeave={handleSharedPanelsPointerLeave}
                    onBlurCapture={handleSharedPanelsBlurCapture}
                >
                    <DashboardCard
                        className={`dashboard-jobs-card dashboard-shared-panel d-flex column flex-1 min-h-0 ${jobsPanelClassName}`.trim()}
                        overflowHidden={true}
                        onPointerEnter={handleJobsPanelPointerEnter}
                        onFocusCapture={handleJobsPanelFocusCapture}
                        tabIndex={0}
                    >
                        <Container className='dashboard-jobs-card-header d-flex items-center content-between gap-1'>
                            <Title className='font-size-2 color-primary font-weight-6'>
                                Compute Jobs
                            </Title>
                            <StatusCounts
                                queued={jobsStatusCounts.queued}
                                running={jobsStatusCounts.running}
                                completed={jobsStatusCounts.completed}
                            />
                        </Container>
                        <Container className='dashboard-jobs-card-body dashboard-shared-panel-body d-flex column flex-1 min-h-0'>
                            <JobsHistoryViewer
                                variant='embedded'
                                displayMode='full'
                                hideAfterComplete={false}
                                emptyState={jobsEmptyState}
                            />
                        </Container>
                    </DashboardCard>

                    <DashboardRecentAnalyses
                        className={`dashboard-shared-panel ${analysesPanelClassName}`.trim()}
                        bodyClassName='dashboard-shared-panel-body'
                        onPointerEnter={handleAnalysesPanelPointerEnter}
                        onFocusCapture={handleAnalysesPanelFocusCapture}
                        tabIndex={0}
                    />
                </Container>
            </Container>

            <DashboardTeamTimeline />
            <DashboardInAppActivity />
            <DashboardQuickActions />
            <DashboardTeamPresence />
            <DashboardNotificationsFeed />
        </Container>
    );
};

export default DashboardPage;
