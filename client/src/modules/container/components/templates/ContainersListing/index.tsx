import ContainerTerminal from '../../organisms/ContainerTerminal';
import useContainersListing, {
    MOVE_CONTAINER_MODAL_ID,
    NEW_CONTAINER_FOLDER_MODAL_ID,
    RENAME_CONTAINER_FOLDER_MODAL_ID
} from '@/modules/container/hooks/use-containers-listing';
import type { ContainerListingRow } from '@/modules/container/utilities/listing';
import { isContainerFolderRow } from '@/modules/container/utilities/listing';
import useDashboardHeaderContent from '@/modules/dashboard/hooks/use-dashboard-header-content';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import MoveToFolderModal from '@/shared/presentation/components/MoveToFolderModal';
import NewFolderModal from '@/shared/presentation/components/NewFolderModal';
import RenameFolderModal from '@/shared/presentation/components/RenameFolderModal';
import Title from '@/shared/presentation/components/Title';
import { openModal } from '@/shared/presentation/components/Modal';
import { dateColumn } from '@/shared/presentation/utilities/column-presets';
import { Box, Folder, Pencil, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type { ColumnConfig, MenuOption } from '@/shared/presentation/components/DocumentListing';

const renderName: NonNullable<ColumnConfig<ContainerListingRow>['render']> = (value, row) => {
    const icon = isContainerFolderRow(row)
        ? <Folder size={16} />
        : <Box size={16} />;
    const subtitle = isContainerFolderRow(row)
        ? 'Folder'
        : row.containerId.substring(0, 12);

    return (
        <Container className='d-flex items-center gap-075'>
            <Container className='d-flex flex-center color-primary'>
                {icon}
            </Container>
            <Container className='d-flex column gap-025 overflow-hidden'>
                <span className='font-weight-6 color-primary'>{String(value)}</span>
                <span className='font-size-1 color-muted'>{subtitle}</span>
            </Container>
        </Container>
    );
};

const renderStatus: NonNullable<ColumnConfig<ContainerListingRow>['render']> = (value, row) => {
    if (isContainerFolderRow(row)) {
        return <span className='font-size-2 color-muted'>Folder</span>;
    }

    return <span className='font-size-2 color-secondary text-transform-capitalize'>{String(value)}</span>;
};

const COLUMNS: ColumnConfig<ContainerListingRow>[] = [
    {
        key: 'name',
        title: 'Name',
        sortable: true,
        render: renderName,
        skeleton: { variant: 'text', width: 180 }
    },
    {
        key: 'status',
        title: 'Status',
        sortable: true,
        width: 90,
        render: renderStatus,
        skeleton: { variant: 'text', width: 80 }
    },
    {
        key: 'image',
        title: 'Image',
        sortable: true,
        render: (value, row) => <span className='font-size-2 color-secondary'>{isContainerFolderRow(row) ? '—' : String(value)}</span>,
        skeleton: { variant: 'text', width: 150 }
    },
    {
        key: 'internalIp',
        title: 'Internal IP',
        render: (value, row) => <span className='font-size-2 color-secondary font-family-mono'>{isContainerFolderRow(row) ? '—' : String(value)}</span>,
        skeleton: { variant: 'text', width: 120 }
    },
    {
        key: 'ports',
        title: 'Ports',
        render: (_value, row) => {
            if (isContainerFolderRow(row)) {
                return <span className='font-size-2 color-muted'>—</span>;
            }

            const port = row.ports?.[0];
            if (!port) {
                return <span className='font-size-2 color-muted'>No ports</span>;
            }

            return <span className='font-size-2 font-weight-5'>{port.private} {'->'} {port.public}</span>;
        },
        skeleton: { variant: 'text', width: 100 }
    },
    dateColumn<ContainerListingRow>('createdAt', 'Created', {
        width: 90,
        withTitle: true
    })
];

const ContainersListing = () => {
    const {
        breadcrumbs,
        canCreate,
        context,
        currentFolder,
        dragAndDrop,
        fetchData,
        getMenuOptions,
        getMoveFolder,
        handleCreate,
        handleCreateFolder,
        handleDeleteCurrentFolder,
        handleItemClick,
        handleMoveContainerClose,
        handleMoveContainerSubmit,
        handleRenameFolderClose,
        handleRenameFolderOpen,
        handleRenameFolderSubmit,
        listMoveFolders,
        movingContainer,
        navigateToFolder,
        queryKey,
        renamingFolder,
        socketInvalidation,
        terminalContainer,
        closeTerminal
    } = useContainersListing();

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
            <DocumentListing<ContainerListingRow, { folderId: string | null }>
                title={<Title className='font-size-6 font-weight-5 sm:font-size-4'>Containers</Title>}
                queryKey={queryKey}
                columns={COLUMNS}
                context={context}
                fetchData={fetchData}
                getMenuOptions={getMenuOptions}
                onItemClick={handleItemClick}
                dragAndDrop={dragAndDrop}
                createNew={canCreate ? {
                    buttonTitle: 'New Container',
                    onCreate: handleCreate
                } : undefined}
                headerActions={
                    <Button
                        variant='ghost'
                        intent='neutral'
                        size='sm'
                        shape='rounded'
                        onClick={() => openModal(NEW_CONTAINER_FOLDER_MODAL_ID)}
                        title='Create folder'
                    >
                        <Folder size={14} />
                        New Folder
                    </Button>
                }
                headerMenuOptions={headerMenuOptions}
                emptyMessage='No containers found in this location.'
                socketInvalidation={socketInvalidation}
            />

            <NewFolderModal
                id={NEW_CONTAINER_FOLDER_MODAL_ID}
                title='New Container Folder'
                description='Create a folder in the current containers location.'
                onSubmit={handleCreateFolder}
            />
            <RenameFolderModal
                id={RENAME_CONTAINER_FOLDER_MODAL_ID}
                title='Rename Container Folder'
                description='Update the current container folder name.'
                folderName={renamingFolder?.title ?? null}
                onSubmit={handleRenameFolderSubmit}
                onClose={handleRenameFolderClose}
            />
            <MoveToFolderModal
                id={MOVE_CONTAINER_MODAL_ID}
                itemId={movingContainer?._id ?? null}
                itemName={movingContainer?.name ?? null}
                itemLabel='Container'
                sourceFolderId={movingContainer?.folder ?? null}
                listFolders={listMoveFolders}
                getFolder={getMoveFolder}
                onSubmit={handleMoveContainerSubmit}
                onClose={handleMoveContainerClose}
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
