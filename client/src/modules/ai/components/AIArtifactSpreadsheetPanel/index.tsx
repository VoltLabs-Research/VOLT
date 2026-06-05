import { resolveTabularPayload } from '@/modules/ai/utilities/message-artifacts';
import { base64ToBlob, triggerBrowserDownload } from '@/shared/utils/file';
import Box from '@/shared/presentation/primitives/Box';
import Divider from '@/shared/presentation/primitives/Divider';
import IconButton from '@/shared/presentation/primitives/IconButton';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import Tooltip from '@/shared/presentation/primitives/Tooltip';
import VisuallyHidden from '@/shared/presentation/primitives/VisuallyHidden';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import { copyTextToClipboard } from '@/shared/presentation/utilities/copy-to-clipboard';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { IoCheckmarkOutline, IoClipboardOutline } from 'react-icons/io5';
import { PiFileCsv, PiFileXls } from 'react-icons/pi';
import type { AIMessageArtifact } from '@/modules/ai/api/entities/ai-conversation';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import './AIArtifactSpreadsheetPanel.css';

interface AIArtifactSpreadsheetPanelProps {
    artifact: AIMessageArtifact;
    onClose: () => void;
    width?: number;
}

interface CellAddress {
    row: number;
    col: number;
}

type XlsxModule = typeof import('xlsx');
let xlsxPromise: Promise<XlsxModule> | null = null;

const loadXlsx = (): Promise<XlsxModule> => {
    if (!xlsxPromise) {
        xlsxPromise = import('xlsx').catch((error) => {
            xlsxPromise = null;
            throw error;
        });
    }

    return xlsxPromise;
};

const EXCEL_COMPATIBLE_CSV_PREFIX = '\uFEFFsep=,\r\n';

const toExcelCompatibleCsvContent = (csvContent: string): string => {
    const normalized = csvContent.replace(/\r?\n/g, '\n').replace(/\n/g, '\r\n');
    return `${EXCEL_COMPATIBLE_CSV_PREFIX}${normalized}`;
};

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

    if (str === '') {
        return '\u2014';
    }

    return str;
};

