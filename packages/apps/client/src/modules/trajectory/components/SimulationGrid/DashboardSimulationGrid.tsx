import { useKeyboardShortcut } from '@/shared/ui/hooks/use-keyboard-shortcut';
import SimulationSkeletonCard from '../SimulationSkeletonCard';
import SimulationCard from '../SimulationCard';
import SimulationFolderCard from '../SimulationFolderCard';
import SimulationFolderDraftCard from '../SimulationFolderCard/SimulationFolderDraftCard';
import SimulationBreadcrumbs from './SimulationBreadcrumbs';
import useDeleteSelectedTrajectories from './use-delete-selected-trajectories';
import useDownloadSamples from './use-download-samples';
import useTrajectoriesListing, { trajectoriesListingResource } from '@/modules/trajectory/hooks/trajectory/use-trajectories-listing';
import { isTrajectoryFolderRow } from '@/modules/trajectory/utils/listing';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import { FolderedListingModals } from '@/shared/ui/components/DocumentListing/foldered-listing';
import useSelectionParams from '@/shared/ui/hooks/use-selection-params';
import { discardFolderDraft, useFolderDraftId } from '@/shared/ui/hooks/use-folder-draft-store';
import { Atom, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TrajectoryFolderRow, TrajectoryListingRow } from '@/modules/trajectory/contracts/listing';

const DELETE_SHORTCUT_KEYS = ['Backspace', 'Delete'];

// The dashboard's "New folder" names the folder in place, as a card at the head of the grid.
export const TRAJECTORY_FOLDER_DRAFT_KEY = trajectoriesListingResource.modalIds.newFolder;

const renderGridSkeleton = () => <SimulationSkeletonCard />;

