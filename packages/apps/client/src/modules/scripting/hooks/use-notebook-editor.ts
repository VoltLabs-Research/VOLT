// A notebook open in the editor: its document, saved as it changes, and its kernel, which runs in
// this window when it runs its stack (services/notebook-kernels.ts). Outputs go to the cells whose
// executions printed or displayed them.
import service from '@/modules/scripting/api/scripting-service';
import { notebookKernels } from '@/modules/scripting/services/notebook-kernels';
import { createCell, textOf, toEditableNotebook, toNotebookDocument } from '@/modules/scripting/utils/notebook-document';
import type { NotebookCellType } from '@/modules/scripting/utils/notebook-document';
import { initialNotebookEditorState, notebookEditorReducer } from '@/modules/scripting/utils/notebook-editor-state';
import type { Completion, NotebookKernel, NotebookKernelEvent } from '@volt/web-runtime/host/notebook-kernels';
import type { NotebookDocument, NotebookOutput } from '@volt/contracts/modules/scripting/domain';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

// Where the kernel is: 'unavailable' where this window does not run kernels (a remote server's
// notebooks run in Jupyter).
export type KernelStatus = 'unavailable' | 'connecting' | 'starting' | 'preparing' | 'idle' | 'busy' | 'dead';

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'failed';

// What input() or getpass() in a running cell waits for.
export interface InputRequest {
    cellId: string | null;
    prompt: string;
    password: boolean;
}

interface UseNotebookEditorInput {
    notebookId: string;
    // The workspace whose environment the kernel runs in: the notebook's team.
    workspace: string | null;
    document: NotebookDocument | undefined;
    kernelsEnabled: boolean;
}

// Changes are saved once typing pauses, and at least this often while a cell keeps printing.
const SAVE_DELAY_MS = 1_000;
const SAVE_MAX_DELAY_MS = 10_000;
// The tail of the environment's preparation the editor shows.
const PREPARATION_LOG_LIMIT = 4_000;

const NO_COMPLETION: Completion = { matches: [], cursorStart: 0, cursorEnd: 0 };

