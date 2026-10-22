import { appendOutput, createCell } from '@/modules/scripting/utils/notebook-document';
import type { EditableCell, EditableNotebook, NotebookCellType } from '@/modules/scripting/utils/notebook-document';
import type { NotebookOutput } from '@volt/contracts/modules/scripting/domain';

export interface NotebookEditorState {
    notebook: EditableNotebook;
    // Bumped by every change the document keeps (sources, cells, outputs): what autosave saves.
    version: number;
    // The cells whose executions wait for the kernel or run.
    running: Record<string, true>;
    // The cells whose outputs the next output replaces (clear_output(wait=True)).
    clearing: Record<string, true>;
}

export type NotebookEditorAction =
    | { type: 'load'; notebook: EditableNotebook }
    | { type: 'edit'; cellId: string; source: string }
    | { type: 'insert'; index: number; cell: EditableCell }
    | { type: 'remove'; cellId: string }
    | { type: 'move'; cellId: string; offset: number }
    | { type: 'retype'; cellId: string; cellType: NotebookCellType }
    | { type: 'queue'; cellId: string }
    | { type: 'output'; cellId: string; output: NotebookOutput }
    | { type: 'clear'; cellId: string; wait: boolean }
    | { type: 'finish'; cellId: string; executionCount: number | null }
    | { type: 'stopAll' };

export const initialNotebookEditorState: NotebookEditorState = {
    notebook: { cells: [], metadata: {} },
    version: 0,
    running: {},
    clearing: {}
};

const without = (record: Record<string, true>, key: string): Record<string, true> => {
    if(!(key in record)){
        return record;
    }
    const next = { ...record };
    delete next[key];
    return next;
};

const updateCell = (state: NotebookEditorState, cellId: string, change: (cell: EditableCell) => EditableCell): NotebookEditorState => ({
    ...state,
    version: state.version + 1,
    notebook: {
        ...state.notebook,
        cells: state.notebook.cells.map((cell) => (cell.id === cellId ? change(cell) : cell))
    }
});

export const notebookEditorReducer = (state: NotebookEditorState, action: NotebookEditorAction): NotebookEditorState => {
    switch(action.type){
        case 'load':
            // A notebook is never empty: there is always a cell to type into.
            return {
                ...initialNotebookEditorState,
                notebook: action.notebook.cells.length > 0 ? action.notebook : { ...action.notebook, cells: [createCell('code')] }
            };
        case 'edit':
            return updateCell(state, action.cellId, (cell) => ({ ...cell, source: action.source }));
        case 'insert': {
            const cells = [...state.notebook.cells];
            cells.splice(Math.max(0, Math.min(action.index, cells.length)), 0, action.cell);
            return { ...state, version: state.version + 1, notebook: { ...state.notebook, cells } };
        }
        case 'remove': {
            const cells = state.notebook.cells.filter((cell) => cell.id !== action.cellId);
            return {
                ...state,
                version: state.version + 1,
                notebook: { ...state.notebook, cells: cells.length > 0 ? cells : [createCell('code')] },
                running: without(state.running, action.cellId)
            };
        }
        case 'move': {
            const cells = [...state.notebook.cells];
            const from = cells.findIndex((cell) => cell.id === action.cellId);
            const to = from + action.offset;
            if(from < 0 || to < 0 || to >= cells.length){
                return state;
            }
            const [cell] = cells.splice(from, 1);
            cells.splice(to, 0, cell);
            return { ...state, version: state.version + 1, notebook: { ...state.notebook, cells } };
        }
        case 'retype':
            return updateCell(state, action.cellId, (cell) => ({
                ...cell,
                type: action.cellType,
                outputs: action.cellType === 'code' ? cell.outputs : [],
                executionCount: action.cellType === 'code' ? cell.executionCount : null
            }));
        case 'queue':
            return {
                ...updateCell(state, action.cellId, (cell) => ({ ...cell, outputs: [] })),
                running: { ...state.running, [action.cellId]: true },
                clearing: without(state.clearing, action.cellId)
            };
        case 'output': {
            const replaces = action.cellId in state.clearing;
            return {
                ...updateCell(state, action.cellId, (cell) => ({
                    ...cell,
                    outputs: appendOutput(replaces ? [] : cell.outputs, action.output)
                })),
                clearing: without(state.clearing, action.cellId)
            };
        }
        case 'clear':
            return action.wait
                ? { ...state, clearing: { ...state.clearing, [action.cellId]: true } }
                : updateCell(state, action.cellId, (cell) => ({ ...cell, outputs: [] }));
        case 'finish':
            return {
                ...(action.executionCount === null
                    ? state
                    : updateCell(state, action.cellId, (cell) => ({ ...cell, executionCount: action.executionCount }))),
                running: without(state.running, action.cellId),
                clearing: without(state.clearing, action.cellId)
            };
        case 'stopAll':
            return { ...state, running: {}, clearing: {} };
    }
};
