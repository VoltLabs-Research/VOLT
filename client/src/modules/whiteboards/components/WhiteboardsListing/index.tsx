import { Heading } from '@voltstack/bravais';
import useWhiteboardsListing, {
    RENAME_WHITEBOARD_MODAL_ID,
    whiteboardsListingResource
} from '@/modules/whiteboards/hooks/use-whiteboards-listing';
import RenameEntityModal from '@/shared/presentation/components/RenameEntityModal';
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
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { Whiteboard } from '@/modules/whiteboards/api/entities/whiteboard';
import type { WhiteboardListingRow } from '@/modules/whiteboards/utilities/listing';
import { WhiteboardListingRowType } from '@/modules/whiteboards/utilities/listing';
import { useMemo } from 'react';

const EMPTY_WHITEBOARDS_ICON = <SquarePen size={28} strokeWidth={1.6} />;

const isWhiteboardFolder = (row: WhiteboardListingRow): boolean => {
    return row.rowType === WhiteboardListingRowType.Folder;
};

const COLUMNS = createFolderedListingColumns<WhiteboardListingRow>({
    isFolder: isWhiteboardFolder,
    resolveTitle: (row) => row.title,
    skeletonWidth: 180,
    wrapperClassName: 'whiteboards-listing-title-cell',
    titleClassName: 'whiteboards-listing-title font-weight-6 color-secondary',
    getAriaLabel: (row) => row.hierarchyTitle,
    showTitleAttribute: true
});

const getInitialWhiteboardTitle = (whiteboard: Whiteboard): string => {
    return whiteboard.title;
};

const validateWhiteboardTitle = (title: string): string | undefined => {
    return title.length > 120 ? 'Title must be 120 characters or less' : undefined;
};

const WhiteboardsListing = () => {
    useTip('whiteboards-organization');

    const listing = useWhiteboardsListing();
    const {
        breadcrumbs,
        currentFolder,
        handleDeleteCurrentFolder,
        handleRenameWhiteboardClose,
        handleRenameWhiteboardSubmit,
        handleRenameFolderOpen,
        navigateToFolder,
        renamingWhiteboard
    } = listing;

    useFolderedListingDashboardBreadcrumb(breadcrumbs, navigateToFolder);

    const title = <Heading level={3} size='3xl' className='sm:font-size-4'>Whiteboards</Heading>;

    const headerActions = <NewFolderHeaderAction modalId={whiteboardsListingResource.modalIds.newFolder} />;

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
                emptyTitle={currentFolder ? `No items in ${currentFolder.title}` : 'No whiteboards yet'}
                emptyMessage={currentFolder
                    ? 'Create a whiteboard or folder here to organize sketches, notes, and live collaboration.'
                    : 'Create your first whiteboard to start sketching ideas, collecting notes, and collaborating live with your team.'}
                emptyIcon={EMPTY_WHITEBOARDS_ICON}
                emptyButtonText='New Whiteboard'
                onEmptyButtonClick={listing.handleCreate}
            />
            <RenameEntityModal
                entity={renamingWhiteboard}
                modalId={RENAME_WHITEBOARD_MODAL_ID}
                title='Rename Whiteboard'
                description='Enter a new name for this whiteboard.'
                fieldLabel='Whiteboard title'
                placeholder='Enter whiteboard title'
                getInitialTitle={getInitialWhiteboardTitle}
                validateTitle={validateWhiteboardTitle}
                onSubmit={handleRenameWhiteboardSubmit}
                onClose={handleRenameWhiteboardClose}
            />
            <FolderedListingModals resource={whiteboardsListingResource} listing={listing} />
        </>
    );
};

export default WhiteboardsListing;
