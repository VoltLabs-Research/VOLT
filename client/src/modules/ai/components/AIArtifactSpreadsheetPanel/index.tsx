import { buildSheetBlob, buildSheetTsv } from '@/modules/ai/components/AIArtifactSpreadsheetPanel/spreadsheet-export';
import { resolveTabularPayload } from '@/modules/ai/utils/message-artifacts';
import { triggerBrowserDownload } from '@/shared/utils/file';
import useSpreadsheetEditor from '@/modules/ai/components/AIArtifactSpreadsheetPanel/use-spreadsheet-editor';
import { Divider, IconButton, Tooltip } from '@voltstack/bravais';
import PanelHeader from '@/shared/ui/components/PanelHeader';
import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { useEffect, useId, useRef, useState } from 'react';
import { Check, Clipboard, FileSpreadsheet, FileText } from 'lucide-react';
import type { AIMessageArtifact } from '@volt/contracts/modules/ai/domain';
import type { SheetExportFormat } from '@/modules/ai/components/AIArtifactSpreadsheetPanel/spreadsheet-export';
import type { CSSProperties } from 'react';
import './AIArtifactSpreadsheetPanel.css';

interface AIArtifactSpreadsheetPanelProps {
    artifact: AIMessageArtifact;
    onClose: () => void;
    width?: number;
}

const EMPTY_CELL_PLACEHOLDER = '\u2014';

const COPY_FEEDBACK_MS = 2000;

const SHEET_FORMAT_LABEL: Record<SheetExportFormat, string> = {
    csv: 'CSV',
    xlsx: 'Excel'
};

