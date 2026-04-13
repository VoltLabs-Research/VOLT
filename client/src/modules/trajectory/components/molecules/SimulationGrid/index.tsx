import SimulationSkeletonCard from '../../atoms/SimulationSkeletonCard';
import SimulationCard from '../SimulationCard';
import SimulationFolderCard from '../SimulationFolderCard';
import useDeleteSelectedTrajectories from '@/modules/trajectory/hooks/trajectory/use-delete-selected-trajectories';
import useDownloadSamples from '@/modules/trajectory/hooks/trajectory/use-download-samples';
import useTrajectoriesListing, {
    MOVE_TRAJECTORY_MODAL_ID,
    NEW_TRAJECTORY_FOLDER_MODAL_ID
} from '@/modules/trajectory/hooks/trajectory/use-trajectories-listing';
import { isTrajectoryFolderRow } from '@/modules/trajectory/utilities/listing';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import FolderBreadcrumbs from '@/shared/presentation/components/FolderBreadcrumbs';
import MoveToFolderModal from '@/shared/presentation/components/MoveToFolderModal';
import NewFolderModal from '@/shared/presentation/components/NewFolderModal';
import Container from '@/shared/presentation/components/Container';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import { Download, Upload } from 'lucide-react';
import { useEffect, useCallback, useMemo, useState } from 'react';
import type { TrajectoryListingRow } from '@/modules/trajectory/utilities/listing';

export type SimulationGridItem = TrajectoryListingRow;

export default function SimulationGrid() {
    const { selectedIds, isSelected, clearSelection } = useSelectionParams();
    const deleteSelectedTrajectories = useDeleteSelectedTrajectories();
    const { downloadAllSamples, isDownloading } = useDownloadSamples();
    const [hasDownloadedSamples, setHasDownloadedSamples] = useState(false);
    const {
        breadcrumbs,
        context,
        currentFolderId,
        fetchData,
        fileInputRef,
        getMoveFolder,
        handleCreate,
        handleCreateFolder,
        handleMoveTrajectoryClose,
        handleMoveTrajectoryOpen,
        handleMoveTrajectorySubmit,
        handlePickerChange,
        isUploading,
        listMoveFolders,
        movingTrajectory,
        navigateToFolder,
        openFolder,
        queryKey
    } = useTrajectoriesListing();

    const handleKeyDown = useCallback(async (e: KeyboardEvent) => {
        if (selectedIds.length === 0) {
            return;
        }

        const hasModifierKey = [e.ctrlKey, e.metaKey].some(Boolean);
        const isDeleteKey = ['Backspace', 'Delete'].includes(e.key);
        const isDeleteShortcut = hasModifierKey && isDeleteKey;
        if (isDeleteShortcut) {
            e.preventDefault();
            if (selectedIds.length) {
                await deleteSelectedTrajectories();
                clearSelection();
            }
        }
    }, [selectedIds.length, deleteSelectedTrajectories, clearSelection]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const handleFolderOpen = useCallback((folderId: string) => {
        clearSelection();
        openFolder(folderId);
    }, [clearSelection, openFolder]);

    const renderGridItem = useCallback((item: SimulationGridItem) => {
        if (isTrajectoryFolderRow(item)) {
            return (
                <SimulationFolderCard folder={item} onOpen={handleFolderOpen} />
            );
        }

        return (
            <SimulationCard
                trajectory={item}
                isSelected={isSelected(item._id)}
                onMoveToFolder={handleMoveTrajectoryOpen}
            />
        );
    }, [handleFolderOpen, handleMoveTrajectoryOpen, isSelected]);

    const renderGridSkeleton = useCallback(() => (
        <SimulationSkeletonCard />
    ), []);

    const handleDownloadSamples = useCallback(async () => {
        await downloadAllSamples();
        setHasDownloadedSamples(true);
    }, [downloadAllSamples]);

    const emptyStateConfig = useMemo(() => {
        if (currentFolderId) {
            return {
                icon: <Upload size={24} strokeWidth={1.5} />,
                title: 'No trajectories in this folder',
                message: 'Upload a trajectory here or create another nested folder to keep things organized.',
                buttonText: 'Upload trajectory',
                onButtonClick: handleCreate,
                buttonIsLoading: isUploading
            };
        }

        if (hasDownloadedSamples) {
            return {
                icon: <Upload size={24} strokeWidth={1.5} />,
                title: 'Sample simulations ready',
                message: 'The sample simulations were downloaded. Now upload any of those files to start working.',
                buttonText: 'Upload trajectory',
                onButtonClick: handleCreate,
                buttonIsLoading: isUploading
            };
        }

        return {
            icon: <Download size={24} strokeWidth={1.5} />,
            title: 'No simulations yet',
            message: 'Download the sample simulations to get started. After that, upload any of those files here.',
            buttonText: 'Download sample simulations',
            onButtonClick: handleDownloadSamples,
            buttonIsLoading: isDownloading
        };
    }, [currentFolderId, handleCreate, handleDownloadSamples, hasDownloadedSamples, isDownloading, isUploading]);

    const socketInvalidation = useMemo(() => ([
        {
            event: 'trajectory.created',
            queryKeys: [queryKey]
        },
        {
            event: 'trajectory.updated',
            queryKeys: [queryKey]
        },
        {
            event: 'trajectory.deleted',
            queryKeys: [queryKey]
        }
    ]), [queryKey]);

    const shouldShowBreadcrumbs = breadcrumbs.length > 1;

    return (
        <>
            <input
                ref={fileInputRef}
                type='file'
                multiple
                hidden
                onChange={handlePickerChange}
            />
            {shouldShowBreadcrumbs && (
                <Container className='dashboard-simulations-breadcrumbs'>
                    <FolderBreadcrumbs items={breadcrumbs} onNavigate={navigateToFolder} />
                </Container>
            )}
            <DocumentListing<SimulationGridItem, { folderId: string | null }>
                title='Trajectories'
                queryKey={queryKey}
                view='grid'
                fetchData={fetchData}
                context={context}
                renderGridItem={renderGridItem}
                hideHeader={true}
                hideTabs={true}
                renderGridSkeleton={renderGridSkeleton}
                emptyIcon={emptyStateConfig.icon}
                emptyTitle={emptyStateConfig.title}
                emptyMessage={emptyStateConfig.message}
                emptyButtonText={emptyStateConfig.buttonText}
                emptyButtonIsLoading={emptyStateConfig.buttonIsLoading}
                onEmptyButtonClick={emptyStateConfig.onButtonClick}
                socketInvalidation={socketInvalidation}
            />
            <NewFolderModal
                id={NEW_TRAJECTORY_FOLDER_MODAL_ID}
                title='New Trajectory Folder'
                description='Create a folder in the current trajectories location.'
                onSubmit={handleCreateFolder}
            />
            <MoveToFolderModal
                id={MOVE_TRAJECTORY_MODAL_ID}
                itemId={movingTrajectory?._id ?? null}
                itemName={movingTrajectory?.name ?? null}
                itemLabel='Trajectory'
                sourceFolderId={movingTrajectory?.folder ?? null}
                listFolders={listMoveFolders}
                getFolder={getMoveFolder}
                onSubmit={handleMoveTrajectorySubmit}
                onClose={handleMoveTrajectoryClose}
            />
        </>
    );
}
