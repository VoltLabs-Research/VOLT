import RenameLatexDocumentModal from '@/modules/latex/components/RenameLatexDocumentModal';
import useImportLatexDocument from '@/modules/latex/hooks/use-import-latex-document';
import useDashboardHeaderContent from '@/modules/dashboard/hooks/use-dashboard-header-content';
import useLatexDocumentsListing, {
    MOVE_LATEX_DOCUMENT_MODAL_ID,
    NEW_LATEX_FOLDER_MODAL_ID,
    RENAME_LATEX_FOLDER_MODAL_ID
} from '@/modules/latex/hooks/use-latex-documents-listing';
import NewFolderModal from '@/shared/presentation/components/NewFolderModal';
import MoveToFolderModal from '@/shared/presentation/components/MoveToFolderModal';
import RenameFolderModal from '@/shared/presentation/components/RenameFolderModal';
import { NewFolderHeaderAction, getFolderHeaderMenuOptions } from '@/shared/presentation/components/FolderedListingHeaderControls';
import { dateColumn, userColumn } from '@/shared/presentation/utilities/column-presets';
import Box from '@/shared/presentation/primitives/Box';
import Heading from '@/shared/presentation/primitives/Heading';
import Row from '@/shared/presentation/primitives/Row';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import useTip from '@/shared/tips/use-tip';
import { Folder, Upload } from 'lucide-react';
import { useMemo } from 'react';
import type { ColumnConfig, MenuOption } from '@/shared/presentation/components/DocumentListing';
import type { LatexListingRow } from '@/modules/latex/utilities/listing';
import { LatexListingRowType } from '@/modules/latex/utilities/listing';

const isLatexFolder = (row: LatexListingRow): boolean => {
    return row.rowType === LatexListingRowType.Folder;
};

const renderDocumentTitle: NonNullable<ColumnConfig<LatexListingRow>['render']> = (value, row) => {
    let title = row.title || 'Untitled Document';

    if (typeof value === 'string' && value.trim().length > 0) {
        title = value;
    }

    return (
        <Row gap='075'>
            {isLatexFolder(row) && (
                <Box display='flex' className='flex-center color-secondary'>
                    <Folder size={16} />
                </Box>
            )}
            <Box overflow='hidden'>
                <span className='font-weight-6 color-secondary'>{title}</span>
            </Box>
        </Row>
    );
};

const COLUMNS: ColumnConfig<LatexListingRow>[] = [
    {
        key: 'title',
        title: 'Title',
        sortable: true,
        render: renderDocumentTitle,
        skeleton: { variant: 'text', width: 200 }
    },
    userColumn<LatexListingRow>('lastEditedBy', 'Last Edited By', { isFolder: isLatexFolder }),
    dateColumn<LatexListingRow>('updatedAt', 'Updated At', {
        width: 110,
        withTitle: true
    })
];

const LatexDocumentsListing = () => {
    useTip('latex-documents-organization');

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
        queryKey,
        renamingDocument,
        renamingFolder,
        socketInvalidation
    } = useLatexDocumentsListing();

    const { openFilePicker } = useImportLatexDocument(context.folderId);
    const globalSearchBreadcrumb = useMemo(() => ({
        items: breadcrumbs,
        onNavigate: navigateToFolder
    }), [breadcrumbs, navigateToFolder]);

    useDashboardHeaderContent({
        globalSearchBreadcrumb
    });

    const title = <Heading level={3} size='3xl' weight='medium' className='sm:font-size-4'>LaTeX Documents</Heading>;

    const createNew = {
        buttonTitle: 'New Document',
        onCreate: handleCreate
    };

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
            <DocumentListing<LatexListingRow, { folderId: string | null }>
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
                emptyMessage='No LaTeX documents found in this location.'
                socketInvalidation={socketInvalidation}
            />
            <RenameLatexDocumentModal
                document={renamingDocument}
                onSubmit={handleRenameSubmit}
                onClose={handleRenameClose}
            />
            <NewFolderModal
                id={NEW_LATEX_FOLDER_MODAL_ID}
                title='New LaTeX Folder'
                description='Create a folder in the current LaTeX documents location.'
                onSubmit={handleCreateFolder}
            />
            <RenameFolderModal
                id={RENAME_LATEX_FOLDER_MODAL_ID}
                title='Rename LaTeX Folder'
                description='Update the current LaTeX folder name.'
                folderName={renamingFolder?.title ?? null}
                onSubmit={handleRenameFolderSubmit}
                onClose={handleRenameFolderClose}
            />
            <MoveToFolderModal
                id={MOVE_LATEX_DOCUMENT_MODAL_ID}
                itemId={movingDocument?._id ?? null}
                itemName={movingDocument?.title ?? null}
                itemLabel='Document'
                sourceFolderId={movingDocument?.folder ?? null}
                listFolders={listMoveFolders}
                getFolder={getMoveFolder}
                onSubmit={handleMoveDocumentSubmit}
                onClose={handleMoveDocumentClose}
            />
        </>
    );
};

export default LatexDocumentsListing;
