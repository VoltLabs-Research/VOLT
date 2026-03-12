import RenameScriptingNotebookModal from '@/modules/scripting/components/molecules/RenameScriptingNotebookModal';
import useNotebooksListing from '@/modules/scripting/hooks/use-notebooks-listing';
import { ScriptingNotebookScope } from '@/modules/scripting/api/entities/scripting-notebook-scope';
import { getPrimaryTrajectory } from '@/modules/scripting/utilities/notebooks';
import ListingUserCell from '@/shared/presentation/components/ListingUserCell';
import { dateColumn } from '@/shared/presentation/utilities/column-presets';
import Container from '@/shared/presentation/components/Container';
import DocumentListing, {
    DocumentListingTabAction,
    type ColumnConfig,
    type DocumentListingTab
} from '@/shared/presentation/components/DocumentListing';
import './NotebooksListing.css';
import { BookOpen } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { NotebooksListingContext } from '@/modules/scripting/hooks/use-notebooks-listing';
import type {
    ScriptingNotebook,
    ScriptingNotebookTrajectory
} from '@/modules/scripting/api/entities/scripting-notebook';

enum NotebooksListingTabId {
    List = 'list',
    Trajectory = 'trajectory',
    Export = 'export'
};

type NotebookDocument = ScriptingNotebook;
type NotebookColumnRender = NonNullable<ColumnConfig<NotebookDocument>['render']>;

const NOTEBOOK_TABS: DocumentListingTab[] = [
    {
        id: NotebooksListingTabId.List,
        label: 'List'
    },
    {
        id: NotebooksListingTabId.Trajectory,
        label: 'Trajectory Notebooks'
    },
    {
        id: NotebooksListingTabId.Export,
        label: 'Export',
        action: DocumentListingTabAction.Export
    }
];

const isNotebookDocument = (value: unknown): value is NotebookDocument => {
    return typeof value === 'object'
        && value !== null
        && '_id' in value
        && 'title' in value
        && 'createdAt' in value;
};

const isNotebooksListingTabId = (value: string): value is NotebooksListingTabId => {
    return value === NotebooksListingTabId.List
        || value === NotebooksListingTabId.Trajectory
        || value === NotebooksListingTabId.Export;
};