const DashboardSimulationGrid = () => {
    const { selectedIds, isSelected, clearSelection } = useSelectionParams();
    const deleteSelectedTrajectories = useDeleteSelectedTrajectories();
    const { downloadAllSamples, isDownloading } = useDownloadSamples();
    const [hasDownloadedSamples, setHasDownloadedSamples] = useState(false);
    // The folder whose card title is being edited: its menu's Rename edits the title in place, as a
    // double click on it does, rather than in a modal.
    const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
    const startFolderRename = useCallback((folder: TrajectoryFolderRow) => setRenamingFolderId(folder._id), []);
    const listing = useTrajectoriesListing({ onRenameFolder: startFolderRename });
    const {
        breadcrumbs,
        canManageFolders,
        context,
        currentFolderId,
        fetchData,
        fileInputRef,
        getMenuOptions,
        handleCreate,
        handleCreateFolder,
        handleMoveOpen,
        handlePickerChange,
        isUploading,
        navigateToFolder,
        openFolder,
        queryKey,
        renameFolder,
        dragAndDrop,
        socketInvalidation
    } = listing;
    const simulationDragAndDrop = useMemo(() => dragAndDrop ? ({
        ...dragAndDrop,
        showDragAffordance: false
    }) : undefined, [dragAndDrop]);

    const folderDraftId = useFolderDraftId(TRAJECTORY_FOLDER_DRAFT_KEY);
    const discardDraft = useCallback(() => discardFolderDraft(TRAJECTORY_FOLDER_DRAFT_KEY), []);

    // A draft belongs to the folder it was started in, and to this page.
    useEffect(() => discardDraft, [currentFolderId, discardDraft]);

    const handleDeleteShortcut = useCallback(() => {
        void (async () => {
            await deleteSelectedTrajectories();
            clearSelection();
        })();
    }, [deleteSelectedTrajectories, clearSelection]);

    useKeyboardShortcut(DELETE_SHORTCUT_KEYS, handleDeleteShortcut, {
        mod: true,
        enabled: selectedIds.length > 0
    });

    const handleFolderOpen = useCallback((folderId: string) => {
        clearSelection();
        openFolder(folderId);
    }, [clearSelection, openFolder]);

    const handleFolderRename = useCallback((folderId: string, title: string) => {
        // The toast reports a failure.
        renameFolder(folderId, title).catch(() => undefined);
    }, [renameFolder]);

    const handleFolderRenamingChange = useCallback((folderId: string, isRenaming: boolean) => {
        setRenamingFolderId((current) => {
            if (isRenaming) return folderId;
            return current === folderId ? null : current;
        });
    }, []);

    const renderGridItem = useCallback((item: TrajectoryListingRow) => {
        if (isTrajectoryFolderRow(item)) {
            return (
                <SimulationFolderCard
                    folder={item}
                    onOpen={handleFolderOpen}
                    menuOptions={getMenuOptions?.(item, [])}
                    onRename={canManageFolders ? handleFolderRename : undefined}
                    isRenaming={renamingFolderId === item._id}
                    onRenamingChange={handleFolderRenamingChange}
                />
            );
        }

        return (
            <SimulationCard
                trajectory={item}
                isSelected={isSelected(item._id)}
                onMoveToFolder={handleMoveOpen}
            />
        );
    }, [canManageFolders, getMenuOptions, handleFolderOpen, handleFolderRename, handleFolderRenamingChange, handleMoveOpen, isSelected, renamingFolderId]);

    const handleDownloadSamples = async () => {
        await downloadAllSamples();
        setHasDownloadedSamples(true);
    };

    const emptyState = currentFolderId || hasDownloadedSamples
        ? {
            icon: <Upload size={24} strokeWidth={1.5} />,
            title: currentFolderId ? 'No trajectories in this folder' : 'Sample simulations ready',
            message: currentFolderId
                ? 'Upload a trajectory here or create another nested folder to keep things organized.'
                : 'The sample simulations were downloaded. Now upload any of those files to start working.',
            buttonText: 'Upload trajectory',
            onButtonClick: handleCreate,
            buttonIsLoading: isUploading
        }
        : {
            icon: <Atom size={24} strokeWidth={1.5} />,
            title: 'No simulations yet',
            message: 'Download the sample simulations to get started. After that, upload any of those files here.',
            buttonText: 'Download sample simulations',
            onButtonClick: handleDownloadSamples,
            buttonIsLoading: isDownloading
        };

    return (
        <>
            <input
                ref={fileInputRef}
                type='file'
                multiple
                hidden
                onChange={handlePickerChange}
            />
            <DocumentListing<TrajectoryListingRow, { folderId: string | null }>
                title='Trajectories'
                queryKey={queryKey}
                view='grid'
                fetchData={fetchData}
                context={context}
                renderGridItem={renderGridItem}
                gridLeadingContent={folderDraftId !== null ? (
                    <SimulationFolderDraftCard
                        key={folderDraftId}
                        onCreate={handleCreateFolder}
                        onDiscard={() => discardFolderDraft(TRAJECTORY_FOLDER_DRAFT_KEY, folderDraftId)}
                    />
                ) : null}
                gridBeforeContent={breadcrumbs.length > 1 ? (
                    <SimulationBreadcrumbs
                        items={breadcrumbs}
                        onOpen={navigateToFolder}
                        droppable={!!simulationDragAndDrop}
                    />
                ) : null}
                getMenuOptions={getMenuOptions}
                dragAndDrop={simulationDragAndDrop}
                hideHeader={true}
                hideTabs={true}
                renderGridSkeleton={renderGridSkeleton}
                gridClassName='gap-4 max-md:p-0'
                emptyIcon={emptyState.icon}
                emptyTitle={emptyState.title}
                emptyMessage={emptyState.message}
                emptyButtonText={emptyState.buttonText}
                emptyButtonIsLoading={emptyState.buttonIsLoading}
                onEmptyButtonClick={emptyState.onButtonClick}
                socketInvalidation={socketInvalidation}
            />
            <FolderedListingModals resource={trajectoriesListingResource} listing={listing} />
        </>
    );
};

export default DashboardSimulationGrid;
