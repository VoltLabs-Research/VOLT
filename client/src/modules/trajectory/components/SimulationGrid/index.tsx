import SimulationSkeletonCard from '../SimulationSkeletonCard';
import SimulationCard from '../SimulationCard';
import SimulationFolderCard from '../SimulationFolderCard';
import discoverService from '@/modules/trajectory/api/services/discover-service';
import useDeleteSelectedTrajectories from '@/modules/trajectory/hooks/trajectory/use-delete-selected-trajectories';
import useDownloadSamples from '@/modules/trajectory/hooks/trajectory/use-download-samples';
import useTrajectoriesListing, {
    MOVE_TRAJECTORY_MODAL_ID,
    NEW_TRAJECTORY_FOLDER_MODAL_ID
} from '@/modules/trajectory/hooks/trajectory/use-trajectories-listing';
import {
    getTrajectoryListingFolderDroppableId,
    isTrajectoryFolderRow
} from '@/modules/trajectory/utilities/listing';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import MoveToFolderModal from '@/shared/presentation/components/MoveToFolderModal';
import NewFolderModal from '@/shared/presentation/components/NewFolderModal';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import Box from '@/shared/presentation/primitives/Box';
import { ChevronRight, Download, Upload } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { useEffect, useCallback, useMemo, useState } from 'react';
import type { DiscoverTeamSummary } from '@/modules/trajectory/api/services/discover-service';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';
import type { TrajectoryListingRow } from '@/modules/trajectory/utilities/listing';
import './SimulationGrid.css';

export type SimulationGridItem = TrajectoryListingRow;

export interface PublicSimulationGridSummary {
    team: DiscoverTeamSummary | null;
    total: number;
}

interface SimulationGridProps {
    mode?: 'dashboard' | 'public';
    teamId?: string;
    onPublicListingChange?: (summary: PublicSimulationGridSummary) => void;
}

interface SimulationBreadcrumbItem {
    key: string;
    title: string;
    folderId: string | null;
}

interface DroppableSimulationBreadcrumbProps {
    item: SimulationBreadcrumbItem;
    isCurrent: boolean;
    onOpen: (folderId: string | null) => void;
}

const DroppableSimulationBreadcrumb = ({ item, isCurrent, onOpen }: DroppableSimulationBreadcrumbProps) => {
    const {
        setNodeRef,
        isOver
    } = useDroppable({
        id: getTrajectoryListingFolderDroppableId(item.folderId)
    });

    const className = [
        'trajectory-breadcrumb-drop-target',
        isOver ? 'is-drag-over' : ''
    ].filter(Boolean).join(' ');

    if (isCurrent) {
        return (
            <span
                ref={setNodeRef}
                className={`${className} volt-breadcrumbs__current`}
                aria-current='page'
                title={item.title}
            >
                {item.title}
            </span>
        );
    }

    return (
        <button
            ref={setNodeRef}
            type='button'
            className={`${className} volt-breadcrumbs__trigger`}
            onClick={() => onOpen(item.folderId)}
            title={item.title}
            aria-label={`Open ${item.title}`}
        >
            {item.title}
        </button>
    );
};

interface DroppableSimulationBreadcrumbsProps {
    items: SimulationBreadcrumbItem[];
    onOpen: (folderId: string | null) => void;
}

const DroppableSimulationBreadcrumbs = ({ items, onOpen }: DroppableSimulationBreadcrumbsProps) => {
    if (!items.length) {
        return null;
    }

    return (
        <Box className='dashboard-simulations-breadcrumbs'>
            <nav className='volt-breadcrumbs trajectory-breadcrumbs' aria-label='Folder breadcrumbs'>
                <ol className='volt-breadcrumbs__list'>
                    {items.map((item, index) => (
                        <li key={item.key} className='volt-breadcrumbs__item trajectory-breadcrumb-wrapper'>
                            {index > 0 ? (
                                <ChevronRight size={12} className='volt-breadcrumbs__separator' aria-hidden='true' />
                            ) : null}
                            <DroppableSimulationBreadcrumb
                                item={item}
                                isCurrent={index === items.length - 1}
                                onOpen={onOpen}
                            />
                        </li>
                    ))}
                </ol>
            </nav>
        </Box>
    );
};

