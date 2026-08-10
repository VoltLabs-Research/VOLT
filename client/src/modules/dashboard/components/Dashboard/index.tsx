import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import DashboardOverviewCard from '@/modules/dashboard/components/DashboardOverviewCard';
import DashboardOverviewSkeleton from '@/modules/dashboard/components/DashboardOverviewSkeleton';
import DashboardActivityTile from '@/modules/dashboard/components/DashboardActivityTile';
import useDashboardMetrics from '@/modules/dashboard/hooks/use-dashboard-metrics';
import { trajectoriesListingResource } from '@/modules/trajectory/hooks/trajectory/use-trajectories-listing';
import useTrajectoryFilePicker from '@/modules/trajectory/hooks/trajectory/use-trajectory-file-picker';
import useFolderSearchParam from '@/shared/ui/hooks/use-folder-search-param';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import SimulationGrid from '@/modules/trajectory/components/SimulationGrid';
import { Button, EmptyState, openModal } from '@voltstack/bravais';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { getTeamOwnerContactHint, toPermissionLabels } from '@/modules/dashboard/utils/access-denied-hints';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import useTip from '@/shared/tips/use-tip';
import './Dashboard.css';
import { FlaskConical, FolderPlus, Server, Upload } from 'lucide-react';
import type { DashboardCard as DashboardMetricsCard } from '@/modules/dashboard/contracts/cards';
import type { ReactNode } from 'react';

const CARD_ICONS: Record<string, ReactNode> = {
    trajectories: <Server size={16} />,
    analysis: <FlaskConical size={16} strokeWidth={1.8} />
};

const DashboardPage = () => {
    usePageTitle('Dashboard');

    const selectedTeam = useSelectedTeam();
    const { canAccess } = useTeamPermissions();
    const canCreateTrajectoryFolders = canAccess(['trajectory:create']);
    const { currentFolderId } = useFolderSearchParam();
    const { fileInputRef, handlePickerChange, openFilePicker, isUploading } = useTrajectoryFilePicker(undefined, currentFolderId);
    const { loading, error, cards, accessDenied, accessDeniedMessage } = useDashboardMetrics(selectedTeam?._id);

    useTip('dashboard-drag-upload', {
        enabled: Boolean(selectedTeam)
    });

    let statCards = cards.map((card: DashboardMetricsCard, index: number) => (
        <DashboardOverviewCard
            key={`${card.key}-${index}`}
            card={card}
            icon={CARD_ICONS[card.key]}
        />
    ));

    if (!accessDenied && !error && !loading) {
        statCards.push(<DashboardActivityTile key='activity-tile' />);
    }

    if (accessDenied) {
        statCards = [
            <DashboardCard key='denied' className='dashboard-stat-card' isRelative={true} overflowHidden={true} style={{ gridColumn: 'span 4' }}>
                <RecoveryState
                    title='Access denied'
                    description={accessDeniedMessage ?? 'You do not have permission to view dashboard metrics.'}
                    tone={RecoveryStateTone.AccessDenied}
                    requiredPermissions={toPermissionLabels(['trajectory:read'])}
                    contactHint={getTeamOwnerContactHint(selectedTeam)}
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

    if (!selectedTeam) {
        return (
            <div className='dashboard-bento'>
                <div className='dashboard-bottom-row'>
                    <EmptyState
                        icon={<Server size={20} />}
                        title='Create your first team'
                        description='Use the team creation dialog to finish setup and unlock the dashboard.'
                        className='w-full'
                    />
                </div>
            </div>
        );
    }

    return (
        <div className='dashboard-bento'>
            {statCards}

            <div className='dashboard-simulations-section'>
                <div className='flex flex-row items-center justify-between gap-4 dashboard-simulations-header'>
                    <h3 className='text-xl font-medium text-foreground'>Trajectories</h3>
                    {canCreateTrajectoryFolders && (
                        <div className='flex flex-row items-center gap-2'>
                            <input ref={fileInputRef} type='file' multiple hidden onChange={handlePickerChange} />
                            <Button
                                variant='ghost'
                                intent='neutral'
                                size='sm'
                                shape='rounded'
                                className='dashboard-simulations-new-folder-btn'
                                onClick={openFilePicker}
                                disabled={isUploading}
                            >
                                <Upload size={14} />
                                Upload
                            </Button>
                            <Button
                                variant='ghost'
                                intent='neutral'
                                size='sm'
                                shape='rounded'
                                className='dashboard-simulations-new-folder-btn'
                                onClick={() => openModal(trajectoriesListingResource.modalIds.newFolder)}
                            >
                                <FolderPlus size={14} />
                                New folder
                            </Button>
                        </div>
                    )}
                </div>
                <SimulationGrid />
            </div>
        </div>
    );
};

export default DashboardPage;
