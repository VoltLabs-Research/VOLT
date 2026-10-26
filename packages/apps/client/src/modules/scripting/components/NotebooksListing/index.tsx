import { RENAME_SCRIPTING_NOTEBOOK_MODAL_ID } from '@/modules/scripting/contracts/modal-ids';
import ScriptingNotebookDeploymentModal from '@/modules/scripting/components/ScriptingNotebookDeploymentModal';
import useNotebooksListing from './use-notebooks-listing';
import type { NotebooksListingContext } from './use-notebooks-listing';
import { ScriptingNotebookScope } from '@volt/contracts/modules/scripting/domain';
import { clusterColumn, dateColumn, userColumn } from '@/shared/ui/utils/column-presets';
import DockerNeededState from '@/shared/ui/components/DockerNeededState';
import { useContainerRuntimeAvailability } from '@/modules/cluster/hooks/use-container-runtime-availability';
import RenameEntityModal from '@/shared/ui/components/RenameEntityModal';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { InputHTMLAttributes } from 'react';
import type { ScriptingNotebook } from '@volt/contracts/modules/scripting/domain';

// Trajectory notebooks live in their trajectory's workspace; this page lists the general ones.
const NOTEBOOKS_CONTEXT: NotebooksListingContext = { scope: ScriptingNotebookScope.General };

const TITLE_COLUMN: ColumnConfig<ScriptingNotebook> = {
    key: 'title',
    title: 'Title',
    sortable: true,
    render: (_value, row) => <span className='truncate font-medium text-foreground'>{row.title || 'Untitled Notebook'}</span>,
    skeleton: {
        variant: 'text',
        width: 180
    }
};

const CLUSTER_COLUMN = clusterColumn<ScriptingNotebook>({ width: 150 });

const CREATED_BY_COLUMN = userColumn<ScriptingNotebook>('createdBy', 'Created By');

const LAST_OPENED_AT_COLUMN = dateColumn<ScriptingNotebook>('lastOpenedAt', 'Last Opened At', {
    width: 110,
    withTitle: true,
    fallback: '-'
});

const NOTEBOOK_COLUMNS: ColumnConfig<ScriptingNotebook>[] = [TITLE_COLUMN, CLUSTER_COLUMN, CREATED_BY_COLUMN, LAST_OPENED_AT_COLUMN];

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
    const {
        opensInBrowser,
        fetchData,
        getMenuOptions,
        handleItemClick,
        handleCreate,
        handleDeploymentModalClose,
        handleRenameClose,
        handleRenameSubmit,
        deploymentModalRequest,
        renamingNotebook,
        queryKey,
        socketInvalidation
    } = useNotebooksListing();

    // Kernels in this window need no containers.
    if(containerRuntime === 'unavailable' && !opensInBrowser) return <DockerNeededState feature='Notebooks' />;

    return (
        <>
            <DocumentListing<ScriptingNotebook, NotebooksListingContext>
                title='Notebooks'
                queryKey={queryKey}
                columns={NOTEBOOK_COLUMNS}
                context={NOTEBOOKS_CONTEXT}
                fetchData={fetchData}
                getMenuOptions={getMenuOptions}
                onItemClick={handleItemClick}
                createNew={{
                    buttonTitle: 'New Notebook',
                    onCreate: handleCreate
                }}
                emptyTitle='No notebooks yet'
                emptyMessage='Create a general notebook to start drafting scripts and experiments.'
                emptyButtonText='Create notebook'
                onEmptyButtonClick={handleCreate}
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
