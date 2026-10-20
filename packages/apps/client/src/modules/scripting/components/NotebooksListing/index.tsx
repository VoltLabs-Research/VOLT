import { RENAME_SCRIPTING_NOTEBOOK_MODAL_ID } from '@/modules/scripting/contracts/modal-ids';
import ScriptingNotebookDeploymentModal from '@/modules/scripting/components/ScriptingNotebookDeploymentModal';
import useNotebooksListing from './use-notebooks-listing';
import { ScriptingNotebookScope } from '@volt/contracts/modules/scripting/domain';
import { clusterColumn, dateColumn, userColumn } from '@/shared/ui/utils/column-presets';
import DockerNeededState from '@/shared/ui/components/DockerNeededState';
import { useContainerRuntimeAvailability } from '@/modules/cluster/hooks/use-container-runtime-availability';
import PopulatedCellPopover from '@/shared/ui/components/PopulatedCellPopover';
import RenameEntityModal from '@/shared/ui/components/RenameEntityModal';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import type { DocumentListingTab } from '@/shared/ui/components/DocumentListing/DocumentListingHeader';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import { useCallback, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import type { NotebooksListingContext } from './use-notebooks-listing';
import type { ScriptingNotebook } from '@volt/contracts/modules/scripting/domain';

enum NotebooksListingTabId {
    List = 'list',
    Trajectory = 'trajectory'
};

interface NotebooksListingTabView {
    columns: ColumnConfig<ScriptingNotebook>[];
    context: NotebooksListingContext;
    emptyTitle: string;
    emptyMessage: string;
    emptyButtonText: string;
};

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

const renderTrajectoryDetails: NonNullable<ColumnConfig<ScriptingNotebook>['render']> = (_value, row) => {
    const trajectory = typeof row.trajectory === 'string' ? null : row.trajectory ?? null;

    return (
        <PopulatedCellPopover document={trajectory} modelName='Trajectory'>
            <span className='text-sm text-muted font-mono'>{trajectory?.name?.trim() || ''}</span>
        </PopulatedCellPopover>
    );
};

const TITLE_COLUMN: ColumnConfig<ScriptingNotebook> = {
    key: 'title',
    title: 'Title',
    sortable: true,
    render: (_value, row) => <span className='font-semibold text-muted truncate'>{row.title || 'Untitled Notebook'}</span>,
    skeleton: {
        variant: 'text',
        width: 180
    }
};

const TRAJECTORY_COLUMN: ColumnConfig<ScriptingNotebook> = {
    key: 'trajectory',
    title: 'Trajectory',
    sortable: false,
    render: renderTrajectoryDetails,
    skeleton: {
        variant: 'text',
        width: 150
    }
};

const CLUSTER_COLUMN = clusterColumn<ScriptingNotebook>({ width: 150 });

const CREATED_BY_COLUMN = userColumn<ScriptingNotebook>('createdBy', 'Created By');

const LAST_OPENED_AT_COLUMN = dateColumn<ScriptingNotebook>('lastOpenedAt', 'Last Opened At', {
    width: 110,
    withTitle: true,
    fallback: '-'
});

const NOTEBOOK_TAB_VIEWS: Record<NotebooksListingTabId, NotebooksListingTabView> = {
    [NotebooksListingTabId.List]: {
        columns: [TITLE_COLUMN, CLUSTER_COLUMN, CREATED_BY_COLUMN, LAST_OPENED_AT_COLUMN],
        context: { scope: ScriptingNotebookScope.General },
        emptyTitle: 'No notebooks yet',
        emptyMessage: 'Create a general notebook to start drafting scripts and experiments.',
        emptyButtonText: 'Create notebook'
    },
    [NotebooksListingTabId.Trajectory]: {
        columns: [TITLE_COLUMN, TRAJECTORY_COLUMN, CLUSTER_COLUMN, CREATED_BY_COLUMN, LAST_OPENED_AT_COLUMN],
        context: { scope: ScriptingNotebookScope.Trajectory },
        emptyTitle: 'No trajectory notebooks yet',
        emptyMessage: 'Open a notebook from a trajectory workspace to keep it tied to a run.',
        emptyButtonText: 'View general notebooks'
    }
};

const getNotebookTitle = (notebook: ScriptingNotebook): string => notebook.title;

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
    const containerRuntime = useContainerRuntimeAvailability();
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

    const view = NOTEBOOK_TAB_VIEWS[activeTab];
    const isTrajectoryTab = activeTab === NotebooksListingTabId.Trajectory;
    const createNew = isTrajectoryTab
        ? undefined
        : {
            buttonTitle: 'New Notebook',
            onCreate: handleCreate
        };

    const handleEmptyStateAction = useCallback(() => {
        if (activeTab === NotebooksListingTabId.Trajectory) {
            setActiveTab(NotebooksListingTabId.List);
            return;
        }

        handleCreate();
    }, [activeTab, handleCreate]);

    if(containerRuntime === 'unavailable') return <DockerNeededState feature='Notebooks' />;

    return (
        <>
            <DocumentListing<ScriptingNotebook, NotebooksListingContext>
                title='Notebooks'
                queryKey={queryKey}
                columns={view.columns}
                context={view.context}
                tabs={NOTEBOOK_TABS}
                defaultTabId={NotebooksListingTabId.List}
                fetchData={fetchData}
                getMenuOptions={getMenuOptions}
                createNew={createNew}
                emptyTitle={view.emptyTitle}
                emptyMessage={view.emptyMessage}
                emptyButtonText={view.emptyButtonText}
                onEmptyButtonClick={handleEmptyStateAction}
                onTabChange={(tabId) => setActiveTab(tabId as NotebooksListingTabId)}
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
                    <p className='text-xs text-muted truncate'>
                        Current name: {renamingNotebook.title || 'Untitled notebook'}
                    </p>
                )}
                helperText={<p className='text-xs text-muted'>Use up to 120 characters.</p>}
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
