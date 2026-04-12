import DashboardCard from '@/modules/dashboard/components/atoms/DashboardCard';
import DashboardOverviewCard from '@/modules/dashboard/components/atoms/DashboardOverviewCard';
import DashboardOverviewSkeleton from '@/modules/dashboard/components/atoms/DashboardOverviewSkeleton';
import DashboardClusterHealth from '@/modules/dashboard/components/molecules/DashboardClusterHealth';
import DashboardInAppActivity from '@/modules/dashboard/components/molecules/DashboardInAppActivity';
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
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import Title from '@/shared/presentation/components/Title';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import useTip from '@/shared/tips/use-tip';
import './Dashboard.css';
import { FlaskConical, FolderPlus } from 'lucide-react';
import { HiOutlineServerStack } from 'react-icons/hi2';
import type { DashboardCard as DashboardMetricsCard } from '@/modules/dashboard/api/entities/dashboard';
import type { ReactNode } from 'react';

const CARD_ICONS: Record<string, ReactNode> = {
    trajectories: <HiOutlineServerStack size={16} />,
    analysis: <FlaskConical size={16} strokeWidth={1.8} />
};

const getCardIcon = (key: string): ReactNode => {
    return CARD_ICONS[key];
};

const DashboardPage = () => {
    usePageTitle('Dashboard');

    const selectedTeam = useSelectedTeam();
    const { canAccess } = useTeamPermissions();
    const canCreateTrajectoryFolders = canAccess(['trajectory:create']);
    const { loading, error, cards, accessDenied, accessDeniedMessage } = useDashboardMetrics(selectedTeam?._id);
    const jobsStatusCounts = useJobStatusCounts();

    useTip('dashboard-drag-upload', {
        enabled: Boolean(selectedTeam)
    });
    const jobsEmptyState = (
        <EmptyState
            icon={<HiOutlineServerStack size={20} />}
            title='No jobs yet'
            description='Start a simulation or analysis to see activity here.'
            className='flex-1 dashboard-jobs-empty-state'
        />
    );

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
        statCards = [<DashboardOverviewSkeleton key='loading' count={2} />];
    }

    // TOOD: Possible dead code? We have now this:
    // /home/rodyherrera/Desktop/voltlabs-ecosystem/app/Volt/client/src/modules/onboarding/components/templates/PostAuthOnboarding/index.tsx
    if (!selectedTeam) {
        return (
            <Container className='dashboard-bento'>
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
            {statCards}

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

                <DashboardCard
                    className='dashboard-jobs-card d-flex column flex-1 min-h-0'
                    overflowHidden={true}
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
                    <Container className='dashboard-jobs-card-body d-flex column flex-1 min-h-0'>
                        <JobsHistoryViewer
                            variant='embedded'
                            displayMode='full'
                            hideAfterComplete={false}
                            emptyState={jobsEmptyState}
                        />
                    </Container>
                </DashboardCard>
            </Container>

            <DashboardTeamTimeline />
            <DashboardInAppActivity />
            <DashboardTeamPresence />
        </Container>
    );
};

export default DashboardPage;
