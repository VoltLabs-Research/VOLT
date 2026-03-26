import ScriptingNotebookDeploymentModal from '@/modules/scripting/components/molecules/ScriptingNotebookDeploymentModal';
import RenameScriptingNotebookModal from '@/modules/scripting/components/molecules/RenameScriptingNotebookModal';
import useNotebooksListing from '@/modules/scripting/hooks/use-notebooks-listing';
import { ScriptingNotebookScope } from '@/modules/scripting/api/entities/scripting-notebook-scope';
import { getPrimaryTrajectory } from '@/modules/scripting/utilities/notebooks';
import { clusterColumn, dateColumn, titleWithIconColumn, userColumn } from '@/shared/presentation/utilities/column-presets';
import PopulatedCellPopover from '@/shared/presentation/components/PopulatedCellPopover';
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

const renderTrajectoryDetails: NonNullable<ColumnConfig<NotebookDocument>['render']> = (_value, row) => {
    const trajectory = getPrimaryTrajectory(row);
    const populated = (!trajectory || typeof trajectory === 'string') ? null : trajectory as unknown as Record<string, unknown>;
    return (
        <PopulatedCellPopover document={populated} modelName='Trajectory'>
            <span className='font-size-2 color-secondary notebooks-listing-trajectory'>{getTrajectoryLabel(trajectory)}</span>
        </PopulatedCellPopover>
    );
};

const TITLE_COLUMN = titleWithIconColumn<NotebookDocument>('title', 'Title', <BookOpen size={16} />, (row) => row.title || 'Untitled Notebook');

const TRAJECTORY_COLUMN: ColumnConfig<NotebookDocument> = {
    key: 'trajectory',
    title: 'Trajectory',
    sortable: false,
    render: renderTrajectoryDetails,
    skeleton: { variant: 'text', width: 150 }
};

const CLUSTER_COLUMN = clusterColumn<NotebookDocument>({ width: 150 });

const CREATED_BY_COLUMN = userColumn<NotebookDocument>('createdBy', 'Created By');

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
        return 'Open a notebook from a trajectory workspace to keep it tied to a run.';
    }

    return 'Create a general notebook to start drafting scripts and experiments.';
};

const getEmptyTitle = (scope: ScriptingNotebookScope): string => {
    if (scope === ScriptingNotebookScope.Trajectory) {
        return 'No trajectory notebooks yet';
    }

    return 'No notebooks yet';
};

const getEmptyButtonText = (scope: ScriptingNotebookScope): string => {
    if (scope === ScriptingNotebookScope.Trajectory) {
        return 'View general notebooks';
    }

    return 'Create notebook';
};

const NotebooksListing = () => {
    const [activeTab, setActiveTab] = useState<NotebooksListingTabId>(NotebooksListingTabId.List);
    const {
        exportNotebooks,
        fetchData,
        getMenuOptions,
        handleCreate,
        handleDeploymentModalClose,
        handleRenameClose,
        handleRenameSubmit,
        deploymentModalRequest,
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

    const handleEmptyStateAction = useCallback(() => {
        if (scope === ScriptingNotebookScope.Trajectory) {
            setActiveTab(NotebooksListingTabId.List);
            return;
        }

        handleCreate();
    }, [handleCreate, scope]);

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
                emptyTitle={getEmptyTitle(scope)}
                emptyMessage={getEmptyMessage(scope)}
                emptyButtonText={getEmptyButtonText(scope)}
                onEmptyButtonClick={handleEmptyStateAction}
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
            <ScriptingNotebookDeploymentModal
                request={deploymentModalRequest}
                onClose={handleDeploymentModalClose}
            />
        </>
    );
};

export default NotebooksListing;
