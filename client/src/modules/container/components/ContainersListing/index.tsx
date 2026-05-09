import ContainerTerminal from '../ContainerTerminal';
import useContainersListing, {
    MOVE_CONTAINER_MODAL_ID,
    NEW_CONTAINER_FOLDER_MODAL_ID,
    RENAME_CONTAINER_FOLDER_MODAL_ID
} from '@/modules/container/hooks/use-containers-listing';
import type { ContainerListingRow } from '@/modules/container/utilities/listing';
import { isContainerFolderRow } from '@/modules/container/utilities/listing';
import { NewFolderHeaderAction, getFolderHeaderMenuOptions } from '@/shared/presentation/components/FolderedListingHeaderControls';
import {
    createFolderedTitleColumn,
    FolderedDocumentListing,
    FolderedListingModals,
    useFolderedListingDashboardBreadcrumb
} from '@/shared/presentation/components/DocumentListing/foldered-listing';
import Heading from '@/shared/presentation/primitives/Heading';
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
            render: (value, row) => <span className='font-size-2 color-secondary'>{isContainerFolderRow(row) ? '-' : String(value)}</span>,
            skeleton: { variant: 'text', width: 150 }
        },
        clusterColumn<ContainerListingRow>({ isFolder: isContainerFolderRow }),
        {
            key: 'cpus',
            title: 'Cores',
            sortable: true,
            render: (value, row) => <span className='font-size-2 color-secondary'>{isContainerFolderRow(row) ? '-' : String(value)}</span>,
            skeleton: { variant: 'text', width: 70 }
        },
        {
            key: 'memory',
            title: 'RAM',
            sortable: true,
            render: (value, row) => {
                if (isContainerFolderRow(row)) {
                    return <span className='font-size-2 color-muted'>-</span>;
                }

                return <span className='font-size-2 color-secondary'>{formatSize(Number(value) * 1024 * 1024)}</span>;
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
        getMoveFolder,
        handleCreateFolder,
        handleDeleteCurrentFolder,
        handleMoveContainerClose,
        handleMoveContainerSubmit,
        handleRenameFolderClose,
        handleRenameFolderOpen,
        handleRenameFolderSubmit,
        listMoveFolders,
        movingContainer,
        navigateToFolder,
        renamingFolder,
        terminalContainer,
        closeTerminal
    } = listing;

    useFolderedListingDashboardBreadcrumb(breadcrumbs, navigateToFolder);

    const headerMenuOptions = useMemo<MenuOption[]>(() => getFolderHeaderMenuOptions({
        currentFolder,
        onRenameFolderOpen: handleRenameFolderOpen,
        onDeleteCurrentFolder: handleDeleteCurrentFolder,
        newFolderModalId: NEW_CONTAINER_FOLDER_MODAL_ID
    }), [currentFolder, handleDeleteCurrentFolder, handleRenameFolderOpen]);

    return (
        <>
            <FolderedDocumentListing<ContainerListingRow, { folderId: string | null }>
                title={<Heading level={3} size='3xl' weight='medium' className='sm:font-size-4'>Containers</Heading>}
                columns={columns}
                listing={listing}
                createButtonTitle={canCreate ? 'New Container' : undefined}
                headerActions={<NewFolderHeaderAction modalId={NEW_CONTAINER_FOLDER_MODAL_ID} />}
                headerMenuOptions={headerMenuOptions}
                emptyMessage='No containers found in this location.'
            />

            <FolderedListingModals
                newFolderModalId={NEW_CONTAINER_FOLDER_MODAL_ID}
                newFolderTitle='New Container Folder'
                newFolderDescription='Create a folder in the current containers location.'
                onCreateFolder={handleCreateFolder}
                renameFolderModalId={RENAME_CONTAINER_FOLDER_MODAL_ID}
                renameFolderTitle='Rename Container Folder'
                renameFolderDescription='Update the current container folder name.'
                renamingFolder={renamingFolder}
                onRenameFolderSubmit={handleRenameFolderSubmit}
                onRenameFolderClose={handleRenameFolderClose}
                moveModalId={MOVE_CONTAINER_MODAL_ID}
                movingItem={movingContainer}
                itemLabel='Container'
                listFolders={listMoveFolders}
                getFolder={getMoveFolder}
                onMoveSubmit={handleMoveContainerSubmit}
                onMoveClose={handleMoveContainerClose}
            />

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
