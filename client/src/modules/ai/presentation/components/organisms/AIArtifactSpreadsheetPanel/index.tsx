import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoCloseOutline, IoClipboardOutline, IoCheckmarkOutline } from 'react-icons/io5';
import { PiFileCsv, PiFileXls } from 'react-icons/pi';
import type { AIMessageArtifact } from '@/modules/ai/presentation/utils/message-artifacts';
import { resolveTabularPayload } from '@/modules/ai/presentation/utils/message-artifacts';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Tooltip from '@/shared/presentation/components/Tooltip';
import * as XLSX from 'xlsx';
import './AIArtifactSpreadsheetPanel.css';
import { base64ToBlob, triggerBrowserDownload } from '@/shared/utils';

interface AIArtifactSpreadsheetPanelProps {
    artifact: AIMessageArtifact;
    onClose: () => void;
    width?: number;
}

interface CellAddress {
    row: number;
    col: number;
}

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

const displayValue = (value: unknown): string => {
    const str = stringifyValue(value);
    return str === '' ? '\u2014' : str;
};

const AIArtifactSpreadsheetPanel = ({ artifact, onClose, width }: AIArtifactSpreadsheetPanelProps) => {
    const table = resolveTabularPayload(artifact);

    const [edits, setEdits] = useState<Record<string, string>>({});
    const [editingCell, setEditingCell] = useState<CellAddress | null>(null);
    const [editBuffer, setEditBuffer] = useState('');
    const [copyFeedback, setCopyFeedback] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    const columns = useMemo(() => table?.columns ?? [], [table]);
    const rows = useMemo(() => table?.rows ?? [], [table]);

    const hasEdits = Object.keys(edits).length > 0;

    const cellKey = (row: number, col: number) => `${row}:${col}`;

    const getCellValue = useCallback((rowIndex: number, colIndex: number): string => {
        const key = cellKey(rowIndex, colIndex);
        if (key in edits) return edits[key];
        const column = columns[colIndex];
        return stringifyValue(rows[rowIndex]?.[column]);
    }, [edits, columns, rows]);

    const getExportData = useCallback((): Record<string, string>[] => {
        return rows.map((row, rowIndex) =>
            Object.fromEntries(
                columns.map((col, colIndex) => {
                    const key = cellKey(rowIndex, colIndex);
                    const value = key in edits ? edits[key] : stringifyValue(row[col]);
                    return [col, value];
                })
            )
        );
    }, [rows, columns, edits]);

    const commitEdit = useCallback(() => {
        if (!editingCell) return;
        const original = stringifyValue(rows[editingCell.row]?.[columns[editingCell.col]]);
        const key = cellKey(editingCell.row, editingCell.col);

        if (editBuffer !== original) {
            setEdits((prev) => ({ ...prev, [key]: editBuffer }));
        } else {
            setEdits((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
        setEditingCell(null);
    }, [editingCell, editBuffer, rows, columns]);

    const startEditing = useCallback((row: number, col: number) => {
        if (editingCell) {
            commitEdit();
        }
        const value = getCellValue(row, col);
        setEditingCell({ row, col });
        setEditBuffer(value);
    }, [editingCell, commitEdit, getCellValue]);

    const cancelEdit = () => {
        setEditingCell(null);
    };

    const moveToCell = useCallback((rowDelta: number, colDelta: number) => {
        if (!editingCell) return;
        const nextRow = Math.max(0, Math.min(rows.length - 1, editingCell.row + rowDelta));
        const nextCol = Math.max(0, Math.min(columns.length - 1, editingCell.col + colDelta));
        commitEdit();
        const value = getCellValue(nextRow, nextCol);
        setEditingCell({ row: nextRow, col: nextCol });
        setEditBuffer(value);
    }, [editingCell, rows.length, columns.length, commitEdit, getCellValue]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            moveToCell(e.shiftKey ? -1 : 1, 0);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            moveToCell(0, e.shiftKey ? -1 : 1);
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    }, [moveToCell]);

    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingCell]);

    const handleDownloadCSV = () => {
        const data = getExportData();
        const worksheet = XLSX.utils.json_to_sheet(data, { header: columns });
        const csvContent = XLSX.utils.sheet_to_csv(worksheet);
        const blob = base64ToBlob(csvContent, 'text/csv');
        triggerBrowserDownload(blob, `${artifact.title || 'table'}.csv`);
    };

    const handleDownloadXLSX = () => {
        const data = getExportData();
        const worksheet = XLSX.utils.json_to_sheet(data, { header: columns });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = base64ToBlob(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        triggerBrowserDownload(blob, `${artifact.title || 'table'}.xlsx`);
    };

    const handleCopyToClipboard = async () => {
    };

    if (!table) return null;

    return (
        <Container
            className='d-flex column ai-artifact-spreadsheet-panel'
            style={width ? { width, flexShrink: 0 } : undefined}
        >
            <Container className='d-flex items-center content-between gap-05 ai-artifact-spreadsheet-header'>
                <Container className='d-flex column gap-025' style={{ minWidth: 0 }}>
                    <Paragraph className='font-size-2 font-weight-6 color-primary text-ellipsis'>
                        {artifact.title}
                    </Paragraph>
                    <Paragraph className='font-size-1 color-muted'>
                        {rows.length} rows · {columns.length} columns
                        {hasEdits && ' · edited'}
                    </Paragraph>
                    {artifact.summary && (
                        <Paragraph className='font-size-1 color-muted text-ellipsis'>
                            {artifact.summary}
                        </Paragraph>
                    )}
                </Container>

                <Container className='d-flex items-center gap-025 ai-artifact-spreadsheet-toolbar'>
                    <Tooltip content={copyFeedback ? 'Copied!' : 'Copy to clipboard'}>
                        <IconButton onClick={handleCopyToClipboard} className='ai-sheet-toolbar-btn'>
                            {copyFeedback
                                ? <IoCheckmarkOutline size={15} />
                                : <IoClipboardOutline size={15} />
                            }
                        </IconButton>
                    </Tooltip>

                    <Tooltip content='Download CSV'>
                        <IconButton onClick={handleDownloadCSV} className='ai-sheet-toolbar-btn'>
                            <PiFileCsv size={15} />
                        </IconButton>
                    </Tooltip>

                    <Tooltip content='Download Excel'>
                        <IconButton onClick={handleDownloadXLSX} className='ai-sheet-toolbar-btn'>
                            <PiFileXls size={15} />
                        </IconButton>
                    </Tooltip>

                    <Container className='ai-sheet-toolbar-divider' />

                    <Tooltip content='Close panel'>
                        <IconButton onClick={onClose} className='ai-sheet-toolbar-btn'>
                            <IoCloseOutline size={18} />
                        </IconButton>
                    </Tooltip>
                </Container>
            </Container>

            <Container className='ai-artifact-spreadsheet-body x-auto y-auto'>
                <table className='ai-artifact-spreadsheet-table'>
                    <thead>
                        <tr>
                            <th className='ai-sheet-row-index-header'>#</th>
                            {columns.map((col) => (
                                <th key={col}>{col}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((_, rowIndex) => (
                            <tr key={rowIndex}>
                                <td className='ai-sheet-row-index-cell'>{rowIndex + 1}</td>
                                {columns.map((col, colIndex) => {
                                    const isEditing = editingCell?.row === rowIndex
                                        && editingCell?.col === colIndex;
                                    const key = cellKey(rowIndex, colIndex);
                                    const isEdited = key in edits;

                                    return (
                                        <td
                                            key={col}
                                            className={`ai-sheet-cell${isEdited ? ' is-edited' : ''}`}
                                            onDoubleClick={() => startEditing(rowIndex, colIndex)}
                                        >
                                            {isEditing ? (
                                                <input
                                                    ref={inputRef}
                                                    type='text'
                                                    className='ai-sheet-cell-input'
                                                    value={editBuffer}
                                                    onChange={(e) => setEditBuffer(e.target.value)}
                                                    onBlur={commitEdit}
                                                    onKeyDown={handleKeyDown}
                                                />
                                            ) : (
                                                <span className='ai-sheet-cell-value'>
                                                    {displayValue(getCellValue(rowIndex, colIndex))}
                                                </span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Container>
        </Container>
    );
};

export default AIArtifactSpreadsheetPanel;
