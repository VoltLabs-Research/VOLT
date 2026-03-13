import RenameLatexDocumentModal from '@/modules/latex/components/molecules/RenameLatexDocumentModal';
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
import { dateColumn, userColumn } from '@/shared/presentation/utilities/column-presets';
import { openModal } from '@/shared/presentation/components/Modal';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import Title from '@/shared/presentation/components/Title';
import './LatexDocumentsListing.css';
import { FileText, Folder, Pencil, Trash2, Upload } from 'lucide-react';
import { useMemo } from 'react';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import type { MenuOption } from '@/shared/presentation/components/DocumentListing';
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

    const shortId = row._id?.substring(0, 12) || '-';
    const icon = isLatexFolder(row)
        ? <Folder size={16} />
        : <FileText size={16} />;
    const subtitle = isLatexFolder(row) ? 'Folder' : shortId;

    return (
        <Container className='d-flex items-center gap-075'>
            <Container className='d-flex flex-center color-secondary'>
                {icon}
            </Container>
            <Container className='d-flex column gap-025 overflow-hidden'>
                <span className='font-weight-6 color-secondary'>{title}</span>
                <span className='font-size-1 color-muted'>{subtitle}</span>
            </Container>
        </Container>
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
    userColumn<LatexListingRow>('createdBy', 'Created By', { isFolder: isLatexFolder }),
    dateColumn<LatexListingRow>('updatedAt', 'Updated At', {
        width: 110,
        withTitle: true
    }),
    dateColumn<LatexListingRow>('createdAt', 'Created At', {
        width: 110,
        withTitle: true
    })
];

const LatexDocumentsListing = () => {
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

    const title = <Title className='font-size-6 font-weight-5 sm:font-size-4 color-primary'>LaTeX Documents</Title>;

    const createNew = {
        buttonTitle: 'New Document',
        onCreate: handleCreate
    };

    const headerActions = (
        <Button
            variant='ghost'
            intent='neutral'
            size='sm'
            shape='rounded'
            onClick={() => openModal(NEW_LATEX_FOLDER_MODAL_ID)}
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

        options.push({
            label: 'Import',
            icon: Upload,
            onClick: openFilePicker
        });

        return options;
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
