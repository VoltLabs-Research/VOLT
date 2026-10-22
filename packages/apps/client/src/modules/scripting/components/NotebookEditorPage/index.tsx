import NotebookCellView from './NotebookCellView';
import type { CellRunMode } from './CellEditor';
import useNotebookEditor from '@/modules/scripting/hooks/use-notebook-editor';
import type { KernelStatus, SaveStatus } from '@/modules/scripting/hooks/use-notebook-editor';
import { scriptingNotebookQuery } from '@/modules/scripting/hooks/queries';
import { localStackMode } from '@/modules/local-stack/services/local-stack-mode';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useDashboardWorkspaceChrome from '@/modules/dashboard/hooks/use-dashboard-workspace-chrome';
import type { NotebookCellType } from '@/modules/scripting/utils/notebook-document';
import Loader from '@/shared/ui/components/Loader';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import Scrollable from '@/shared/ui/components/Scrollable';
import StatusPill from '@/shared/ui/components/StatusPill';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import { applyMonacoTheme, getMonacoThemeName } from '@/shared/ui/utils/ensure-monaco';
import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/ui/utils/app-theme';
import { Button, Tooltip } from '@heroui/react';
import { ArrowLeft, Code, FileText, Play, RotateCcw, Square } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const KERNEL_LABELS: Record<KernelStatus, { label: string; status: string }> = {
    unavailable: { label: 'No kernel', status: 'disabled' },
    connecting: { label: 'Connecting', status: 'pending' },
    starting: { label: 'Starting', status: 'pending' },
    preparing: { label: 'Preparing environment', status: 'preparing' },
    idle: { label: 'Idle', status: 'ready' },
    busy: { label: 'Running', status: 'running' },
    dead: { label: 'Stopped', status: 'failed' }
};

const SAVE_LABELS: Record<SaveStatus, string> = {
    saved: 'Saved',
    unsaved: 'Unsaved changes',
    saving: 'Saving…',
    failed: 'Not saved'
};

const HeaderButton = ({ label, onPress, isDisabled, children }: { label: string; onPress: () => void; isDisabled?: boolean; children: ReactNode }) => (
    <Tooltip>
        <Button size='sm' variant='ghost' isIconOnly aria-label={label} onPress={onPress} isDisabled={isDisabled}>
            {children}
        </Button>
        <Tooltip.Content placement='bottom'>{label}</Tooltip.Content>
    </Tooltip>
);

const AddCellButtons = ({ onAdd }: { onAdd: (cellType: NotebookCellType) => void }) => (
    <div className='flex items-center justify-center gap-2'>
        <Button size='sm' variant='ghost' onPress={() => onAdd('code')}>
            <Code size={14} />
            Code
        </Button>
        <Button size='sm' variant='ghost' onPress={() => onAdd('markdown')}>
            <FileText size={14} />
            Text
        </Button>
    </div>
);

