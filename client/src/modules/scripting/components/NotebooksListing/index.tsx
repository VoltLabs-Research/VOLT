import ScriptingNotebookDeploymentModal from '@/modules/scripting/components/ScriptingNotebookDeploymentModal';
import useNotebooksListing, { RENAME_SCRIPTING_NOTEBOOK_MODAL_ID } from '@/modules/scripting/hooks/use-notebooks-listing';
import { ScriptingNotebookScope } from '@/modules/scripting/api/entities/scripting-notebook-scope';
import { getPrimaryTrajectory } from '@/modules/scripting/utilities/notebooks';
import { clusterColumn, dateColumn, userColumn } from '@/shared/presentation/utilities/column-presets';
import PopulatedCellPopover from '@/shared/presentation/components/PopulatedCellPopover';
import RenameEntityModal from '@/shared/presentation/components/RenameEntityModal';
import DocumentListing, { type DocumentListingTab } from '@/shared/presentation/components/DocumentListing';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';
import { Text } from '@voltstack/bravais';
import { useCallback, useMemo, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import type { NotebooksListingContext } from '@/modules/scripting/hooks/use-notebooks-listing';
import type {
    ScriptingNotebook,
    ScriptingNotebookTrajectory
} from '@/modules/scripting/api/entities/scripting-notebook';

enum NotebooksListingTabId {
    List = 'list',
    Trajectory = 'trajectory'
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
    }
];

const isNotebooksListingTabId = (value: string): value is NotebooksListingTabId => {
    return value === NotebooksListingTabId.List
        || value === NotebooksListingTabId.Trajectory;
};

const getTrajectoryLabel = (trajectory: ScriptingNotebookTrajectory | string | null): string => {
    if (!trajectory) {
        return '';
    }

    if (typeof trajectory === 'string') {
        return '';
    }

    return trajectory.name?.trim() || '';
};

const renderTrajectoryDetails: NonNullable<ColumnConfig<NotebookDocument>['render']> = (_value, row) => {
    const trajectory = getPrimaryTrajectory(row);
    const populated = (!trajectory || typeof trajectory === 'string') ? null : trajectory as unknown as Record<string, unknown>;
    return (
        <PopulatedCellPopover document={populated} modelName='Trajectory'>
            <span className='font-size-2 color-secondary font-mono'>{getTrajectoryLabel(trajectory)}</span>
        </PopulatedCellPopover>
    );
};

const TITLE_COLUMN: ColumnConfig<NotebookDocument> = {
    key: 'title',
    title: 'Title',
    sortable: true,
    render: (_value, row) => <span className='font-weight-6 color-secondary text-truncate'>{row.title || 'Untitled Notebook'}</span>,
    skeleton: { variant: 'text', width: 180 }
};

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

const LIST_NOTEBOOK_COLUMNS: ColumnConfig<NotebookDocument>[] = [
    TITLE_COLUMN,
    CLUSTER_COLUMN,
    CREATED_BY_COLUMN,
    LAST_OPENED_AT_COLUMN
];

const TRAJECTORY_NOTEBOOK_COLUMNS: ColumnConfig<NotebookDocument>[] = [
    TITLE_COLUMN,
    TRAJECTORY_COLUMN,
    CLUSTER_COLUMN,
    CREATED_BY_COLUMN,
    LAST_OPENED_AT_COLUMN
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

const getNotebookTitle = (notebook: ScriptingNotebook): string => notebook.title || '';

const isNotebookRenameUnchanged = (title: string, notebook: ScriptingNotebook | null): boolean => {
    return title.length > 0 && title === (notebook?.title.trim() || '');
};

const validateNotebookRenameTitle = (title: string): string | undefined => {
    return title.length > 120 ? 'Title must be 120 characters or less' : undefined;
};

const NOTEBOOK_RENAME_INPUT_PROPS: InputHTMLAttributes<HTMLInputElement> = {
    autoComplete: 'off',
    enterKeyHint: 'done',
    maxLength: 120,
    spellCheck: false
};

const NotebooksListing = () => {
    const [activeTab, setActiveTab] = useState<NotebooksListingTabId>(NotebooksListingTabId.List);
    const {
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
        if (isNotebooksListingTabId(tabId)) {
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
                onTabChange={handleTabChange}
                socketInvalidation={socketInvalidation}
            />
            <RenameEntityModal
                entity={renamingNotebook}
                modalId={RENAME_SCRIPTING_NOTEBOOK_MODAL_ID}
                title='Rename Notebook'
                description='Choose a clear notebook name so it is easier to find later.'
                fieldLabel='Notebook title'
                placeholder='Enter notebook title'
                getInitialTitle={getNotebookTitle}
                validateTitle={validateNotebookRenameTitle}
                isSubmitDisabled={isNotebookRenameUnchanged}
                inputProps={NOTEBOOK_RENAME_INPUT_PROPS}
                leadingContent={renamingNotebook && (
                    <Text as='p' size='sm' tone='secondary' truncate>
                        Current name: {renamingNotebook.title || 'Untitled notebook'}
                    </Text>
                )}
                helperText={<Text as='p' size='sm' tone='muted'>Use up to 120 characters.</Text>}
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
