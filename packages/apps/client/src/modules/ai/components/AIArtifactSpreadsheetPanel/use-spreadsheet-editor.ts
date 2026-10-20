import { useEffect, useRef, useState } from 'react';
import type { SheetRow } from '@/modules/ai/components/AIArtifactSpreadsheetPanel/spreadsheet-export';
import type { KeyboardEvent } from 'react';

interface CellAddress {
    row: number;
    col: number;
}

const ARROW_DELTAS: Record<string, [rowDelta: number, colDelta: number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1]
};

const cellKey = (row: number, col: number) => `${row}:${col}`;

const stringifyValue = (value: unknown): string => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const useSpreadsheetEditor = (columns: string[], rows: Record<string, unknown>[]) => {
    const [edits, setEdits] = useState<Record<string, string>>({});
    const [activeCell, setActiveCell] = useState<CellAddress>({
        row: 0,
        col: 0
    });
    const [editingCell, setEditingCell] = useState<CellAddress | null>(null);
    const [editBuffer, setEditBuffer] = useState('');
    const [statusMessage, setStatusMessage] = useState('Spreadsheet ready.');

    const inputRef = useRef<HTMLInputElement>(null);
    const cellRefs = useRef<Record<string, HTMLTableCellElement | null>>({});

    const columnLabel = (col: number) => columns[col] ?? `Column ${col + 1}`;

    const clamp = (row: number, col: number): CellAddress => ({
        row: Math.max(0, Math.min(rows.length - 1, row)),
        col: Math.max(0, Math.min(columns.length - 1, col))
    });

    const selectCell = (row: number, col: number) => setActiveCell({
        row,
        col
    });

    const getCellValue = (row: number, col: number): string => {
        const key = cellKey(row, col);
        if (key in edits) return edits[key];
        return stringifyValue(rows[row]?.[columns[col]]);
    };

    const getExportData = (): SheetRow[] => rows.map((row, rowIndex) => Object.fromEntries(
        columns.map((col, colIndex) => {
            const key = cellKey(rowIndex, colIndex);
            if (key in edits) {
                return [col, edits[key]];
            }

            return [col, stringifyValue(row[col])];
        })
    ));

    const commitEdit = () => {
        if (!editingCell) return;

        const key = cellKey(editingCell.row, editingCell.col);
        const original = stringifyValue(rows[editingCell.row]?.[columns[editingCell.col]]);
        const location = `flex-row ${editingCell.row + 1}, ${columnLabel(editingCell.col)}`;

        if (editBuffer !== original) {
            setEdits((previous) => ({
                ...previous,
                [key]: editBuffer
            }));
            setStatusMessage(`Updated ${location}.`);
        } else {
            setEdits((previous) => {
                const next = { ...previous };
                delete next[key];
                return next;
            });
            setStatusMessage(`No changes saved for ${location}.`);
        }

        setActiveCell(editingCell);
        setEditingCell(null);
    };

    const startEditing = (row: number, col: number) => {
        commitEdit();

        selectCell(row, col);
        setEditingCell({
            row,
            col
        });
        setEditBuffer(getCellValue(row, col));
        setStatusMessage(`Editing flex-row ${row + 1}, ${columnLabel(col)}.`);
    };

    const moveWhileEditing = (rowDelta: number, colDelta: number) => {
        if (!editingCell) return;

        const next = clamp(editingCell.row + rowDelta, editingCell.col + colDelta);
        commitEdit();
        setEditingCell(next);
        setEditBuffer(getCellValue(next.row, next.col));
    };

    const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            moveWhileEditing(event.shiftKey ? -1 : 1, 0);
            return;
        }

        if (event.key === 'Tab') {
            event.preventDefault();
            moveWhileEditing(0, event.shiftKey ? -1 : 1);
            return;
        }

        if (event.key === 'Escape' && editingCell) {
            setStatusMessage(`Canceled edit for flex-row ${editingCell.row + 1}, ${columnLabel(editingCell.col)}.`);
            setActiveCell(editingCell);
            setEditingCell(null);
        }
    };

    const handleCellKeyDown = (event: KeyboardEvent<HTMLTableCellElement>, row: number, col: number) => {
        if (event.key === 'Enter' || event.key === 'F2') {
            event.preventDefault();
            startEditing(row, col);
            return;
        }

        const delta = ARROW_DELTAS[event.key];
        if (delta) {
            event.preventDefault();
            setActiveCell(clamp(activeCell.row + delta[0], activeCell.col + delta[1]));
        }
    };

    useEffect(() => {
        if (editingCell) {
            inputRef.current?.focus();
            inputRef.current?.select();
            return;
        }

        cellRefs.current[cellKey(activeCell.row, activeCell.col)]?.focus();
    }, [activeCell.row, activeCell.col, editingCell]);

    const registerCellRef = (row: number, col: number) => (node: HTMLTableCellElement | null) => {
        cellRefs.current[cellKey(row, col)] = node;
    };

    return {
        activeCell,
        editBuffer,
        editingCell,
        hasEdits: Object.keys(edits).length > 0,
        inputRef,
        isCellEdited: (row: number, col: number) => cellKey(row, col) in edits,
        statusMessage,
        commitEdit,
        getCellValue,
        getExportData,
        handleCellKeyDown,
        handleEditKeyDown,
        registerCellRef,
        selectCell,
        setEditBuffer,
        setStatusMessage,
        startEditing
    };
};

export default useSpreadsheetEditor;