const StaticSimulationBreadcrumbs = ({ items, onOpen }: DroppableSimulationBreadcrumbsProps) => {
    if (!items.length) {
        return null;
    }

    return (
        <Box className='dashboard-simulations-breadcrumbs'>
            <nav className='volt-breadcrumbs trajectory-breadcrumbs' aria-label='Folder breadcrumbs'>
                <ol className='volt-breadcrumbs__list'>
                    {items.map((item, index) => {
                        const isCurrent = index === items.length - 1;

                        return (
                            <li key={item.key} className='volt-breadcrumbs__item trajectory-breadcrumb-wrapper'>
                                {index > 0 ? (
                                    <ChevronRight size={12} className='volt-breadcrumbs__separator' aria-hidden='true' />
                                ) : null}
                                {isCurrent ? (
                                    <span
                                        className='volt-breadcrumbs__current'
                                        aria-current='page'
                                        title={item.title}
                                    >
                                        {item.title}
                                    </span>
                                ) : (
                                    <button
                                        type='button'
                                        className='volt-breadcrumbs__trigger'
                                        onClick={() => onOpen(item.folderId)}
                                        title={item.title}
                                        aria-label={`Open ${item.title}`}
                                    >
                                        {item.title}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </nav>
        </Box>
    );
};

const PUBLIC_DISCOVERY_DEFAULT_LIMIT = 20;

const buildPublicDiscoveryQueryKey = (teamId: string | undefined) => [
    'discover',
    'team-trajectories',
    teamId ?? ''
] as const;

function PublicSimulationGrid({
    teamId,
    onPublicListingChange
}: Pick<SimulationGridProps, 'teamId' | 'onPublicListingChange'>) {
    const fetchData = useCallback(async (params: PaginationParams) => {
        if (!teamId) {
            throw new Error('Team ID is required to load public trajectories.');
        }

        const response = await discoverService.listPublicTeamTrajectories({
            teamId,
            page: params.page,
            limit: params.limit,
            search: params.search
        });

        onPublicListingChange?.({
            team: response._meta?.team ?? null,
            total: response.pagination.total
        });

        return response;
    }, [onPublicListingChange, teamId]);

    const renderGridItem = useCallback((trajectory: Trajectory) => (
        <SimulationCard
            trajectory={trajectory}
            isSelected={false}
            readOnly
        />
    ), []);

    const renderGridSkeleton = useCallback(() => (
        <SimulationSkeletonCard n={8} />
    ), []);

    return (
        <DocumentListing<Trajectory>
            title='Public trajectories'
            queryKey={buildPublicDiscoveryQueryKey(teamId)}
            view='grid'
            fetchData={fetchData}
            defaultLimit={PUBLIC_DISCOVERY_DEFAULT_LIMIT}
            renderGridItem={renderGridItem}
            renderGridSkeleton={renderGridSkeleton}
            hideHeader
            hideTabs
            includeCopyDocumentId={false}
            emptyTitle='No public trajectories'
            emptyMessage='This team has no public trajectories.'
            gridClassName='public-simulation-grid'
        />
    );
}

function DashboardSimulationGrid() {
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
        getMenuOptions,
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
        queryKey,
        dragAndDrop,
        socketInvalidation
    } = useTrajectoriesListing();
    const simulationDragAndDrop = useMemo(() => dragAndDrop ? ({
        ...dragAndDrop,
        showDragAffordance: false
    }) : undefined, [dragAndDrop]);

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
                onMoveToFolder={handleMoveTrajectoryOpen}
            />
        );
    }, [getMenuOptions, handleFolderOpen, handleMoveTrajectoryOpen, isSelected]);

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

    const breadcrumbItems = useMemo<SimulationBreadcrumbItem[]>(() => {
        return breadcrumbs.map((crumb) => ({
            key: crumb.id ?? 'root',
            title: crumb.title,
            folderId: crumb.id ?? null
        }));
    }, [breadcrumbs]);

    const shouldShowBreadcrumbs = breadcrumbs.length > 1;
    const breadcrumbsContent = shouldShowBreadcrumbs
        ? simulationDragAndDrop ? (
            <DroppableSimulationBreadcrumbs
                items={breadcrumbItems}
                onOpen={navigateToFolder}
            />
        ) : (
            <StaticSimulationBreadcrumbs
                items={breadcrumbItems}
                onOpen={navigateToFolder}
            />
        )
        : null;

    return (
        <>
            <input
                ref={fileInputRef}
                type='file'
                multiple
                hidden
                onChange={handlePickerChange}
            />
            <DocumentListing<SimulationGridItem, { folderId: string | null }>
                title='Trajectories'
                queryKey={queryKey}
                view='grid'
                fetchData={fetchData}
                context={context}
                renderGridItem={renderGridItem}
                gridBeforeContent={breadcrumbsContent}
                getMenuOptions={getMenuOptions}
                dragAndDrop={simulationDragAndDrop}
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

export default function SimulationGrid({
    mode = 'dashboard',
    teamId,
    onPublicListingChange
}: SimulationGridProps) {
    if (mode === 'public') {
        return (
            <PublicSimulationGrid
                teamId={teamId}
                onPublicListingChange={onPublicListingChange}
            />
        );
    }

    return <DashboardSimulationGrid />;
}