const useNotebookEditor = ({ notebookId, workspace, document, kernelsEnabled }: UseNotebookEditorInput) => {
    const [state, dispatch] = useReducer(notebookEditorReducer, initialNotebookEditorState);
    const stateRef = useRef(state);
    stateRef.current = state;

    const loadedNotebookId = useRef<string | null>(null);
    useEffect(() => {
        if(document && loadedNotebookId.current !== notebookId){
            loadedNotebookId.current = notebookId;
            dispatch({ type: 'load', notebook: toEditableNotebook(document) });
        }
    }, [document, notebookId]);

    // --- saving ------------------------------------------------------------------------------
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const savedVersion = useRef(0);
    const unsavedSince = useRef<number | null>(null);
    const saving = useRef<Promise<void> | null>(null);

    const save = useCallback(async (): Promise<void> => {
        while(saving.current){
            await saving.current;
        }
        const { version, notebook } = stateRef.current;
        if(version === savedVersion.current || loadedNotebookId.current !== notebookId){
            return;
        }
        setSaveStatus('saving');
        saving.current = service.saveNotebookContent({ notebookId, content: toNotebookDocument(notebook) }).then(
            () => {
                savedVersion.current = version;
                setSaveStatus(stateRef.current.version === version ? 'saved' : 'unsaved');
            },
            () => setSaveStatus('failed')
        ).finally(() => {
            saving.current = null;
        });
        await saving.current;
    }, [notebookId]);

    useEffect(() => {
        if(state.version === savedVersion.current){
            return;
        }
        setSaveStatus((status) => (status === 'saving' ? status : 'unsaved'));
        unsavedSince.current ??= Date.now();
        const delay = Math.min(SAVE_DELAY_MS, Math.max(0, unsavedSince.current + SAVE_MAX_DELAY_MS - Date.now()));
        const timer = setTimeout(() => {
            unsavedSince.current = null;
            void save();
        }, delay);
        return () => clearTimeout(timer);
    }, [state.version, save]);

    // Leaving the editor saves what is not saved yet.
    useEffect(() => () => {
        void save();
    }, [save]);

    // --- the kernel ----------------------------------------------------------------------------
    const [kernel, setKernel] = useState<NotebookKernel | null>(null);
    const [kernelStatus, setKernelStatus] = useState<KernelStatus>(kernelsEnabled ? 'connecting' : 'unavailable');
    const [kernelFailure, setKernelFailure] = useState<string | null>(null);
    const [preparation, setPreparation] = useState('');
    const [inputRequest, setInputRequest] = useState<InputRequest | null>(null);
    const [generation, setGeneration] = useState(0);
    // The cell each execution runs, by the kernel's execution id.
    const executions = useRef(new Map<string, string>());

    useEffect(() => {
        if(!kernelsEnabled || !workspace){
            return;
        }
        let unsubscribe: () => void = () => {};
        let cancelled = false;
        const cellOf = (executionId: string | null): string | null => (executionId ? executions.current.get(executionId) ?? null : null);
        const handle = (event: NotebookKernelEvent): void => {
            if(event.type === 'status'){
                setKernelStatus(event.state);
            }else if(event.type === 'exit'){
                setKernelStatus('dead');
                setKernelFailure(event.failure);
                setInputRequest(null);
                dispatch({ type: 'stopAll' });
            }else if(event.type === 'output'){
                const cellId = cellOf(event.id);
                if(cellId){
                    dispatch({ type: 'output', cellId, output: event.output as unknown as NotebookOutput });
                }else if(event.id === null && event.output.output_type === 'stream'){
                    const text = textOf(event.output.text as string | string[]);
                    setPreparation((log) => (log + text).slice(-PREPARATION_LOG_LIMIT));
                }
            }else if(event.type === 'clear'){
                const cellId = cellOf(event.id);
                if(cellId){
                    dispatch({ type: 'clear', cellId, wait: event.wait });
                }
            }else if(event.type === 'input'){
                setInputRequest({ cellId: cellOf(event.id), prompt: event.prompt, password: event.password });
            }
        };
        setKernelStatus('connecting');
        setKernelFailure(null);
        setPreparation('');
        notebookKernels.open(notebookId, workspace).then((opened) => {
            if(cancelled){
                return;
            }
            unsubscribe = opened.subscribe(handle);
            setKernel(opened);
            setKernelStatus(opened.state);
            setKernelFailure(opened.failure);
        }, (error: unknown) => {
            if(!cancelled){
                setKernelStatus('dead');
                setKernelFailure(error instanceof Error ? error.message : String(error));
            }
        });
        return () => {
            cancelled = true;
            unsubscribe();
            setKernel(null);
        };
    }, [notebookId, workspace, kernelsEnabled, generation]);

    const runCell = useCallback((cellId: string): void => {
        const cell = stateRef.current.notebook.cells.find((candidate) => candidate.id === cellId);
        if(!kernel || cell?.type !== 'code' || cellId in stateRef.current.running){
            return;
        }
        dispatch({ type: 'queue', cellId });
        kernel.execute(cell.source, (executionId) => {
            executions.current.set(executionId, cellId);
        }).then(
            (reply) => dispatch({ type: 'finish', cellId, executionCount: reply.executionCount }),
            () => dispatch({ type: 'finish', cellId, executionCount: null })
        );
    }, [kernel]);

    const runAll = useCallback((): void => {
        for(const cell of stateRef.current.notebook.cells){
            runCell(cell.id);
        }
    }, [runCell]);

    const interrupt = useCallback((): void => {
        kernel?.interrupt();
        setInputRequest(null);
    }, [kernel]);

    // A new kernel: variables are gone; the workspace's packages and files stay.
    const restart = useCallback((): void => {
        if(!workspace){
            return;
        }
        notebookKernels.shutdown(notebookId);
        executions.current.clear();
        dispatch({ type: 'stopAll' });
        setInputRequest(null);
        setGeneration((value) => value + 1);
    }, [notebookId, workspace]);

    const answerInput = useCallback((text: string): void => {
        kernel?.answerInput(text);
        setInputRequest(null);
    }, [kernel]);

    const complete = useCallback((code: string, cursor: number): Promise<Completion> => (
        kernel && kernel.state !== 'dead' ? kernel.complete(code, cursor).catch(() => NO_COMPLETION) : Promise.resolve(NO_COMPLETION)
    ), [kernel]);

    // --- cells -------------------------------------------------------------------------------
    const editCell = useCallback((cellId: string, source: string): void => {
        dispatch({ type: 'edit', cellId, source });
    }, []);

    // The new cell's id.
    const insertCell = useCallback((index: number, cellType: NotebookCellType): string => {
        const cell = createCell(cellType);
        dispatch({ type: 'insert', index, cell });
        return cell.id;
    }, []);

    const removeCell = useCallback((cellId: string): void => {
        dispatch({ type: 'remove', cellId });
    }, []);

    const moveCell = useCallback((cellId: string, offset: number): void => {
        dispatch({ type: 'move', cellId, offset });
    }, []);

    const retypeCell = useCallback((cellId: string, cellType: NotebookCellType): void => {
        dispatch({ type: 'retype', cellId, cellType });
    }, []);

    return {
        cells: state.notebook.cells,
        isLoaded: loadedNotebookId.current === notebookId,
        running: state.running,
        saveStatus,
        save,
        kernelStatus,
        kernelFailure,
        preparation,
        inputRequest,
        runCell,
        runAll,
        interrupt,
        restart,
        answerInput,
        complete,
        editCell,
        insertCell,
        removeCell,
        moveCell,
        retypeCell
    };
};

export default useNotebookEditor;
