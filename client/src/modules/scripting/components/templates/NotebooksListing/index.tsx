import useNotebooksListing from '@/modules/scripting/hooks/use-notebooks-listing';
import { dateColumn } from '@/shared/presentation/utilities/column-presets';
import Container from '@/shared/presentation/components/Container';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import './NotebooksListing.css';
import { BookOpen } from 'lucide-react';
import { getTrajectoryIds } from '@/modules/scripting/utilities/notebooks';
import type { ScriptingNotebook } from '@/modules/scripting/api/entities/scripting-notebook';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';

type NotebookDocument = ScriptingNotebook;
type NotebookColumnRender = NonNullable<ColumnConfig['render']>;

const isNotebookDocument = (value: unknown): value is NotebookDocument => {
    return typeof value === 'object'
        && value !== null
        && '_id' in value
        && 'title' in value
        && 'trajectories' in value
        && 'createdAt' in value;
};

const renderNotebookTitle: NotebookColumnRender = (value, row) => {
    const notebook = isNotebookDocument(row) ? row : undefined;
    let title = notebook?.title || 'Untitled Notebook';

    if (typeof value === 'string' && value.trim().length > 0) {
        title = value;
    }

    const shortId = notebook?._id?.substring(0, 12) || '-';

    return (
        <Container className='d-flex items-center gap-075'>
            <Container className='d-flex flex-center color-primary'>
                <BookOpen size={16} />
            </Container>
            <Container className='d-flex column gap-025 overflow-hidden'>
                <span className='font-weight-6 color-primary'>{title}</span>
                <span className='font-size-1 color-muted'>{shortId}</span>
            </Container>
        </Container>
    );
};

const renderTrajectoryIds: NotebookColumnRender = (_value, row) => {
    if (!isNotebookDocument(row)) {
        return <span className='font-size-2 color-muted'>-</span>;
    }

    const trajectoryIds = getTrajectoryIds(row);
    if (!trajectoryIds.length) {
        return <span className='font-size-2 color-muted'>-</span>;
    }

    const [primaryId, ...rest] = trajectoryIds;
    const label = rest.length ? `${primaryId} +${rest.length}` : primaryId;

    return <span className='font-size-2 color-secondary notebooks-listing-trajectory'>{label}</span>;
};

const COLUMNS: ColumnConfig<NotebookDocument>[] = [
    {
        key: 'title',
        title: 'Title',
        sortable: true,
        render: renderNotebookTitle,
        skeleton: { variant: 'text', width: 180 }
    },
    {
        key: 'trajectories',
        title: 'Trajectory ID',
        sortable: false,
        render: renderTrajectoryIds,
        skeleton: { variant: 'text', width: 150 }
    },
    dateColumn<NotebookDocument>('createdAt', 'Created', {
        width: 90,
        withTitle: true
    })
];

const NotebooksListing = () => {
    const { fetchData, getMenuOptions, queryKey, socketInvalidation } = useNotebooksListing();

    return (
        <DocumentListing<NotebookDocument>
            title='Notebooks'
            queryKey={queryKey}
            columns={COLUMNS}
            fetchData={fetchData}
            getMenuOptions={getMenuOptions}
            emptyMessage='No notebooks found for this team.'
            socketInvalidation={socketInvalidation}
        />
    );
};

export default NotebooksListing;
