import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import DashboardOverviewCard from '@/modules/dashboard/components/DashboardOverviewCard';
import DashboardOverviewSkeleton from '@/modules/dashboard/components/DashboardOverviewSkeleton';
import DashboardActivityCard from '@/modules/dashboard/components/DashboardActivityCard';
import DashboardOperationsCard from '@/modules/dashboard/components/DashboardOperationsCard';
import DashboardTeamPresence from '@/modules/dashboard/components/DashboardTeamPresence';
import useDashboardMetrics from '@/modules/dashboard/hooks/use-dashboard-metrics';
import { NEW_TRAJECTORY_FOLDER_MODAL_ID } from '@/modules/trajectory/hooks/trajectory/use-trajectories-listing';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import SimulationGrid from '@/modules/trajectory/components/SimulationGrid';
import Box from '@/shared/presentation/primitives/Box';
import Button from '@/shared/presentation/primitives/Button';
import Heading from '@/shared/presentation/primitives/Heading';
import Row from '@/shared/presentation/primitives/Row';
import EmptyState from '@/shared/presentation/primitives/EmptyState';
import { openModal } from '@/shared/presentation/primitives/Modal';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
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

    useTip('dashboard-drag-upload', {
        enabled: Boolean(selectedTeam)
    });

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
            <Box className='dashboard-bento'>
                <Box className='dashboard-bottom-row'>
                    <EmptyState
                        icon={<HiOutlineServerStack size={20} />}
                        title='Create your first team'
                        description='Use the team creation dialog to finish setup and unlock the dashboard.'
                        className='w-max'
                    />
                </Box>
            </Box>
        );
    }

    return (
        <Box className='dashboard-bento'>
            {statCards}

            <Box className='dashboard-simulations-section'>
                <Row justify='between' gap='1' className='dashboard-simulations-header'>
                    <Heading level={3} size='xl' weight='medium' tone='primary'>Trajectories</Heading>
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
                </Row>
                <SimulationGrid />
            </Box>

            <Box className='dashboard-insights-row'>
                <DashboardOperationsCard />
                <DashboardActivityCard />
                <DashboardTeamPresence />
            </Box>
        </Box>
    );
};

export default DashboardPage;
