import useLatexDocumentsListing from '@/modules/latex/hooks/use-latex-documents-listing';
import useImportLatexDocument from '@/modules/latex/hooks/use-import-latex-document';
import RenameLatexDocumentModal from '@/modules/latex/components/molecules/RenameLatexDocumentModal';
import { dateColumn } from '@/shared/presentation/utilities/column-presets';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import usePaginationParams from '@/shared/presentation/hooks/use-pagination-params';
import './LatexDocumentsListing.css';
import { FileText, Upload } from 'lucide-react';
import type { LatexDocument } from '@/modules/latex/api/entities/latex-document';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';

type LatexDoc = LatexDocument;
type ColumnRender = NonNullable<ColumnConfig<LatexDoc>['render']>;

const renderDocumentTitle: ColumnRender = (value, row) => {
    let title = row.title || 'Untitled Document';

    if (typeof value === 'string' && value.trim().length > 0) {
        title = value;
    }

    const shortId = row._id?.substring(0, 12) || '-';

    return (
        <Container className='d-flex items-center gap-075'>
            <Container className='d-flex flex-center color-primary'>
                <FileText size={16} />
            </Container>
            <Container className='d-flex column gap-025 overflow-hidden'>
                <span className='font-weight-6 color-primary'>{title}</span>
                <span className='font-size-1 color-muted'>{shortId}</span>
            </Container>
        </Container>
    );
};

const COLUMNS: ColumnConfig<LatexDoc>[] = [
    {
        key: 'title',
        title: 'Title',
        sortable: true,
        render: renderDocumentTitle,
        skeleton: { variant: 'text', width: 200 }
    },
    dateColumn<LatexDoc>('updatedAt', 'Last Modified', {
        width: 110,
        withTitle: true
    }),
    dateColumn<LatexDoc>('createdAt', 'Created', {
        width: 90,
        withTitle: true
    })
];

const CREATE_NEW_CONFIG = { buttonTitle: 'New Document' };

const LatexDocumentsListing = () => {
    const {
        fetchData,
        getMenuOptions,
        handleCreate,
        handleRenameClose,
        handleRenameSubmit,
        renamingDocument,
        queryKey,
        socketInvalidation
    } = useLatexDocumentsListing();

    const { openFilePicker } = useImportLatexDocument();
    const { search, setSearch } = usePaginationParams();

    const createNew = { ...CREATE_NEW_CONFIG, onCreate: handleCreate };

    const headerActions = (
        <Container className='d-flex items-center gap-1'>
            <Button
                variant='ghost'
                intent='neutral'
                size='sm'
                shape='rounded'
                onClick={openFilePicker}
                title='Import .tex or .zip document'
            >
                <Upload size={14} />
                Import
            </Button>
        </Container>
    );

    return (
        <>
            <DocumentListing<LatexDoc>
                title='LaTeX Documents'
                queryKey={queryKey}
                columns={COLUMNS}
                fetchData={fetchData}
                getMenuOptions={getMenuOptions}
                createNew={createNew}
                headerActions={headerActions}
                emptyMessage='No LaTeX documents found for this team.'
                socketInvalidation={socketInvalidation}
            />
            <RenameLatexDocumentModal
                document={renamingDocument}
                onSubmit={handleRenameSubmit}
                onClose={handleRenameClose}
            />
        </>
    );
};

export default LatexDocumentsListing;
