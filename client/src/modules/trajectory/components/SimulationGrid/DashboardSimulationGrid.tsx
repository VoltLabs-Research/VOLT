import { useKeyboardShortcut } from '@/shared/ui/hooks/use-keyboard-shortcut';
import SimulationSkeletonCard from '../SimulationSkeletonCard';
import SimulationCard from '../SimulationCard';
import SimulationFolderCard from '../SimulationFolderCard';
import SimulationBreadcrumbs from './SimulationBreadcrumbs';
import useDeleteSelectedTrajectories from './use-delete-selected-trajectories';
import useDownloadSamples from './use-download-samples';
import useTrajectoriesListing, { trajectoriesListingResource } from '@/modules/trajectory/hooks/trajectory/use-trajectories-listing';
import { isTrajectoryFolderRow } from '@/modules/trajectory/utils/listing';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import { FolderedListingModals } from '@/shared/ui/components/DocumentListing/foldered-listing';
import useSelectionParams from '@/shared/ui/hooks/use-selection-params';
import { Download, Upload } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { TrajectoryListingRow } from '@/modules/trajectory/contracts/listing';

const DELETE_SHORTCUT_KEYS = ['Backspace', 'Delete'];

const renderGridSkeleton = () => <SimulationSkeletonCard />;

const DashboardSimulationGrid = () => {
    const { selectedIds, isSelected, clearSelection } = useSelectionParams();
    const deleteSelectedTrajectories = useDeleteSelectedTrajectories();
    const { downloadAllSamples, isDownloading } = useDownloadSamples();
    const [hasDownloadedSamples, setHasDownloadedSamples] = useState(false);
    const listing = useTrajectoriesListing();
    const {
        breadcrumbs,
        context,
        currentFolderId,
        fetchData,
        fileInputRef,
        getMenuOptions,
        handleCreate,
        handleMoveOpen,
        handlePickerChange,
        isUploading,
        navigateToFolder,
        openFolder,
        queryKey,
        dragAndDrop,
        socketInvalidation
    } = listing;
    const simulationDragAndDrop = useMemo(() => dragAndDrop ? ({
        ...dragAndDrop,
        showDragAffordance: false
    }) : undefined, [dragAndDrop]);

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

    const renderGridItem = useCallback((item: TrajectoryListingRow) => {
        if (isTrajectoryFolderRow(item)) {
            return (
                <SimulationFolderCard
                    folder={item}
                    onOpen={handleFolderOpen}
                    menuOptions={getMenuOptions?.(item, [])}
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
    }, [getMenuOptions, handleFolderOpen, handleMoveOpen, isSelected]);

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
            icon: <Download size={24} strokeWidth={1.5} />,
            title: 'No simulations yet',
            message: 'Download the sample simulations to get started. After that, upload any of those files here.',
            buttonText: 'Download sample simulations',
            onButtonClick: handleDownloadSamples,
            buttonIsLoading: isDownloading
        };

    const breadcrumbItems = useMemo(() => breadcrumbs.map((crumb) => ({
        key: crumb.id ?? 'root',
        title: crumb.title,
        folderId: crumb.id ?? null
    })), [breadcrumbs]);

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
                gridBeforeContent={breadcrumbs.length > 1 ? (
                    <SimulationBreadcrumbs
                        items={breadcrumbItems}
                        onOpen={navigateToFolder}
                        droppable={!!simulationDragAndDrop}
                    />
                ) : null}
                getMenuOptions={getMenuOptions}
                dragAndDrop={simulationDragAndDrop}
                hideHeader={true}
                hideTabs={true}
                renderGridSkeleton={renderGridSkeleton}
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