const AIArtifactSpreadsheetPanel = ({ artifact, onClose, width }: AIArtifactSpreadsheetPanelProps) => {
    const table = resolveTabularPayload(artifact);

    const [edits, setEdits] = useState<Record<string, string>>({});
    const [activeCell, setActiveCell] = useState<CellAddress>({ row: 0, col: 0 });
    const [editingCell, setEditingCell] = useState<CellAddress | null>(null);
    const [editBuffer, setEditBuffer] = useState('');
    const [copyFeedback, setCopyFeedback] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Spreadsheet ready.');

    const inputRef = useRef<HTMLInputElement>(null);
    const cellRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
    const feedbackTimeoutRef = useRef<number | null>(null);
    const instructionsId = useId();
    const statusId = useId();

    const columns = useMemo(() => table?.columns ?? [], [table]);
    const rows = useMemo(() => table?.rows ?? [], [table]);

    const hasEdits = Object.keys(edits).length > 0;

    const cellKey = (row: number, col: number) => `${row}:${col}`;

    const updateStatusMessage = useCallback((message: string) => {
        setStatusMessage(message);
    }, []);

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
                    let value = stringifyValue(row[col]);
                    if (key in edits) {
                        value = edits[key];
                    }

                    return [col, value];
                })
            )
        );
    }, [rows, columns, edits]);

    const commitEdit = useCallback(() => {
        if (!editingCell) return;
        const original = stringifyValue(rows[editingCell.row]?.[columns[editingCell.col]]);
        const key = cellKey(editingCell.row, editingCell.col);
        const columnName = columns[editingCell.col] ?? `Column ${editingCell.col + 1}`;

        if (editBuffer !== original) {
            setEdits((prev) => ({ ...prev, [key]: editBuffer }));
            updateStatusMessage(`Updated row ${editingCell.row + 1}, ${columnName}.`);
        } else {
            setEdits((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            updateStatusMessage(`No changes saved for row ${editingCell.row + 1}, ${columnName}.`);
        }

        setActiveCell(editingCell);
        setEditingCell(null);
    }, [editingCell, editBuffer, rows, columns, updateStatusMessage]);

    const startEditing = useCallback((row: number, col: number) => {
        if (editingCell) {
            commitEdit();
        }

        const value = getCellValue(row, col);
        const columnName = columns[col] ?? `Column ${col + 1}`;

        setActiveCell({ row, col });
        setEditingCell({ row, col });
        setEditBuffer(value);
        updateStatusMessage(`Editing row ${row + 1}, ${columnName}.`);
    }, [columns, editingCell, commitEdit, getCellValue, updateStatusMessage]);

    const cancelEdit = useCallback(() => {
        if (editingCell) {
            const columnName = columns[editingCell.col] ?? `Column ${editingCell.col + 1}`;
            updateStatusMessage(`Canceled edit for row ${editingCell.row + 1}, ${columnName}.`);
            setActiveCell(editingCell);
        }

        setEditingCell(null);
    }, [columns, editingCell, updateStatusMessage]);

    const focusCell = useCallback((row: number, col: number) => {
        const targetCell = cellRefs.current[cellKey(row, col)];
        targetCell?.focus();
    }, []);

    const moveSelection = useCallback((rowDelta: number, colDelta: number) => {
        const nextRow = Math.max(0, Math.min(rows.length - 1, activeCell.row + rowDelta));
        const nextCol = Math.max(0, Math.min(columns.length - 1, activeCell.col + colDelta));

        setActiveCell({ row: nextRow, col: nextCol });
    }, [activeCell.col, activeCell.row, columns.length, rows.length]);

    const moveToCell = useCallback((rowDelta: number, colDelta: number) => {
        if (!editingCell) return;
        const nextRow = Math.max(0, Math.min(rows.length - 1, editingCell.row + rowDelta));
        const nextCol = Math.max(0, Math.min(columns.length - 1, editingCell.col + colDelta));
        commitEdit();
        const value = getCellValue(nextRow, nextCol);
        setEditingCell({ row: nextRow, col: nextCol });
        setEditBuffer(value);
    }, [editingCell, rows.length, columns.length, commitEdit, getCellValue]);

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            let rowDelta = 1;

            if (e.shiftKey) {
                rowDelta = -1;
            }

            moveToCell(rowDelta, 0);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            let colDelta = 1;

            if (e.shiftKey) {
                colDelta = -1;
            }

            moveToCell(0, colDelta);
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

    useEffect(() => {
        if (!editingCell) {
            focusCell(activeCell.row, activeCell.col);
        }
    }, [activeCell.col, activeCell.row, editingCell, focusCell]);

    useEffect(() => {
        return () => {
            if (feedbackTimeoutRef.current !== null) {
                window.clearTimeout(feedbackTimeoutRef.current);
            }
        };
    }, []);

    const handleDownloadCSV = async () => {
        try {
            const XLSX = await loadXlsx();
            const data = getExportData();
            const worksheet = XLSX.utils.json_to_sheet(data, { header: columns });
            const csvContent = XLSX.utils.sheet_to_csv(worksheet);
            const blob = new Blob([toExcelCompatibleCsvContent(csvContent)], { type: 'text/csv;charset=utf-8' });
            triggerBrowserDownload(blob, `${artifact.title || 'table'}.csv`);
            updateStatusMessage('Downloaded CSV file.');
        } catch {
            updateStatusMessage('Failed to load export engine for CSV.');
        }
    };

    const handleDownloadXLSX = async () => {
        try {
            const XLSX = await loadXlsx();
            const data = getExportData();
            const worksheet = XLSX.utils.json_to_sheet(data, { header: columns });
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
            const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = base64ToBlob(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            triggerBrowserDownload(blob, `${artifact.title || 'table'}.xlsx`);
            updateStatusMessage('Downloaded Excel file.');
        } catch {
            updateStatusMessage('Failed to load export engine for Excel.');
        }
    };

    const handleCopyToClipboard = async () => {
        let tsvContent = '';

        try {
            const XLSX = await loadXlsx();
            const data = getExportData();
            const worksheet = XLSX.utils.json_to_sheet(data, { header: columns });
            tsvContent = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
        } catch {
            updateStatusMessage('Failed to load export engine for clipboard copy.');
            return;
        }

        const copied = await copyTextToClipboard(tsvContent, {
            successMessage: 'Copied to clipboard',
            errorMessage: 'Failed to copy to clipboard'
        });

        if (!copied) {
            updateStatusMessage('Failed to copy table to clipboard.');
            return;
        }

        setCopyFeedback(true);
        updateStatusMessage('Copied table to clipboard.');

        if (feedbackTimeoutRef.current !== null) {
            window.clearTimeout(feedbackTimeoutRef.current);
        }

        feedbackTimeoutRef.current = window.setTimeout(() => {
            setCopyFeedback(false);
        }, 2000);
    };

    if (!table) return null;

    let panelStyle: CSSProperties | undefined;
    if (width) {
        panelStyle = {
            width,
            flexShrink: 0
        };
    }

    let copyIcon: ReactNode = <IoClipboardOutline size={15} />;
    if (copyFeedback) {
        copyIcon = <IoCheckmarkOutline size={15} />;
    }

    let copyTooltip = 'Copy to clipboard';
    if (copyFeedback) {
        copyTooltip = 'Copied!';
    }

    const renderCellContent = (rowIndex: number, colIndex: number, isEditing: boolean) => {
        let content: ReactNode = (
            <span className='ai-sheet-cell-value'>
                {displayValue(getCellValue(rowIndex, colIndex))}
            </span>
        );

        if (isEditing) {
            content = (
                <input
                    ref={inputRef}
                    type='text'
                    className='ai-sheet-cell-input'
                    value={editBuffer}
                    onChange={(event) => setEditBuffer(event.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={handleKeyDown}
                    aria-label={`Edit row ${rowIndex + 1}, ${columns[colIndex]}`}
                />
            );
        }

        return content;
    };

    const handleCellClick = (rowIndex: number, colIndex: number) => {
        setActiveCell({ row: rowIndex, col: colIndex });
    };

    const handleCellKeyDown = (event: KeyboardEvent<HTMLTableCellElement>, rowIndex: number, colIndex: number) => {
        if (event.key === 'Enter' || event.key === 'F2') {
            event.preventDefault();
            startEditing(rowIndex, colIndex);
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveSelection(-1, 0);
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveSelection(1, 0);
            return;
        }

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            moveSelection(0, -1);
            return;
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            moveSelection(0, 1);
            return;
        }
    };

    const renderRowCell = (rowIndex: number, col: string, colIndex: number) => {
        const isEditing = editingCell?.row === rowIndex
            && editingCell?.col === colIndex;
        const isActive = activeCell.row === rowIndex
            && activeCell.col === colIndex;
        const key = cellKey(rowIndex, colIndex);
        const isEdited = key in edits;
        let cellClassName = 'ai-sheet-cell';

        if (isEdited) {
            cellClassName = 'ai-sheet-cell is-edited';
        }

        if (isActive) {
            cellClassName += ' is-active';
        }

        return (
            <td
                key={col}
                ref={(node) => {
                    cellRefs.current[key] = node;
                }}
                className={cellClassName}
                role='gridcell'
                tabIndex={isActive ? 0 : -1}
                aria-selected={isActive}
                aria-colindex={colIndex + 2}
                aria-rowindex={rowIndex + 2}
                onDoubleClick={() => startEditing(rowIndex, colIndex)}
                onClick={() => handleCellClick(rowIndex, colIndex)}
                onFocus={() => handleCellClick(rowIndex, colIndex)}
                onKeyDown={(event) => handleCellKeyDown(event, rowIndex, colIndex)}
            >
                {renderCellContent(rowIndex, colIndex, isEditing)}
            </td>
        );
    };

    const toolbarActions = (
        <Row gap='025' className='ai-artifact-spreadsheet-toolbar'>
            <Tooltip content={copyTooltip}>
                <IconButton
                    aria-label='Copy table to clipboard'
                    onClick={handleCopyToClipboard}
                    className='ai-sheet-toolbar-btn'
                >
                    {copyIcon}
                </IconButton>
            </Tooltip>

            <Tooltip content='Download CSV'>
                <IconButton
                    aria-label='Download CSV'
                    onClick={handleDownloadCSV}
                    className='ai-sheet-toolbar-btn'
                >
                    <PiFileCsv size={15} />
                </IconButton>
            </Tooltip>

            <Tooltip content='Download Excel'>
                <IconButton
                    aria-label='Download Excel'
                    onClick={handleDownloadXLSX}
                    className='ai-sheet-toolbar-btn'
                >
                    <PiFileXls size={15} />
                </IconButton>
            </Tooltip>

            <Divider orientation='vertical' />
        </Row>
    );

    return (
        <Stack className='ai-artifact-spreadsheet-panel' style={panelStyle} aria-label={artifact.title}>
            <PanelHeader
                title={artifact.title}
                actions={toolbarActions}
                onClose={onClose}
            />

            <Stack gap='025' p='075' className='ai-artifact-spreadsheet-meta'>
                <Text as='p' size='sm' tone='muted'>
                    {rows.length} rows · {columns.length} columns
                    {hasEdits && ' · edited'}
                </Text>
                <Text as='p' id={instructionsId} size='sm' tone='muted'>
                    Enter or F2 edits the selected cell. Arrow keys move between cells. Tab and Shift+Tab move while editing.
                </Text>
                {artifact.summary && (
                    <Text as='p' size='sm' tone='muted' className='text-ellipsis'>
                        {artifact.summary}
                    </Text>
                )}
            </Stack>

            <VisuallyHidden id={statusId} aria-live='polite' aria-atomic='true'>
                {statusMessage}
            </VisuallyHidden>

            <Box className='ai-artifact-spreadsheet-body x-auto y-auto'>
                <table
                    className='ai-artifact-spreadsheet-table'
                    role='grid'
                    aria-label={`${artifact.title} spreadsheet`}
                    aria-describedby={`${instructionsId} ${statusId}`}
                    aria-rowcount={rows.length + 1}
                    aria-colcount={columns.length + 1}
                >
                    <thead>
                        <tr role='row'>
                            <th scope='col' className='ai-sheet-row-index-header'>#</th>
                            {columns.map((col) => (
                                <th key={col} scope='col'>
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((_, rowIndex) => (
                            <tr key={rowIndex} role='row'>
                                <th scope='row' className='ai-sheet-row-index-cell'>
                                    {rowIndex + 1}
                                </th>
                                {columns.map((col, colIndex) => renderRowCell(rowIndex, col, colIndex))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Box>
        </Stack>
    );
};

export default AIArtifactSpreadsheetPanel;