const NotebookEditorPage = () => {
    const { notebookId = '' } = useParams<{ notebookId: string }>();
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const kernelsEnabled = localStackMode.isEnabled();
    // The editor writes the document: it is read once per opening, and dropped when the editor closes.
    const { data: notebook, isError, refetch } = scriptingNotebookQuery({ notebookId }, {
        enabled: Boolean(notebookId),
        staleTime: Infinity,
        gcTime: 0,
        refetchOnWindowFocus: false
    });
    const editor = useNotebookEditor({ notebookId, workspace: teamId ?? null, document: notebook?.content, kernelsEnabled });

    usePageTitle(notebook?.title ?? 'Notebook');
    useDashboardWorkspaceChrome({ hideHeader: true });

    const [monacoTheme, setMonacoTheme] = useState(() => getMonacoThemeName(getActiveAppTheme()));
    const [isMonacoReady, setIsMonacoReady] = useState(false);
    // The editors mount once Monaco is set up with the app's themes, rather than loading it themselves.
    useEffect(() => {
        let cancelled = false;
        const unsubscribe = subscribeToAppTheme((theme) => {
            setMonacoTheme(getMonacoThemeName(theme));
            void applyMonacoTheme(theme).then(() => {
                if(!cancelled){
                    setIsMonacoReady(true);
                }
            });
        });
        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, []);

    // Text cells show their Markdown rendered, except the ones being written.
    const [editingText, setEditingText] = useState<Record<string, boolean>>({});
    const [focus, setFocus] = useState<{ cellId: string; request: number } | null>(null);
    const focusCell = useCallback((cellId: string) => {
        setFocus({ cellId, request: Date.now() });
    }, []);

    const { cells, insertCell, runCell } = editor;
    const addCell = useCallback((index: number, cellType: NotebookCellType) => {
        const cellId = insertCell(index, cellType);
        if(cellType !== 'code'){
            setEditingText((editing) => ({ ...editing, [cellId]: true }));
        }
        focusCell(cellId);
    }, [focusCell, insertCell]);

    const handleRun = useCallback((cellId: string, mode: CellRunMode) => {
        const index = cells.findIndex((cell) => cell.id === cellId);
        if(index < 0){
            return;
        }
        if(cells[index].type === 'code'){
            runCell(cellId);
        }else{
            setEditingText((editing) => ({ ...editing, [cellId]: false }));
        }
        if(mode === 'next'){
            const next = cells[index + 1];
            if(next){
                focusCell(next.id);
            }else{
                addCell(index + 1, 'code');
            }
        }else if(mode === 'insert'){
            addCell(index + 1, 'code');
        }
    }, [addCell, cells, focusCell, runCell]);

    if(isError){
        return (
            <RecoveryState
                title='The notebook could not be opened'
                description='It may have been deleted, or the server did not answer.'
                retryLabel='Try again'
                onRetry={() => void refetch()}
                showBack
            />
        );
    }

    if(!notebook || !editor.isLoaded || !isMonacoReady){
        return (
            <div className='flex h-full w-full items-center justify-center' role='status' aria-label='Opening the notebook'>
                <Loader size='lg' />
            </div>
        );
    }

    const kernel = KERNEL_LABELS[editor.kernelStatus];
    const canRun = editor.kernelStatus !== 'unavailable' && editor.kernelStatus !== 'dead' && editor.kernelStatus !== 'connecting';
    const isBusy = editor.kernelStatus === 'busy' || Object.keys(editor.running).length > 0;

    return (
        <div className='flex h-full w-full min-w-0 flex-col bg-surface'>
            <header className='flex items-center gap-2 border-b border-border px-3 py-2'>
                <HeaderButton label='Back to notebooks' onPress={() => navigate('/dashboard/notebooks')}>
                    <ArrowLeft size={16} />
                </HeaderButton>
                <div className='flex min-w-0 flex-1 flex-col'>
                    <h1 className='m-0 truncate text-sm font-semibold text-foreground'>{notebook.title || 'Untitled Notebook'}</h1>
                    <span className='text-2xs text-muted' aria-live='polite'>{SAVE_LABELS[editor.saveStatus]}</span>
                </div>
                <StatusPill status={kernel.status} />
                <span className='text-xs text-muted' role='status' aria-label='Kernel status'>{kernel.label}</span>
                <HeaderButton label='Run all cells' onPress={editor.runAll} isDisabled={!canRun}>
                    <Play size={16} />
                </HeaderButton>
                <HeaderButton label='Interrupt' onPress={editor.interrupt} isDisabled={!isBusy}>
                    <Square size={16} />
                </HeaderButton>
                <HeaderButton label='Restart the kernel' onPress={editor.restart} isDisabled={!kernelsEnabled}>
                    <RotateCcw size={16} />
                </HeaderButton>
            </header>

            {editor.kernelStatus === 'preparing' && (
                <div className='flex flex-col gap-1 border-b border-border bg-warning/5 px-4 py-2' role='status'>
                    <p className='m-0 text-xs text-foreground'>
                        Preparing this workspace&apos;s Python environment. The first time, its packages are downloaded; then notebooks start in seconds.
                    </p>
                    {editor.preparation && (
                        <pre className='m-0 truncate font-mono text-2xs text-muted'>{editor.preparation.trim().split('\n').at(-1)}</pre>
                    )}
                </div>
            )}
            {editor.kernelStatus === 'dead' && (
                <div className='flex items-center gap-3 border-b border-border bg-danger/5 px-4 py-2' role='alert'>
                    <p className='m-0 min-w-0 flex-1 truncate text-xs text-foreground'>
                        {editor.kernelFailure ? `The kernel stopped: ${editor.kernelFailure}` : 'The kernel stopped.'}
                    </p>
                    <Button size='sm' variant='secondary' onPress={editor.restart}>Restart</Button>
                </div>
            )}
            {editor.kernelStatus === 'unavailable' && (
                <div className='border-b border-border px-4 py-2' role='status'>
                    <p className='m-0 text-xs text-muted'>
                        Cells run here when VOLT runs on this computer. On this server, open the notebook in Jupyter from the notebooks list.
                    </p>
                </div>
            )}

            <Scrollable className='min-h-0 flex-1'>
                <div className='mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6'>
                    {cells.map((cell, index) => (
                        <NotebookCellView
                            key={cell.id}
                            cell={cell}
                            index={index}
                            count={cells.length}
                            isRunning={cell.id in editor.running}
                            canRun={canRun}
                            isEditingText={editingText[cell.id] ?? !cell.source.trim()}
                            monacoTheme={monacoTheme}
                            focusRequest={focus?.cellId === cell.id ? focus.request : 0}
                            inputPrompt={editor.inputRequest && editor.inputRequest.cellId === cell.id ? editor.inputRequest : null}
                            onChange={(source) => editor.editCell(cell.id, source)}
                            onRun={(mode) => handleRun(cell.id, mode)}
                            onFocus={() => setFocus((current) => (current?.cellId === cell.id ? current : { cellId: cell.id, request: 0 }))}
                            onEditText={(isEditing) => {
                                setEditingText((editing) => ({ ...editing, [cell.id]: isEditing }));
                                if(isEditing){
                                    focusCell(cell.id);
                                }
                            }}
                            onRetype={(cellType) => {
                                editor.retypeCell(cell.id, cellType);
                                setEditingText((editing) => ({ ...editing, [cell.id]: true }));
                            }}
                            onMove={(offset) => editor.moveCell(cell.id, offset)}
                            onRemove={() => editor.removeCell(cell.id)}
                            onAnswerInput={editor.answerInput}
                            complete={editor.complete}
                        />
                    ))}
                    <AddCellButtons onAdd={(cellType) => addCell(cells.length, cellType)} />
                </div>
            </Scrollable>
        </div>
    );
};

export default NotebookEditorPage;
