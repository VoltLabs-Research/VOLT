import useImportLatexDocument from '@/modules/latex/hooks/use-import-latex-document';
import useLatexDocumentsListing, {
    MOVE_LATEX_DOCUMENT_MODAL_ID,
    NEW_LATEX_FOLDER_MODAL_ID,
    RENAME_LATEX_DOCUMENT_MODAL_ID,
    RENAME_LATEX_FOLDER_MODAL_ID
} from '@/modules/latex/hooks/use-latex-documents-listing';
import RenameEntityModal from '@/shared/presentation/components/RenameEntityModal';
import { NewFolderHeaderAction, getFolderHeaderMenuOptions } from '@/shared/presentation/components/FolderedListingHeaderControls';
import { Heading } from '@voltstack/bravais';
import {
    FolderedDocumentListing,
    FolderedListingModals,
    createFolderedListingColumns,
    useFolderedListingDashboardBreadcrumb
} from '@/shared/presentation/components/DocumentListing/foldered-listing';
import useTip from '@/shared/tips/use-tip';
import { Upload } from 'lucide-react';
import { useMemo } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { LatexDocument } from '@/modules/latex/api/entities/latex-document';
import type { LatexListingRow } from '@/modules/latex/utilities/listing';
import { LatexListingRowType } from '@/modules/latex/utilities/listing';

const isLatexFolder = (row: LatexListingRow): boolean => {
    return row.rowType === LatexListingRowType.Folder;
};

const COLUMNS = createFolderedListingColumns<LatexListingRow>({
    isFolder: isLatexFolder,
    resolveTitle: (row) => row.title || 'Untitled Document',
    skeletonWidth: 200
});

const getLatexDocumentTitle = (document: LatexDocument): string => document.title;

const LatexDocumentsListing = () => {
    useTip('latex-documents-organization');

    const listing = useLatexDocumentsListing();
    const {
        breadcrumbs,
        context,
        currentFolder,
        getMoveFolder,
        handleCreateFolder,
        handleDeleteCurrentFolder,
        handleMoveDocumentClose,
        handleMoveDocumentSubmit,
        handleRenameClose,
        handleRenameFolderClose,
        handleRenameFolderOpen,
        handleRenameFolderSubmit,
        handleRenameSubmit,
        listMoveFolders,
        movingDocument,
        navigateToFolder,
        renamingDocument,
        renamingFolder
    } = listing;

    const { openFilePicker } = useImportLatexDocument(context.folderId);
    useFolderedListingDashboardBreadcrumb(breadcrumbs, navigateToFolder);

    const title = <Heading level={3} size='3xl' weight='medium' className='sm:font-size-4'>LaTeX Documents</Heading>;

    const headerActions = <NewFolderHeaderAction modalId={NEW_LATEX_FOLDER_MODAL_ID} />;

    const headerMenuOptions = useMemo<MenuOption[]>(() => {
        return getFolderHeaderMenuOptions({
            currentFolder,
            onRenameFolderOpen: handleRenameFolderOpen,
            onDeleteCurrentFolder: handleDeleteCurrentFolder,
            extraOptions: [{
                label: 'Import',
                icon: Upload,
                onClick: openFilePicker
            }]
        });
    }, [currentFolder, handleDeleteCurrentFolder, handleRenameFolderOpen, openFilePicker]);

    return (
        <>
            <FolderedDocumentListing<LatexListingRow, { folderId: string | null }>
                title={title}
                columns={COLUMNS}
                listing={listing}
                createButtonTitle='New Document'
                headerActions={headerActions}
                headerMenuOptions={headerMenuOptions}
                emptyMessage='No LaTeX documents found in this location.'
            />
            <RenameEntityModal
                entity={renamingDocument}
                modalId={RENAME_LATEX_DOCUMENT_MODAL_ID}
                title='Rename Document'
                description='Enter a new name for this LaTeX document.'
                fieldLabel='Document title'
                placeholder='Enter document title'
                getInitialTitle={getLatexDocumentTitle}
                onSubmit={handleRenameSubmit}
                onClose={handleRenameClose}
            />
            <FolderedListingModals
                newFolderModalId={NEW_LATEX_FOLDER_MODAL_ID}
                newFolderTitle='New LaTeX Folder'
                newFolderDescription='Create a folder in the current LaTeX documents location.'
                onCreateFolder={handleCreateFolder}
                renameFolderModalId={RENAME_LATEX_FOLDER_MODAL_ID}
                renameFolderTitle='Rename LaTeX Folder'
                renameFolderDescription='Update the current LaTeX folder name.'
                renamingFolder={renamingFolder}
                onRenameFolderSubmit={handleRenameFolderSubmit}
                onRenameFolderClose={handleRenameFolderClose}
                moveModalId={MOVE_LATEX_DOCUMENT_MODAL_ID}
                movingItem={movingDocument}
                itemLabel='Document'
                listFolders={listMoveFolders}
                getFolder={getMoveFolder}
                onMoveSubmit={handleMoveDocumentSubmit}
                onMoveClose={handleMoveDocumentClose}
            />
        </>
    );
};

export default LatexDocumentsListing;
