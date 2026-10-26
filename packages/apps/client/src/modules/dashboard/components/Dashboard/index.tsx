import { trajectoriesListingResource } from '@/modules/trajectory/hooks/trajectory/use-trajectories-listing';
import useTrajectoryFilePicker from '@/modules/trajectory/hooks/trajectory/use-trajectory-file-picker';
import useFolderSearchParam from '@/shared/ui/hooks/use-folder-search-param';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import SimulationGrid from '@/modules/trajectory/components/SimulationGrid';
import { Button } from '@heroui/react';
import { openModal } from '@/shared/ui/modal/use-modal-store';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import useTip from '@/shared/tips/use-tip';
import { FolderPlus, Server, Upload } from 'lucide-react';

const PAGE_CLASS = 'mx-auto flex h-full min-h-0 w-full max-w-[1440px] flex-col gap-6 p-4 max-[768px]:gap-3 max-[768px]:p-3';

const DashboardPage = () => {
    usePageTitle('Dashboard');

    const selectedTeam = useSelectedTeam();
    const { canAccess } = useTeamPermissions();
    const canCreateTrajectoryFolders = canAccess(['trajectory:create']);
    const { currentFolderId } = useFolderSearchParam();
    const { fileInputRef, handlePickerChange, openFilePicker, isUploading } = useTrajectoryFilePicker(undefined, currentFolderId);

    useTip('dashboard-drag-upload', {
        enabled: Boolean(selectedTeam)
    });

    if (!selectedTeam) {
        return (
            <div className={PAGE_CLASS}>
                <RecoveryState
                    icon={<Server size={20} />}
                    title='Create your first team'
                    description='Use the team creation dialog to finish setup and unlock the dashboard.'
                    className='w-full'
                />
            </div>
        );
    }

    return (
        <div className={PAGE_CLASS}>
            <div className='flex min-w-0 flex-row flex-wrap items-center justify-between gap-4 max-[768px]:gap-2'>
                <h3 className='text-2xl font-semibold text-foreground'>Trajectories</h3>
                {canCreateTrajectoryFolders && (
                    <div className='flex flex-row items-center gap-2'>
                        <input ref={fileInputRef} type='file' multiple hidden onChange={handlePickerChange} />
                        <Button
                            variant='secondary'
                            className='shrink-0'
                            onPress={() => openModal(trajectoriesListingResource.modalIds.newFolder)}
                        >
                            <FolderPlus size={18} aria-hidden='true' />
                            New folder
                        </Button>
                        <Button
                            variant='primary'
                            className='shrink-0'
                            onPress={openFilePicker}
                            isDisabled={isUploading}
                        >
                            <Upload size={18} aria-hidden='true' />
                            Upload
                        </Button>
                    </div>
                )}
            </div>
            <SimulationGrid />
        </div>
    );
};

export default DashboardPage;
