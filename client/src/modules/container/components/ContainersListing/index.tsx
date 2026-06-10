import ContainerTerminal from '../ContainerTerminal';
import useContainersListing, { containersListingResource } from '@/modules/container/hooks/use-containers-listing';
import type { ContainerListingRow } from '@/modules/container/utilities/listing';
import { isContainerFolderRow } from '@/modules/container/utilities/listing';
import { NewFolderHeaderAction, getFolderHeaderMenuOptions } from '@/shared/presentation/components/FolderedListingHeaderControls';
import {
    createFolderedTitleColumn,
    FolderedDocumentListing,
    FolderedListingModals,
    useFolderedListingDashboardBreadcrumb
} from '@/shared/presentation/components/DocumentListing/foldered-listing';
import { Heading, Text } from '@voltstack/bravais';
import { clusterColumn, dateColumn } from '@/shared/presentation/utilities/column-presets';
import useTip from '@/shared/tips/use-tip';
import { formatSize } from '@/shared/utils/format';
import { useMemo } from 'react';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';
import type { MenuOption } from '@/shared/presentation/types/menu';

const ContainersListing = () => {
    useTip('containers-organization');

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
            render: (value, row) => <Text as='span' size='md' tone='secondary'>{isContainerFolderRow(row) ? '-' : String(value)}</Text>,
            skeleton: { variant: 'text', width: 150 }
        },
        clusterColumn<ContainerListingRow>({ isFolder: isContainerFolderRow }),
        {
            key: 'cpus',
            title: 'Cores',
            sortable: true,
            render: (value, row) => <Text as='span' size='md' tone='secondary'>{isContainerFolderRow(row) ? '-' : String(value)}</Text>,
            skeleton: { variant: 'text', width: 70 }
        },
        {
            key: 'memory',
            title: 'RAM',
            sortable: true,
            render: (value, row) => {
                if (isContainerFolderRow(row)) {
                    return <Text as='span' size='md' tone='muted'>-</Text>;
                }

                return <Text as='span' size='md' tone='secondary'>{formatSize(Number(value) * 1024 * 1024)}</Text>;
            },
            skeleton: { variant: 'text', width: 90 }
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

    return (
        <>
            <FolderedDocumentListing<ContainerListingRow, { folderId: string | null }>
                title={<Heading level={3} size='3xl' weight='medium' className='sm:font-size-4'>Containers</Heading>}
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
