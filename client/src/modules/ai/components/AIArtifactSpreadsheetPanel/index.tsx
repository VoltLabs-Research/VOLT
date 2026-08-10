import { buildSheetBlob, buildSheetTsv } from '@/modules/ai/components/AIArtifactSpreadsheetPanel/spreadsheet-export';
import { resolveTabularPayload } from '@/modules/ai/utils/message-artifacts';
import { triggerBrowserDownload } from '@/shared/utils/file';
import useSpreadsheetEditor from '@/modules/ai/components/AIArtifactSpreadsheetPanel/use-spreadsheet-editor';
import { Button, Separator, Tooltip, cn } from '@heroui/react';
import PanelHeader from '@/shared/ui/components/PanelHeader';
import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { useEffect, useId, useRef, useState } from 'react';
import { Check, Clipboard, FileSpreadsheet, FileText } from 'lucide-react';
import type { AIMessageArtifact } from '@volt/contracts/modules/ai/domain';
import type { SheetExportFormat } from '@/modules/ai/components/AIArtifactSpreadsheetPanel/spreadsheet-export';
import type { CSSProperties } from 'react';

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

/**
 * The `@media (max-width: 900px)` block reset `width` with `!important` because the panel's
 * width arrives as an inline style from the resize handle; `max-md:w-full!` is that same
 * override in utility form \u2014 an inline style still wins, so the `!` is what beats it.
 */
const PANEL = 'flex min-w-[320px] max-w-[900px] flex-col border-l border-border bg-surface max-[1180px]:min-w-[280px] max-md:min-w-0 max-md:max-w-none max-md:w-full! max-md:border-l-0 max-md:border-t max-md:max-h-[calc(45vh-env(safe-area-inset-bottom,0px))]';

const PANEL_META = 'flex shrink-0 min-w-0 flex-col gap-1 border-b border-border bg-surface-secondary p-3';

const TOOLBAR_BUTTON = 'size-[1.7rem] min-h-[1.7rem] min-w-[1.7rem] rounded-lg text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-foreground';

const TABLE = 'min-w-full border-collapse';

const HEAD_CELL = 'sticky top-0 z-[1] whitespace-nowrap border-b border-border bg-surface-secondary px-[0.65rem] py-2 text-left text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-muted';

/**
 * `.ai-sheet-row-index-header` / `-cell` needed `text-align: right !important` to beat the
 * sheet's own `th { text-align: left }`; here the two are separate class strings applied to
 * separate elements, so no override is needed.
 */
const INDEX_HEAD_CELL = 'sticky top-0 z-[1] w-12 min-w-12 max-w-12 whitespace-nowrap border-b border-border bg-surface-secondary px-[0.65rem] py-2 text-right text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-muted';

const INDEX_CELL = 'w-12 min-w-12 max-w-12 border-b border-border bg-surface-secondary px-[0.65rem] py-[0.45rem] text-right text-[0.7rem] tabular-nums text-muted';

/** `tbody tr:hover` and `tbody tr:last-child td` become variants on the row itself. */
const BODY_ROW = 'hover:bg-surface-hover last:[&>td]:border-b-0 last:[&>th]:border-b-0';

const CELL = 'relative min-w-[120px] cursor-default border-b border-border p-0 text-[0.8125rem] text-foreground';

const CELL_ACTIVE = 'outline-2 -outline-offset-2 outline-[color-mix(in_srgb,var(--accent)_32%,transparent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]';

const CELL_EDITED = 'bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]';

const CELL_VALUE = 'block max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap px-[0.65rem] py-[0.45rem]';

const CELL_VALUE_EDITED = 'text-accent';

const CELL_INPUT = 'h-full w-full rounded-none border-none bg-background px-[0.6rem] py-[0.4rem] text-[0.8125rem] leading-[1.4] text-foreground outline-2 -outline-offset-2 outline-accent focus:outline-2 focus:-outline-offset-2 focus:outline-accent';

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
        const isEdited = isCellEdited(rowIndex, colIndex);
        const cellClassName = cn(CELL, isEdited && CELL_EDITED, isActive && CELL_ACTIVE);

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
                        className={CELL_INPUT}
                        value={editBuffer}
                        onChange={(event) => setEditBuffer(event.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleEditKeyDown}
                        aria-label={`Edit flex-row ${rowIndex + 1}, ${col}`}
                    />
                ) : (
                    <span className={cn(CELL_VALUE, isEdited && CELL_VALUE_EDITED)}>
                        {getCellValue(rowIndex, colIndex) || EMPTY_CELL_PLACEHOLDER}
                    </span>
                )}
            </td>
        );
    };

    const toolbarActions = (
        <div className='flex shrink-0 flex-row items-center gap-1'>
            <Tooltip>
                <Button
                    isIconOnly
                    variant='ghost'
                    aria-label='Copy table to clipboard'
                    onPress={handleCopyToClipboard}
                    className={TOOLBAR_BUTTON}
                >
                    {copyFeedback ? <Check size={15} /> : <Clipboard size={15} />}
                </Button>
                <Tooltip.Content>{copyFeedback ? 'Copied!' : 'Copy to clipboard'}</Tooltip.Content>
            </Tooltip>

            <Tooltip>
                <Button
                    isIconOnly
                    variant='ghost'
                    aria-label='Download CSV'
                    onPress={createDownloadHandler('csv')}
                    className={TOOLBAR_BUTTON}
                >
                    <FileText size={15} />
                </Button>
                <Tooltip.Content>Download CSV</Tooltip.Content>
            </Tooltip>

            <Tooltip>
                <Button
                    isIconOnly
                    variant='ghost'
                    aria-label='Download Excel'
                    onPress={createDownloadHandler('xlsx')}
                    className={TOOLBAR_BUTTON}
                >
                    <FileSpreadsheet size={15} />
                </Button>
                <Tooltip.Content>Download Excel</Tooltip.Content>
            </Tooltip>

            <Separator orientation='vertical' />
        </div>
    );

    return (
        <div className={PANEL} style={panelStyle} aria-label={artifact.title}>
            <PanelHeader
                title={artifact.title}
                actions={toolbarActions}
                onClose={onClose}
            />

            <div className={PANEL_META}>
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

            <div className='flex-1 overflow-x-auto overflow-y-auto'>
                <table
                    className={TABLE}
                    role='grid'
                    aria-label={`${artifact.title} spreadsheet`}
                    aria-describedby={`${instructionsId} ${statusId}`}
                    aria-rowcount={rows.length + 1}
                    aria-colcount={columns.length + 1}
                >
                    <thead>
                        <tr role='row'>
                            <th scope='col' className={INDEX_HEAD_CELL}>#</th>
                            {columns.map((col) => (
                                <th key={col} scope='col' className={HEAD_CELL}>
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((_, rowIndex) => (
                            <tr key={rowIndex} role='row' className={BODY_ROW}>
                                <th scope='flex-row' className={INDEX_CELL}>
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
