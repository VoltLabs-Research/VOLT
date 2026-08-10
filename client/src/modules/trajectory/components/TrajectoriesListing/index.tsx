import useTrajectoriesListing, { trajectoriesListingResource } from '@/modules/trajectory/hooks/trajectory/use-trajectories-listing';
import type { TrajectoryListingRow } from '@/modules/trajectory/contracts/listing';
import { isTrajectoryFolderRow } from '@/modules/trajectory/utils/listing';
import { NewFolderHeaderAction, getFolderHeaderMenuOptions } from '@/shared/ui/components/FolderedListingHeaderControls';
import {
    createFolderedTitleColumn,
    FolderedDocumentListing,
    FolderedListingModals,
    useFolderedListingDashboardBreadcrumb
} from '@/shared/ui/components/DocumentListing/foldered-listing';
import { clusterColumn, dateColumn } from '@/shared/ui/utils/column-presets';
import useTip from '@/shared/tips/use-tip';
import { formatNumber, formatSize } from '@/shared/utils/format';
import { useMemo } from 'react';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { MenuOption } from '@/shared/contracts/menu';

/**
 * bravais's `StatusBadge`, reduced to the one call shape this listing used: a free-form
 * `status` string looked up in the component's own STATUS_VARIANTS table.
 *
 * Three things are easy to lose and are the whole appearance. The badge had no background
 * and no border in any variant — it was coloured *uppercase text*, applied in CSS rather
 * than to the DOM string, so a `Chip` would add a pill that was never there. And the
 * status→variant map is not the identity: `status='active'` resolved to the SUCCESS colour
 * while `status='running'` resolved to the accent, which under VOLT's monochrome accent is
 * the foreground. `text-sm` meant 0.75rem in bravais, i.e. stock Tailwind's `text-xs`.
 */
const STATUS_TONE_CLASS: Record<string, string> = {
    ready: 'text-success',
    completed: 'text-success',
    success: 'text-success',
    active: 'text-success',
    published: 'text-success',
    healthy: 'text-success',
    online: 'text-success',
    accepted: 'text-success',
    connected: 'text-success',
    processing: 'text-warning',
    queued: 'text-warning',
    rendering: 'text-warning',
    warning: 'text-warning',
    pending: 'text-warning',
    'waiting-for-process': 'text-warning',
    analyzing: 'text-warning',
    running: 'text-foreground',
    failed: 'text-danger',
    error: 'text-danger',
    danger: 'text-danger',
    critical: 'text-danger',
    rejected: 'text-danger',
    inactive: 'text-muted',
    draft: 'text-muted',
    disabled: 'text-muted',
    offline: 'text-muted',
    disconnected: 'text-muted'
};

const STATUS_BADGE = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full text-xs font-medium uppercase';

const renderStatusBadge = (status: string) => (
    <span className={`${STATUS_BADGE} ${STATUS_TONE_CLASS[status.toLowerCase()] ?? 'text-muted'}`}>
        {status}
    </span>
);

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
        skeleton: {
            variant: 'text',
            width: 70
        }
    },
    {
        key: 'framesCount',
        title: 'Frames',
        render: (_value, row) => formatNumber(isTrajectoryFolderRow(row) ? 0 : row.framesCount ?? 0),
        skeleton: {
            variant: 'text',
            width: 70
        }
    },
    {
        key: 'stats.totalSize',
        title: 'Size',
        render: (_value, row) => formatSize(isTrajectoryFolderRow(row) ? 0 : row.stats.totalSize),
        skeleton: {
            variant: 'text',
            width: 90
        }
    },
    {
        key: 'status',
        title: 'Status',
        render: (value, row) => isTrajectoryFolderRow(row)
            ? <span className='text-sm text-muted'>-</span>
            : renderStatusBadge(String(value)),
        skeleton: {
            variant: 'rounded',
            width: 90,
            height: 24
        }
    },
    clusterColumn<TrajectoryListingRow>({
        isFolder: isTrajectoryFolderRow,
        width: 150,
        key: 'storageClusterId'
    }),
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
                title={(
                    <h3 className='text-3xl font-medium text-foreground sm:font-size-4'>Trajectories</h3>
                )}
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
