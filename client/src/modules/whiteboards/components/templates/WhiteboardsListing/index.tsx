import useWhiteboardsListing, {
    MOVE_WHITEBOARD_MODAL_ID,
    NEW_WHITEBOARD_FOLDER_MODAL_ID,
    RENAME_WHITEBOARD_FOLDER_MODAL_ID
} from '@/modules/whiteboards/hooks/use-whiteboards-listing';
import NewFolderModal from '@/shared/presentation/components/NewFolderModal';
import MoveToFolderModal from '@/shared/presentation/components/MoveToFolderModal';
import RenameFolderModal from '@/shared/presentation/components/RenameFolderModal';
import FolderBreadcrumbs from '@/shared/presentation/components/FolderBreadcrumbs';
import { openModal } from '@/shared/presentation/components/Modal';
import { dateColumn } from '@/shared/presentation/utilities/column-presets';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import Title from '@/shared/presentation/components/Title';
import { Folder, Pencil, SquarePen, Trash2 } from 'lucide-react';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import type { WhiteboardListingRow } from '@/modules/whiteboards/utilities/listing';
import { WhiteboardListingRowType } from '@/modules/whiteboards/utilities/listing';

const isWhiteboardFolder = (row: WhiteboardListingRow): boolean => {
    return row.rowType === WhiteboardListingRowType.Folder;
};

type WhiteboardColumnRender = NonNullable<ColumnConfig<WhiteboardListingRow>['render']>;

const renderWhiteboardTitle: WhiteboardColumnRender = (value, row) => {
    let title = row.title || 'Untitled Whiteboard';

    if (typeof value === 'string' && value.trim().length > 0) {
        title = value;
    }

    const shortId = row._id?.substring(0, 12) || '-';
    const icon = isWhiteboardFolder(row)
        ? <Folder size={16} />
        : <SquarePen size={16} />;
    const subtitle = isWhiteboardFolder(row) ? 'Folder' : shortId;

    return (
        <Container className='d-flex items-center gap-075'>
            <Container className='d-flex flex-center color-primary'>
                {icon}
            </Container>
            <Container className='d-flex column gap-025 overflow-hidden'>
                <span className='font-weight-6 color-primary'>{title}</span>
                <span className='font-size-1 color-muted'>{subtitle}</span>
            </Container>
        </Container>
    );
};

const COLUMNS: ColumnConfig<WhiteboardListingRow>[] = [
    {
        key: 'title',
        title: 'Title',
        sortable: true,
        render: renderWhiteboardTitle,
        skeleton: { variant: 'text', width: 180 }
    },
    dateColumn<WhiteboardListingRow>('lastEditedAt', 'Last Edited', {
        width: 90,
        withTitle: true
    }),
    dateColumn<WhiteboardListingRow>('createdAt', 'Created', {
        width: 90,
        withTitle: true
    })
];

const WhiteboardsListing = () => {
    const {
        breadcrumbs,
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
        handleMoveWhiteboardClose,
        handleMoveWhiteboardSubmit,
        handleRenameFolderClose,
        handleRenameFolderOpen,
        handleRenameFolderSubmit,
        listMoveFolders,
        movingWhiteboard,
        navigateToFolder,
        queryKey,
        renamingFolder,
        socketInvalidation
    } = useWhiteboardsListing();

    const title = (
        <Container className='d-flex column gap-05'>
            <Title className='font-size-6 font-weight-5 sm:font-size-4'>Whiteboards</Title>
            <FolderBreadcrumbs items={breadcrumbs} onNavigate={navigateToFolder} />
        </Container>
    );

    const headerActions = (
        <Container className='d-flex items-center gap-1'>
            {currentFolder && (
                <>
                    <Button
                        variant='ghost'
                        intent='neutral'
                        size='sm'
                        shape='rounded'
                        onClick={() => currentFolder && handleRenameFolderOpen(currentFolder)}
                        title='Rename current folder'
                    >
                        <Pencil size={14} />
                        Rename Folder
                    </Button>
                    <Button
                        variant='ghost'
                        intent='danger'
                        size='sm'
                        shape='rounded'
                        onClick={handleDeleteCurrentFolder ?? undefined}
                        title='Delete current folder'
                    >
                        <Trash2 size={14} />
                        Delete Folder
                    </Button>
                </>
            )}
            <Button
                variant='ghost'
                intent='neutral'
                size='sm'
                shape='rounded'
                onClick={() => openModal(NEW_WHITEBOARD_FOLDER_MODAL_ID)}
                title='Create folder'
            >
                <Folder size={14} />
                New Folder
            </Button>
        </Container>
    );

    const createNew = {
        buttonTitle: 'New Whiteboard',
        onCreate: handleCreate
    };

    return (
        <>
            <DocumentListing<WhiteboardListingRow, { folderId: string | null }>
                title={title}
                queryKey={queryKey}
                columns={COLUMNS}
                context={context}
                fetchData={fetchData}
                getMenuOptions={getMenuOptions}
                onItemClick={handleItemClick}
                dragAndDrop={dragAndDrop}
                createNew={createNew}
                headerActions={headerActions}
                emptyMessage='No whiteboards found in this location.'
                socketInvalidation={socketInvalidation}
            />
            <NewFolderModal
                id={NEW_WHITEBOARD_FOLDER_MODAL_ID}
                title='New Whiteboard Folder'
                description='Create a folder in the current whiteboards location.'
                onSubmit={handleCreateFolder}
            />
            <RenameFolderModal
                id={RENAME_WHITEBOARD_FOLDER_MODAL_ID}
                title='Rename Whiteboard Folder'
                description='Update the current whiteboard folder name.'
                folderName={renamingFolder?.title ?? null}
                onSubmit={handleRenameFolderSubmit}
                onClose={handleRenameFolderClose}
            />
            <MoveToFolderModal
                id={MOVE_WHITEBOARD_MODAL_ID}
                itemId={movingWhiteboard?._id ?? null}
                itemName={movingWhiteboard?.title ?? null}
                itemLabel='Whiteboard'
                sourceFolderId={movingWhiteboard?.folder ?? null}
                listFolders={listMoveFolders}
                getFolder={getMoveFolder}
                onSubmit={handleMoveWhiteboardSubmit}
                onClose={handleMoveWhiteboardClose}
            />
        </>
    );
};

export default WhiteboardsListing;
