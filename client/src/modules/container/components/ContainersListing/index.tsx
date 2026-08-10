import ContainerTerminal from '../ContainerTerminal';
import DockerNeededState from '@/shared/ui/components/DockerNeededState';
import { useContainerRuntimeAvailability } from '@/modules/cluster/hooks/use-container-runtime-availability';
import useContainersListing, { containersListingResource } from '@/modules/container/hooks/use-containers-listing';
import type { ContainerListingRow } from '@/modules/container/contracts/listing';
import { isContainerFolderRow } from '@/modules/container/utils/listing';
import { NewFolderHeaderAction, getFolderHeaderMenuOptions } from '@/shared/ui/components/FolderedListingHeaderControls';
import {
    createFolderedTitleColumn,
    FolderedDocumentListing,
    FolderedListingModals,
    useFolderedListingDashboardBreadcrumb
} from '@/shared/ui/components/DocumentListing/foldered-listing';
import { clusterColumn, dateColumn } from '@/shared/ui/utils/column-presets';
import useTip from '@/shared/tips/use-tip';
import { formatSize } from '@/shared/utils/format';
import { useMemo } from 'react';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { MenuOption } from '@/shared/contracts/menu';

const ContainersListing = () => {
    useTip('containers-organization');

    const containerRuntime = useContainerRuntimeAvailability();

    const columns: ColumnConfig<ContainerListingRow>[] = [
        createFolderedTitleColumn<ContainerListingRow>({
            key: 'name',
            title: 'Name',
            isFolder: isContainerFolderRow,
            resolveTitle: ({ name }) => name,
            skeletonWidth: 180
        }),
        {
            key: 'image',
            title: 'Image',
            sortable: true,
            render: (value, row) => <span className='text-sm text-muted'>{isContainerFolderRow(row) ? '-' : String(value)}</span>,
            skeleton: {
                variant: 'text',
                width: 150
            }
        },
        clusterColumn<ContainerListingRow>({ isFolder: isContainerFolderRow }),
        {
            key: 'cpus',
            title: 'Cores',
            sortable: true,
            render: (value, row) => <span className='text-sm text-muted'>{isContainerFolderRow(row) ? '-' : String(value)}</span>,
            skeleton: {
                variant: 'text',
                width: 70
            }
        },
        {
            key: 'memory',
            title: 'RAM',
            sortable: true,
            render: (value, row) => {
                if (isContainerFolderRow(row)) {
                    return <span className='text-sm text-muted'>-</span>;
                }

                return <span className='text-sm text-muted'>{formatSize(Number(value) * 1024 * 1024)}</span>;
            },
            skeleton: {
                variant: 'text',
                width: 90
            }
        },
        dateColumn<ContainerListingRow>('updatedAt', 'Updated At', {
            width: 110,
            withTitle: true
        })
    ];

    const listing = useContainersListing();
    const {
        breadcrumbs,
        canCreate,
        currentFolder,
        handleDeleteCurrentFolder,
        handleRenameFolderOpen,
        navigateToFolder,
        terminalContainer,
        closeTerminal
    } = listing;

    useFolderedListingDashboardBreadcrumb(breadcrumbs, navigateToFolder);

    const headerMenuOptions = useMemo<MenuOption[]>(() => getFolderHeaderMenuOptions({
        currentFolder,
        onRenameFolderOpen: handleRenameFolderOpen,
        onDeleteCurrentFolder: handleDeleteCurrentFolder,
        newFolderModalId: containersListingResource.modalIds.newFolder
    }), [currentFolder, handleDeleteCurrentFolder, handleRenameFolderOpen]);

    if(containerRuntime === 'unavailable') return <DockerNeededState feature='Containers' />;

    return (
        <>
            <FolderedDocumentListing<ContainerListingRow, { folderId: string | null }>
                title={<h3 className='text-3xl font-medium text-foreground'>Containers</h3>}
                columns={columns}
                listing={listing}
                createButtonTitle={canCreate ? 'New Container' : undefined}
                headerActions={<NewFolderHeaderAction modalId={containersListingResource.modalIds.newFolder} />}
                headerMenuOptions={headerMenuOptions}
                emptyMessage='No containers found in this location.'
            />

            <FolderedListingModals resource={containersListingResource} listing={listing} />

            {terminalContainer && (
                <ContainerTerminal
                    container={terminalContainer}
                    onClose={closeTerminal}
                />
            )}
        </>
    );
};

export default ContainersListing;
