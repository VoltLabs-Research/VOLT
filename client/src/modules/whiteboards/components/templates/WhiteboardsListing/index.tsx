import useWhiteboardsListing from '@/modules/whiteboards/hooks/use-whiteboards-listing';
import { dateColumn } from '@/shared/presentation/utilities/column-presets';
import Container from '@/shared/presentation/components/Container';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import { SquarePen } from 'lucide-react';
import type { Whiteboard } from '@/modules/whiteboards/api/entities/whiteboard';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';

type WhiteboardDocument = Whiteboard;
type WhiteboardColumnRender = NonNullable<ColumnConfig['render']>;

const isWhiteboardDocument = (value: unknown): value is WhiteboardDocument => {
    return typeof value === 'object'
        && value !== null
        && '_id' in value
        && 'title' in value
        && 'createdAt' in value;
};

const renderWhiteboardTitle: WhiteboardColumnRender = (value, row) => {
    const whiteboard = isWhiteboardDocument(row) ? row : undefined;
    let title = whiteboard?.title || 'Untitled Whiteboard';

    if (typeof value === 'string' && value.trim().length > 0) {
        title = value;
    }

    const shortId = whiteboard?._id?.substring(0, 12) || '-';

    return (
        <Container className='d-flex items-center gap-075'>
            <Container className='d-flex flex-center color-primary'>
                <SquarePen size={16} />
            </Container>
            <Container className='d-flex column gap-025 overflow-hidden'>
                <span className='font-weight-6 color-primary'>{title}</span>
                <span className='font-size-1 color-muted'>{shortId}</span>
            </Container>
        </Container>
    );
};

const COLUMNS: ColumnConfig<WhiteboardDocument>[] = [
    {
        key: 'title',
        title: 'Title',
        sortable: true,
        render: renderWhiteboardTitle,
        skeleton: { variant: 'text', width: 180 }
    },
    dateColumn<WhiteboardDocument>('lastEditedAt', 'Last Edited', {
        width: 90,
        withTitle: true
    }),
    dateColumn<WhiteboardDocument>('createdAt', 'Created', {
        width: 90,
        withTitle: true
    })
];

const WhiteboardsListing = () => {
    const { fetchData, getMenuOptions, handleCreate, queryKey, socketInvalidation } = useWhiteboardsListing();

    return (
        <DocumentListing<WhiteboardDocument>
            title='Whiteboards'
            queryKey={queryKey}
            columns={COLUMNS}
            fetchData={fetchData}
            getMenuOptions={getMenuOptions}
            createNew={{ buttonTitle: 'New Whiteboard', onCreate: handleCreate }}
            emptyMessage='No whiteboards found for this team.'
            socketInvalidation={socketInvalidation}
        />
    );
};

export default WhiteboardsListing;
