import RenameWhiteboardModal from '@/modules/whiteboards/components/RenameWhiteboardModal';
import Heading from '@/shared/presentation/primitives/Heading';
import useWhiteboardsListing, {
    MOVE_WHITEBOARD_MODAL_ID,
    NEW_WHITEBOARD_FOLDER_MODAL_ID,
    RENAME_WHITEBOARD_FOLDER_MODAL_ID
} from '@/modules/whiteboards/hooks/use-whiteboards-listing';
import { NewFolderHeaderAction, getFolderHeaderMenuOptions } from '@/shared/presentation/components/FolderedListingHeaderControls';
import {
    FolderedDocumentListing,
    FolderedListingModals,
    createFolderedListingColumns,
    useFolderedListingDashboardBreadcrumb
} from '@/shared/presentation/components/DocumentListing/foldered-listing';
import useTip from '@/shared/tips/use-tip';
import './WhiteboardsListing.css';
import { SquarePen } from 'lucide-react';
import type { MenuOption } from '@/shared/presentation/components/DocumentListing';
import type { WhiteboardListingRow } from '@/modules/whiteboards/utilities/listing';
import { WhiteboardListingRowType } from '@/modules/whiteboards/utilities/listing';
import { useMemo } from 'react';
import { getSafeFolderTitle, getSafeWhiteboardTitle } from '@/modules/whiteboards/utilities/whiteboards';

const EMPTY_WHITEBOARDS_ICON = <SquarePen size={28} strokeWidth={1.6} />;

const isWhiteboardFolder = (row: WhiteboardListingRow): boolean => {
    return row.rowType === WhiteboardListingRowType.Folder;
};

const COLUMNS = createFolderedListingColumns<WhiteboardListingRow>({
    isFolder: isWhiteboardFolder,
    resolveTitle: (row) => isWhiteboardFolder(row)
        ? getSafeFolderTitle(row.title)
        : getSafeWhiteboardTitle(row.title),
    skeletonWidth: 180,
    wrapperClassName: 'whiteboards-listing-title-cell',
    titleClassName: 'whiteboards-listing-title font-weight-6 color-secondary',
    getAriaLabel: (row) => row.hierarchyTitle,
    showTitleAttribute: true
});

const WhiteboardsListing = () => {
    useTip('whiteboards-organization');

    const listing = useWhiteboardsListing();
    const {
        breadcrumbs,
        currentFolder,
        getMoveFolder,
        handleCreateFolder,
        handleDeleteCurrentFolder,
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
        renamingWhiteboard,
        renamingFolder
    } = listing;

    useFolderedListingDashboardBreadcrumb(breadcrumbs, navigateToFolder);

    const title = <Heading level={3} size='3xl' className='sm:font-size-4'>Whiteboards</Heading>;

    const headerActions = <NewFolderHeaderAction modalId={NEW_WHITEBOARD_FOLDER_MODAL_ID} />;

    const headerMenuOptions = useMemo<MenuOption[]>(() => {
        return getFolderHeaderMenuOptions({
            currentFolder,
            onRenameFolderOpen: handleRenameFolderOpen,
            onDeleteCurrentFolder: handleDeleteCurrentFolder
        });
    }, [currentFolder, handleDeleteCurrentFolder, handleRenameFolderOpen]);

    return (
        <>
            <FolderedDocumentListing<WhiteboardListingRow, { folderId: string | null }>
                title={title}
                columns={COLUMNS}
                listing={listing}
                createButtonTitle='New Whiteboard'
                headerActions={headerActions}
                headerMenuOptions={headerMenuOptions}
                emptyTitle={currentFolder ? `No items in ${getSafeFolderTitle(currentFolder.title)}` : 'No whiteboards yet'}
                emptyMessage={currentFolder
                    ? 'Create a whiteboard or folder here to organize sketches, notes, and live collaboration.'
                    : 'Create your first whiteboard to start sketching ideas, collecting notes, and collaborating live with your team.'}
                emptyIcon={EMPTY_WHITEBOARDS_ICON}
                emptyButtonText='New Whiteboard'
                onEmptyButtonClick={listing.handleCreate}
            />
            <RenameWhiteboardModal
                whiteboard={renamingWhiteboard}
                onSubmit={handleRenameWhiteboardSubmit}
                onClose={handleRenameWhiteboardClose}
            />
            <FolderedListingModals
                newFolderModalId={NEW_WHITEBOARD_FOLDER_MODAL_ID}
                newFolderTitle='New Whiteboard Folder'
                newFolderDescription='Create a folder in the current whiteboards location.'
                onCreateFolder={handleCreateFolder}
                renameFolderModalId={RENAME_WHITEBOARD_FOLDER_MODAL_ID}
                renameFolderTitle='Rename Whiteboard Folder'
                renameFolderDescription='Update the current whiteboard folder name.'
                renamingFolder={renamingFolder}
                onRenameFolderSubmit={handleRenameFolderSubmit}
                onRenameFolderClose={handleRenameFolderClose}
                moveModalId={MOVE_WHITEBOARD_MODAL_ID}
                movingItem={movingWhiteboard}
                itemLabel='Whiteboard'
                listFolders={listMoveFolders}
                getFolder={getMoveFolder}
                onMoveSubmit={handleMoveWhiteboardSubmit}
                onMoveClose={handleMoveWhiteboardClose}
            />
        </>
    );
};

export default WhiteboardsListing;
