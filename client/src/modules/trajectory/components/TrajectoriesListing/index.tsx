import useDashboardHeaderContent from '@/modules/dashboard/hooks/use-dashboard-header-content';
import useTrajectoriesListing, {
    MOVE_TRAJECTORY_MODAL_ID,
    NEW_TRAJECTORY_FOLDER_MODAL_ID,
    RENAME_TRAJECTORY_FOLDER_MODAL_ID
} from '@/modules/trajectory/hooks/trajectory/use-trajectories-listing';
import type { TrajectoryListingRow } from '@/modules/trajectory/utilities/listing';
import { isTrajectoryFolderRow } from '@/modules/trajectory/utilities/listing';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import MoveToFolderModal from '@/shared/presentation/components/MoveToFolderModal';
import NewFolderModal from '@/shared/presentation/components/NewFolderModal';
import RenameFolderModal from '@/shared/presentation/components/RenameFolderModal';
import { Button, Row, Box, Heading, StatusBadge, Text, openModal } from '@/shared/presentation/primitives';
import { clusterColumn, dateColumn } from '@/shared/presentation/utilities/column-presets';
import useTip from '@/shared/tips/use-tip';
import { formatNumber, formatSize } from '@/shared/utils/format';
import { Folder, Pencil, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type { ColumnConfig, MenuOption } from '@/shared/presentation/components/DocumentListing';

const COLUMNS: ColumnConfig<TrajectoryListingRow>[] = [
    {
        key: 'name',
        title: 'Name',
        sortable: true,
        render: (value, row) => (
            <Row gap='075'>
                {isTrajectoryFolderRow(row) && (
                    <Row className='flex-center color-secondary'>
                        <Folder size={16} />
                    </Row>
                )}
                <Box overflow='hidden' minW='0'>
                    <span className='font-weight-6 color-secondary'>{String(value)}</span>
                </Box>
            </Row>
        ),
        skeleton: { variant: 'text', width: 160 }
    },
    {
        key: 'atoms',
        title: 'Atoms',
        render: (_value, row) => formatNumber(isTrajectoryFolderRow(row) ? 0 : row.frames?.[0]?.natoms ?? 0),
        skeleton: { variant: 'text', width: 70 }
    },
    {
        key: 'framesCount',
        title: 'Frames',
        render: (_value, row) => formatNumber(isTrajectoryFolderRow(row) ? 0 : row.frames?.length ?? 0),
        skeleton: { variant: 'text', width: 70 }
    },
    {
        key: 'stats.totalSize',
        title: 'Size',
        render: (_value, row) => formatSize(isTrajectoryFolderRow(row) ? 0 : row.stats.totalSize),
        skeleton: { variant: 'text', width: 90 }
    },
    {
        key: 'status',
        title: 'Status',
        render: (value, row) => isTrajectoryFolderRow(row)
            ? <Text size='md' tone='muted'>-</Text>
            : <StatusBadge status={String(value)} />,
        skeleton: { variant: 'rounded', width: 90, height: 24 }
    },
    clusterColumn<TrajectoryListingRow>({ isFolder: isTrajectoryFolderRow, width: 150, key: 'storageClusterId' }),
    dateColumn<TrajectoryListingRow>('updatedAt', 'Updated At', {
        width: 110,
        withTitle: true
    })
];

export default function TrajectoriesListing() {
    useTip('trajectories-organization');

    const {
        breadcrumbs,
        canCreate,
        context,
        currentFolder,
        dragAndDrop,
        fetchData,
        fileInputRef,
        getMenuOptions,
        getMoveFolder,
        handleCreate,
        handleCreateFolder,
        handleDeleteCurrentFolder,
        handleItemClick,
        handleMoveTrajectoryClose,
        handleMoveTrajectorySubmit,
        handlePickerChange,
        handleRenameFolderClose,
        handleRenameFolderOpen,
        handleRenameFolderSubmit,
        isUploading,
        listMoveFolders,
        movingTrajectory,
        navigateToFolder,
        queryKey,
        renamingFolder
    } = useTrajectoriesListing();

    const globalSearchBreadcrumb = useMemo(() => ({
        items: breadcrumbs,
        onNavigate: navigateToFolder
    }), [breadcrumbs, navigateToFolder]);

    useDashboardHeaderContent({ globalSearchBreadcrumb });

    const headerMenuOptions = useMemo<MenuOption[]>(() => {
        if (!currentFolder) {
            return [];
        }

        return [
            {
                label: 'Rename Folder',
                icon: Pencil,
                onClick: () => handleRenameFolderOpen(currentFolder)
            },
            {
                label: 'Delete Folder',
                icon: Trash2,
                onClick: () => handleDeleteCurrentFolder?.(),
                destructive: true,
                disabled: !handleDeleteCurrentFolder
            }
        ];
    }, [currentFolder, handleDeleteCurrentFolder, handleRenameFolderOpen]);

    return (
        <>
            <DocumentListing<TrajectoryListingRow, { folderId: string | null }>
                title={<Heading level={3} size='3xl' weight='medium' tone='primary' className='sm:font-size-4'>Trajectories</Heading>}
                queryKey={queryKey}
                columns={COLUMNS}
                context={context}
                fetchData={fetchData}
                defaultLimit={20}
                getMenuOptions={getMenuOptions}
                onItemClick={handleItemClick}
                dragAndDrop={dragAndDrop}
                emptyMessage='No trajectories found in this location.'
                emptyButtonText='Upload'
                onEmptyButtonClick={handleCreate}
                headerActions={(
                    <>
                        <input
                            ref={fileInputRef}
                            type='file'
                            multiple
                            hidden
                            onChange={handlePickerChange}
                        />
                        <Button
                            variant='ghost'
                            intent='neutral'
                            size='sm'
                            shape='rounded'
                            onClick={() => openModal(NEW_TRAJECTORY_FOLDER_MODAL_ID)}
                            title='Create folder'
                        >
                            <Folder size={14} />
                            New Folder
                        </Button>
                    </>
                )}
                headerMenuOptions={headerMenuOptions}
                createNew={canCreate ? {
                    buttonTitle: 'Upload',
                    onCreate: handleCreate
                } : undefined}
                emptyButtonIsLoading={isUploading}
                socketInvalidation={[
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
                ]}
            />

            <NewFolderModal
                id={NEW_TRAJECTORY_FOLDER_MODAL_ID}
                title='New Trajectory Folder'
                description='Create a folder in the current trajectories location.'
                onSubmit={handleCreateFolder}
            />
            <RenameFolderModal
                id={RENAME_TRAJECTORY_FOLDER_MODAL_ID}
                title='Rename Trajectory Folder'
                description='Update the current trajectory folder name.'
                folderName={renamingFolder?.title ?? null}
                onSubmit={handleRenameFolderSubmit}
                onClose={handleRenameFolderClose}
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