const AIArtifactSpreadsheetPanel = ({ artifact, onClose, width }: AIArtifactSpreadsheetPanelProps) => {
    const table = resolveTabularPayload(artifact);
    const columns = table?.columns ?? [];
    const rows = table?.rows ?? [];

    const {
        activeCell,
        editBuffer,
        editingCell,
        hasEdits,
        inputRef,
        isCellEdited,
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
    } = useSpreadsheetEditor(columns, rows);

    const [copyFeedback, setCopyFeedback] = useState(false);
    const feedbackTimeoutRef = useRef<number | null>(null);
    const instructionsId = useId();
    const statusId = useId();

    useEffect(() => {
        return () => {
            if (feedbackTimeoutRef.current !== null) {
                window.clearTimeout(feedbackTimeoutRef.current);
            }
        };
    }, []);

    const createDownloadHandler = (format: SheetExportFormat) => async () => {
        try {
            const blob = await buildSheetBlob(format, getExportData(), columns);
            triggerBrowserDownload(blob, `${artifact.title || 'table'}.${format}`);
            setStatusMessage(`Downloaded ${SHEET_FORMAT_LABEL[format]} file.`);
        } catch {
            setStatusMessage(`Failed to load export engine for ${SHEET_FORMAT_LABEL[format]}.`);
        }
    };

    const handleCopyToClipboard = async () => {
        let tsvContent = '';

        try {
            tsvContent = await buildSheetTsv(getExportData(), columns);
        } catch {
            setStatusMessage('Failed to load export engine for clipboard copy.');
            return;
        }

        const copied = await copyTextToClipboard(tsvContent, {
            successMessage: 'Copied to clipboard',
            errorMessage: 'Failed to copy to clipboard'
        });

        if (!copied) {
            setStatusMessage('Failed to copy table to clipboard.');
            return;
        }

        setCopyFeedback(true);
        setStatusMessage('Copied table to clipboard.');

        if (feedbackTimeoutRef.current !== null) {
            window.clearTimeout(feedbackTimeoutRef.current);
        }

        feedbackTimeoutRef.current = window.setTimeout(() => {
            setCopyFeedback(false);
        }, COPY_FEEDBACK_MS);
    };

    if (!table) return null;

    let panelStyle: CSSProperties | undefined;
    if (width) {
        panelStyle = {
            width,
            flexShrink: 0
        };
    }

    const renderRowCell = (rowIndex: number, col: string, colIndex: number) => {
        const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
        const isActive = activeCell.row === rowIndex && activeCell.col === colIndex;
        let cellClassName = 'ai-sheet-cell';

        if (isCellEdited(rowIndex, colIndex)) {
            cellClassName = 'ai-sheet-cell is-edited';
        }

        if (isActive) {
            cellClassName += ' is-active';
        }

        return (
            <td
                key={col}
                ref={registerCellRef(rowIndex, colIndex)}
                className={cellClassName}
                role='gridcell'
                tabIndex={isActive ? 0 : -1}
                aria-selected={isActive}
                aria-colindex={colIndex + 2}
                aria-rowindex={rowIndex + 2}
                onDoubleClick={() => startEditing(rowIndex, colIndex)}
                onClick={() => selectCell(rowIndex, colIndex)}
                onFocus={() => selectCell(rowIndex, colIndex)}
                onKeyDown={(event) => handleCellKeyDown(event, rowIndex, colIndex)}
            >
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type='text'
                        className='ai-sheet-cell-input'
                        value={editBuffer}
                        onChange={(event) => setEditBuffer(event.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleEditKeyDown}
                        aria-label={`Edit flex-row ${rowIndex + 1}, ${col}`}
                    />
                ) : (
                    <span className='ai-sheet-cell-value'>
                        {getCellValue(rowIndex, colIndex) || EMPTY_CELL_PLACEHOLDER}
                    </span>
                )}
            </td>
        );
    };

    const toolbarActions = (
        <div className='flex flex-row items-center gap-1 ai-artifact-spreadsheet-toolbar'>
            <Tooltip content={copyFeedback ? 'Copied!' : 'Copy to clipboard'}>
                <IconButton
                    aria-label='Copy table to clipboard'
                    onClick={handleCopyToClipboard}
                    className='ai-sheet-toolbar-btn'
                >
                    {copyFeedback ? <Check size={15} /> : <Clipboard size={15} />}
                </IconButton>
            </Tooltip>

            <Tooltip content='Download CSV'>
                <IconButton
                    aria-label='Download CSV'
                    onClick={createDownloadHandler('csv')}
                    className='ai-sheet-toolbar-btn'
                >
                    <FileText size={15} />
                </IconButton>
            </Tooltip>

            <Tooltip content='Download Excel'>
                <IconButton
                    aria-label='Download Excel'
                    onClick={createDownloadHandler('xlsx')}
                    className='ai-sheet-toolbar-btn'
                >
                    <FileSpreadsheet size={15} />
                </IconButton>
            </Tooltip>

            <Divider orientation='vertical' />
        </div>
    );

    return (
        <div className='flex flex-col ai-artifact-spreadsheet-panel' style={panelStyle} aria-label={artifact.title}>
            <PanelHeader
                title={artifact.title}
                actions={toolbarActions}
                onClose={onClose}
            />

            <div className='flex flex-col gap-1 p-3 ai-artifact-spreadsheet-meta'>
                <p className='text-xs text-muted'>
                    {rows.length} rows · {columns.length} columns
                    {hasEdits && ' · edited'}
                </p>
                <p className='text-xs text-muted' id={instructionsId}>
                    Enter or F2 edits the selected cell. Arrow keys move between cells. Tab and Shift+Tab move while editing.
                </p>
                {artifact.summary && (
                    <p className='text-xs text-muted text-ellipsis'>
                        {artifact.summary}
                    </p>
                )}
            </div>

            <span className='sr-only' id={statusId} aria-live='polite' aria-atomic='true'>
                {statusMessage}
            </span>

            <div className='ai-artifact-spreadsheet-body overflow-x-auto overflow-y-auto'>
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
                                <th scope='flex-row' className='ai-sheet-row-index-cell'>
                                    {rowIndex + 1}
                                </th>
                                {columns.map((col, colIndex) => renderRowCell(rowIndex, col, colIndex))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AIArtifactSpreadsheetPanel;