const getTrajectoryLabel = (trajectory: ScriptingNotebookTrajectory | string | null): string => {
    if (!trajectory) {
        return 'General';
    }

    if (typeof trajectory === 'string') {
        return trajectory;
    }

    return trajectory.name || trajectory._id;
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

const renderTrajectoryDetails: NotebookColumnRender = (_value, row) => {
    if (!isNotebookDocument(row)) {
        return <span className='font-size-2 color-muted'>-</span>;
    }

    const trajectory = getPrimaryTrajectory(row);
    return <span className='font-size-2 color-secondary notebooks-listing-trajectory'>{getTrajectoryLabel(trajectory)}</span>;
};

const renderCluster: NotebookColumnRender = (_value, row) => {
    const teamCluster = row.teamCluster;
    if (!teamCluster) {
        return <span className='font-size-2 color-muted'>-</span>;
    }

    if (typeof teamCluster === 'string') {
        return <span className='font-size-2 color-secondary'>{teamCluster}</span>;
    }

    return <span className='font-size-2 color-secondary'>{teamCluster.name || teamCluster._id}</span>;
};

const renderCreatedBy: NotebookColumnRender = (_value, row) => {
    const user = typeof row.createdBy === 'string'
        ? null
        : row.createdBy;
    return <ListingUserCell user={user} />;
};

const TITLE_COLUMN: ColumnConfig<NotebookDocument> = {
    key: 'title',
    title: 'Title',
    sortable: true,
    render: renderNotebookTitle,
    skeleton: { variant: 'text', width: 180 }
};

const TRAJECTORY_COLUMN: ColumnConfig<NotebookDocument> = {
    key: 'trajectory',
    title: 'Trajectory',
    sortable: false,
    render: renderTrajectoryDetails,
    skeleton: { variant: 'text', width: 150 }
};

const CLUSTER_COLUMN: ColumnConfig<NotebookDocument> = {
    key: 'teamCluster',
    title: 'Cluster',
    sortable: false,
    render: renderCluster,
    skeleton: { variant: 'text', width: 150 }
};

const CREATED_BY_COLUMN: ColumnConfig<NotebookDocument> = {
    key: 'createdBy',
    title: 'Created By',
    sortable: false,
    render: renderCreatedBy,
    skeleton: { variant: 'text', width: 180 }
};

const LAST_OPENED_AT_COLUMN = dateColumn<NotebookDocument>('lastOpenedAt', 'Last Opened At', {
    width: 110,
    withTitle: true,
    fallback: '-'
});

const CREATED_AT_COLUMN = dateColumn<NotebookDocument>('createdAt', 'Created At', {
    width: 110,
    withTitle: true
});

const LIST_NOTEBOOK_COLUMNS: ColumnConfig<NotebookDocument>[] = [
    TITLE_COLUMN,
    CLUSTER_COLUMN,
    CREATED_BY_COLUMN,
    LAST_OPENED_AT_COLUMN,
    CREATED_AT_COLUMN
];

const TRAJECTORY_NOTEBOOK_COLUMNS: ColumnConfig<NotebookDocument>[] = [
    TITLE_COLUMN,
    TRAJECTORY_COLUMN,
    CLUSTER_COLUMN,
    CREATED_BY_COLUMN,
    LAST_OPENED_AT_COLUMN,
    CREATED_AT_COLUMN
];

const resolveColumns = (tab: NotebooksListingTabId): ColumnConfig<NotebookDocument>[] => {
    if (tab === NotebooksListingTabId.List) {
        return LIST_NOTEBOOK_COLUMNS;
    }

    return TRAJECTORY_NOTEBOOK_COLUMNS;
};

const resolveScope = (tab: NotebooksListingTabId): ScriptingNotebookScope => {
    if (tab === NotebooksListingTabId.Trajectory) {
        return ScriptingNotebookScope.Trajectory;
    }

    return ScriptingNotebookScope.General;
};

const getEmptyMessage = (scope: ScriptingNotebookScope): string => {
    if (scope === ScriptingNotebookScope.Trajectory) {
        return 'No trajectory notebooks found for this team.';
    }

    return 'No general notebooks found for this team.';
};

const NotebooksListing = () => {
    const [activeTab, setActiveTab] = useState<NotebooksListingTabId>(NotebooksListingTabId.List);
    const {
        exportNotebooks,
        fetchData,
        getMenuOptions,
        handleCreate,
        handleRenameClose,
        handleRenameSubmit,
        renamingNotebook,
        queryKey,
        socketInvalidation
    } = useNotebooksListing();

    const scope = resolveScope(activeTab);
    const columns = useMemo(() => resolveColumns(activeTab), [activeTab]);
    const context = useMemo<NotebooksListingContext>(() => ({ scope }), [scope]);
    const createNew = activeTab === NotebooksListingTabId.List
        ? { buttonTitle: 'New Notebook', onCreate: handleCreate }
        : undefined;

    const handleTabChange = useCallback((tabId: string) => {
        if (isNotebooksListingTabId(tabId) && tabId !== NotebooksListingTabId.Export) {
            setActiveTab(tabId);
        }
    }, []);

    return (
        <>
            <DocumentListing<NotebookDocument, NotebooksListingContext>
                title='Notebooks'
                queryKey={queryKey}
                columns={columns}
                context={context}
                tabs={NOTEBOOK_TABS}
                defaultTabId={NotebooksListingTabId.List}
                fetchData={fetchData}
                getMenuOptions={getMenuOptions}
                createNew={createNew}
                emptyMessage={getEmptyMessage(scope)}
                exportConfig={{
                    onExport: exportNotebooks,
                    getFilename: (format) => `notebooks-${scope}.${format}`
                }}
                onTabChange={handleTabChange}
                socketInvalidation={socketInvalidation}
            />
            <RenameScriptingNotebookModal
                notebook={renamingNotebook}
                onSubmit={handleRenameSubmit}
                onClose={handleRenameClose}
            />
        </>
    );
};

export default NotebooksListing;
