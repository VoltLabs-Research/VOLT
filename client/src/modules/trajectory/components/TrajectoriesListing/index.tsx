import useTrajectoriesListing, { trajectoriesListingResource } from '@/modules/trajectory/hooks/trajectory/use-trajectories-listing';
import type { TrajectoryListingRow } from '@/modules/trajectory/utilities/listing';
import { isTrajectoryFolderRow } from '@/modules/trajectory/utilities/listing';
import { NewFolderHeaderAction, getFolderHeaderMenuOptions } from '@/shared/presentation/components/FolderedListingHeaderControls';
import {
    createFolderedTitleColumn,
    FolderedDocumentListing,
    FolderedListingModals,
    useFolderedListingDashboardBreadcrumb
} from '@/shared/presentation/components/DocumentListing/foldered-listing';
import { Heading, StatusBadge, Text } from '@voltstack/bravais';
import { clusterColumn, dateColumn } from '@/shared/presentation/utilities/column-presets';
import useTip from '@/shared/tips/use-tip';
import { formatNumber, formatSize } from '@/shared/utils/format';
import { useMemo } from 'react';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';
import type { MenuOption } from '@/shared/presentation/types/menu';

const COLUMNS: ColumnConfig<TrajectoryListingRow>[] = [
    createFolderedTitleColumn<TrajectoryListingRow>({
        key: 'name',
        title: 'Name',
        isFolder: isTrajectoryFolderRow,
        resolveTitle: ({ name }) => name,
        skeletonWidth: 160
    }),
    {
        key: 'atoms',
        title: 'Atoms',
        render: (_value, row) => formatNumber(isTrajectoryFolderRow(row) ? 0 : row.atoms ?? 0),
        skeleton: { variant: 'text', width: 70 }
    },
    {
        key: 'framesCount',
        title: 'Frames',
        render: (_value, row) => formatNumber(isTrajectoryFolderRow(row) ? 0 : row.framesCount ?? 0),
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

    const listing = useTrajectoriesListing();
    const {
        breadcrumbs,
        canCreate,
        currentFolder,
        fileInputRef,
        handleCreate,
        handleDeleteCurrentFolder,
        handlePickerChange,
        handleRenameFolderOpen,
        isUploading,
        navigateToFolder
    } = listing;

    useFolderedListingDashboardBreadcrumb(breadcrumbs, navigateToFolder);

    const headerMenuOptions = useMemo<MenuOption[]>(() => getFolderHeaderMenuOptions({
        currentFolder,
        onRenameFolderOpen: handleRenameFolderOpen,
        onDeleteCurrentFolder: handleDeleteCurrentFolder
    }), [currentFolder, handleDeleteCurrentFolder, handleRenameFolderOpen]);

    return (
        <>
            <FolderedDocumentListing<TrajectoryListingRow, { folderId: string | null }>
                title={<Heading level={3} size='3xl' weight='medium' tone='primary' className='sm:font-size-4'>Trajectories</Heading>}
                columns={COLUMNS}
                listing={listing}
                defaultLimit={20}
                createButtonTitle={canCreate ? 'Upload' : undefined}
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
                        <NewFolderHeaderAction modalId={trajectoriesListingResource.modalIds.newFolder} />
                    </>
                )}
                headerMenuOptions={headerMenuOptions}
                emptyButtonIsLoading={isUploading}
            />

            <FolderedListingModals resource={trajectoriesListingResource} listing={listing} />
        </>
    );
}
