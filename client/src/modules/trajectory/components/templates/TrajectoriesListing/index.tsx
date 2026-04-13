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
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import { openModal } from '@/shared/presentation/components/Modal';
import { clusterColumn, dateColumn } from '@/shared/presentation/utilities/column-presets';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
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
            <Container className='d-flex items-center gap-075'>
                {isTrajectoryFolderRow(row) && (
                    <Container className='d-flex flex-center color-secondary'>
                        <Folder size={16} />
                    </Container>
                )}
                <Container className='overflow-hidden min-w-0'>
                    <span className='font-weight-6 color-secondary'>{String(value)}</span>
                </Container>
            </Container>
        ),
        skeleton: { variant: 'text', width: 160 }
    },
    {
        key: 'atoms',
        title: 'Atoms',
        render: (_value, row) => formatNumber(isTrajectoryFolderRow(row) ? 0 : row.frames[0]?.natoms ?? 0),
        skeleton: { variant: 'text', width: 70 }
    },
    clusterColumn<TrajectoryListingRow>({ isFolder: isTrajectoryFolderRow, width: 150 }),
    {
        key: 'status',
        title: 'Status',
        render: (value, row) => isTrajectoryFolderRow(row)
            ? <span className='font-size-2 color-muted'>-</span>
            : <StatusBadge status={String(value)} />,
        skeleton: { variant: 'rounded', width: 90, height: 24 }
    },
    {
        key: 'isPublic',
        title: 'Public',
        render: (value, row) => <span className='font-size-2 color-secondary'>{isTrajectoryFolderRow(row) ? '-' : value ? 'Yes' : 'No'}</span>,
        skeleton: { variant: 'text', width: 70 }
    },
    {
        key: 'framesCount',
        title: 'Frames',
        render: (_value, row) => formatNumber(isTrajectoryFolderRow(row) ? 0 : row.frames.length),
        skeleton: { variant: 'text', width: 70 }
    },
    {
        key: 'stats.totalSize',
        title: 'Size',
        render: (_value, row) => formatSize(isTrajectoryFolderRow(row) ? 0 : row.stats.totalSize),
        skeleton: { variant: 'text', width: 90 }
    },
    dateColumn<TrajectoryListingRow>('updatedAt', 'Updated At', {
        width: 110,
        withTitle: true
    }),
    dateColumn<TrajectoryListingRow>('createdAt', 'Created At', {
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
                title={<Title className='font-size-6 font-weight-5 sm:font-size-4 color-primary'>Trajectories</Title>}
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
