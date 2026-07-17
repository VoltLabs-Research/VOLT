import useImportLatexDocument from '@/modules/latex/hooks/use-import-latex-document';
import useLatexDocumentsListing, {
    RENAME_LATEX_DOCUMENT_MODAL_ID,
    latexListingResource
} from '@/modules/latex/hooks/use-latex-documents-listing';
import RenameEntityModal from '@/shared/ui/components/RenameEntityModal';
import { NewFolderHeaderAction, getFolderHeaderMenuOptions } from '@/shared/ui/components/FolderedListingHeaderControls';
import { Heading } from '@voltstack/bravais';
import {
    FolderedDocumentListing,
    FolderedListingModals,
    createFolderedListingColumns,
    useFolderedListingDashboardBreadcrumb
} from '@/shared/ui/components/DocumentListing/foldered-listing';
import useTip from '@/shared/tips/use-tip';
import { Upload } from 'lucide-react';
import { useMemo } from 'react';
import type { MenuOption } from '@/shared/ui/types/menu';
import type { LatexDocument } from '@/modules/latex/api/types/latex-document';
import type { LatexListingRow } from '@/modules/latex/utilities/listing';
import { isLatexFolderRow } from '@/modules/latex/utilities/listing';

const COLUMNS = createFolderedListingColumns<LatexListingRow>({
    isFolder: isLatexFolderRow,
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
        handleDeleteCurrentFolder,
        handleRenameClose,
        handleRenameFolderOpen,
        handleRenameSubmit,
        navigateToFolder,
        renamingDocument
    } = listing;

    const { openFilePicker } = useImportLatexDocument(context.folderId);
    useFolderedListingDashboardBreadcrumb(breadcrumbs, navigateToFolder);

    const title = <Heading level={3} size='3xl' weight='medium' className='sm:font-size-4'>LaTeX Documents</Heading>;

    const headerActions = <NewFolderHeaderAction modalId={latexListingResource.modalIds.newFolder} />;

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
            <FolderedListingModals resource={latexListingResource} listing={listing} />
        </>
    );
};

export default LatexDocumentsListing;
