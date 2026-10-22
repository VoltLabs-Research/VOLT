import type {
    NotebookDocument,
    NotebookMimeBundle,
    NotebookOutput,
    NotebookText
} from '@volt/contracts/modules/scripting/domain';

export type NotebookCellType = 'code' | 'markdown' | 'raw';

// A cell as the editor works on it: its source as one string, and an id of its own.
export interface EditableCell {
    id: string;
    type: NotebookCellType;
    source: string;
    metadata: Record<string, unknown>;
    executionCount: number | null;
    outputs: NotebookOutput[];
}

export interface EditableNotebook {
    cells: EditableCell[];
    metadata: Record<string, unknown>;
}

// The format the editor writes: 4.5, the first with cell ids.
const NBFORMAT = 4;
const NBFORMAT_MINOR = 5;

const ANSI_ESCAPE = new RegExp(String.raw`\u001b\[[0-9;?]*[A-Za-z]`, 'g');

export const textOf = (text: NotebookText | undefined): string => (
    Array.isArray(text) ? text.join('') : text ?? ''
);

export const createCell = (type: NotebookCellType, source = ''): EditableCell => ({
    id: crypto.randomUUID(),
    type,
    source,
    metadata: {},
    executionCount: null,
    outputs: []
});

export const toEditableNotebook = (document: NotebookDocument | undefined): EditableNotebook => ({
    cells: (Array.isArray(document?.cells) ? document.cells : []).map((cell) => ({
        id: typeof cell.id === 'string' && cell.id ? cell.id : crypto.randomUUID(),
        type: cell.cell_type === 'code' || cell.cell_type === 'raw' ? cell.cell_type : 'markdown',
        source: textOf(cell.source),
        metadata: cell.metadata ?? {},
        executionCount: cell.cell_type === 'code' ? cell.execution_count ?? null : null,
        outputs: cell.cell_type === 'code' && Array.isArray(cell.outputs) ? cell.outputs : []
    })),
    metadata: document?.metadata ?? {}
});

export const toNotebookDocument = (notebook: EditableNotebook): NotebookDocument => ({
    cells: notebook.cells.map((cell) => (cell.type === 'code'
        ? {
            id: cell.id,
            cell_type: 'code',
            source: cell.source,
            metadata: cell.metadata,
            execution_count: cell.executionCount,
            outputs: cell.outputs
        }
        : {
            id: cell.id,
            cell_type: cell.type,
            source: cell.source,
            metadata: cell.metadata
        })),
    metadata: notebook.metadata,
    nbformat: NBFORMAT,
    nbformat_minor: NBFORMAT_MINOR
});

// An output after a cell's others: a stream continues the stream before it, as Jupyter shows it.
export const appendOutput = (outputs: NotebookOutput[], output: NotebookOutput): NotebookOutput[] => {
    const last = outputs.at(-1);
    if(output.output_type === 'stream' && last?.output_type === 'stream' && last.name === output.name){
        return [...outputs.slice(0, -1), { ...last, text: textOf(last.text) + textOf(output.text) }];
    }
    return [...outputs, output];
};

// What a terminal shows of program output: no escape sequences, and each line as its last carriage
// return left it (progress bars redraw a line that way).
export const terminalText = (text: string): string => text
    .replace(ANSI_ESCAPE, '')
    .split('\n')
    .map((line) => {
        const content = line.replace(/\r+$/, '');
        return content.slice(content.lastIndexOf('\r') + 1);
    })
    .join('\n');

// A value of a mime bundle as text: nbformat may store it as lines.
export const mimeText = (data: NotebookMimeBundle, mime: string): string | null => {
    const value = data[mime];
    if(typeof value === 'string' || (Array.isArray(value) && value.every((line) => typeof line === 'string'))){
        return textOf(value as NotebookText);
    }
    return null;
};
