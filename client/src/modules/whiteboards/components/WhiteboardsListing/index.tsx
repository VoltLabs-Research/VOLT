import RenameWhiteboardModal from '@/modules/whiteboards/components/RenameWhiteboardModal';
import useDashboardHeaderContent from '@/modules/dashboard/hooks/use-dashboard-header-content';
import useWhiteboardsListing, {
    MOVE_WHITEBOARD_MODAL_ID,
    NEW_WHITEBOARD_FOLDER_MODAL_ID,
    RENAME_WHITEBOARD_FOLDER_MODAL_ID
} from '@/modules/whiteboards/hooks/use-whiteboards-listing';
import NewFolderModal from '@/shared/presentation/components/NewFolderModal';
import MoveToFolderModal from '@/shared/presentation/components/MoveToFolderModal';
import RenameFolderModal from '@/shared/presentation/components/RenameFolderModal';
import { openModal } from '@/shared/presentation/components/Modal';
import { dateColumn, userColumn } from '@/shared/presentation/utilities/column-presets';
import Button from '@/shared/presentation/components/Button';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import useTip from '@/shared/tips/use-tip';
import './WhiteboardsListing.css';
import { Folder, Pencil, SquarePen, Trash2 } from 'lucide-react';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import type { MenuOption } from '@/shared/presentation/components/DocumentListing';
import type { WhiteboardListingRow } from '@/modules/whiteboards/utilities/listing';
import { WhiteboardListingRowType } from '@/modules/whiteboards/utilities/listing';
import { useMemo } from 'react';
import { getSafeFolderTitle, getSafeWhiteboardTitle } from '@/modules/whiteboards/utilities/whiteboards';

const EMPTY_WHITEBOARDS_ICON = <SquarePen size={28} strokeWidth={1.6} />;

const isWhiteboardFolder = (row: WhiteboardListingRow): boolean => {
    return row.rowType === WhiteboardListingRowType.Folder;
};

const renderWhiteboardTitle: NonNullable<ColumnConfig<WhiteboardListingRow>['render']> = (value, row) => {
    let title = isWhiteboardFolder(row)
        ? getSafeFolderTitle(row.title)
        : getSafeWhiteboardTitle(row.title);

    if (typeof value === 'string' && value.trim().length > 0) {
        title = value;
    }

    const hierarchyLabel = row.hierarchyTitle;

    return (
        <div className='volt-container whiteboards-listing-title-cell d-flex items-center gap-075' aria-label={hierarchyLabel}>
            {isWhiteboardFolder(row) && (
                <div className='volt-container d-flex flex-center color-secondary'>
                    <Folder size={16} />
                </div>
            )}
            <div className='volt-container overflow-hidden'>
                <span className='whiteboards-listing-title font-weight-6 color-secondary' title={title}>{title}</span>
            </div>
        </div>
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
    userColumn<WhiteboardListingRow>('lastEditedBy', 'Last Edited By', { isFolder: isWhiteboardFolder }),
    dateColumn<WhiteboardListingRow>('updatedAt', 'Updated At', {
        width: 110,
        withTitle: true
    })
];

const WhiteboardsListing = () => {
    useTip('whiteboards-organization');

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
        handleRenameWhiteboardClose,
        handleRenameWhiteboardSubmit,
        handleRenameFolderClose,
        handleRenameFolderOpen,
        handleRenameFolderSubmit,
        listMoveFolders,
        movingWhiteboard,
        navigateToFolder,
        queryKey,
        renamingWhiteboard,
        renamingFolder,
        socketInvalidation
    } = useWhiteboardsListing();

    const globalSearchBreadcrumb = useMemo(() => ({
        items: breadcrumbs,
        onNavigate: navigateToFolder
    }), [breadcrumbs, navigateToFolder]);

    useDashboardHeaderContent({
        globalSearchBreadcrumb
    });

    const title = <h3 className='volt-title font-size-6 font-weight-5 sm:font-size-4 color-primary'>Whiteboards</h3>;

    const createNew = {
        buttonTitle: 'New Whiteboard',
        onCreate: handleCreate
    };

    const headerActions = (
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
    );

    const headerMenuOptions = useMemo<MenuOption[]>(() => {
        const options: MenuOption[] = [];

        if (currentFolder) {
            options.push(
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
            );
        }

        return options;
    }, [currentFolder, handleDeleteCurrentFolder, handleRenameFolderOpen]);

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
                headerMenuOptions={headerMenuOptions}
                emptyTitle={currentFolder ? `No items in ${getSafeFolderTitle(currentFolder.title)}` : 'No whiteboards yet'}
                emptyMessage={currentFolder
                    ? 'Create a whiteboard or folder here to organize sketches, notes, and live collaboration.'
                    : 'Create your first whiteboard to start sketching ideas, collecting notes, and collaborating live with your team.'}
                emptyIcon={EMPTY_WHITEBOARDS_ICON}
                emptyButtonText='New Whiteboard'
                onEmptyButtonClick={handleCreate}
                socketInvalidation={socketInvalidation}
            />
            <NewFolderModal
                id={NEW_WHITEBOARD_FOLDER_MODAL_ID}
                title='New Whiteboard Folder'
                description='Create a folder in the current whiteboards location.'
                onSubmit={handleCreateFolder}
            />
            <RenameWhiteboardModal
                whiteboard={renamingWhiteboard}
                onSubmit={handleRenameWhiteboardSubmit}
                onClose={handleRenameWhiteboardClose}
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
