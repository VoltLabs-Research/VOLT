import { buildSheetBlob, buildSheetTsv } from '@/modules/ai/components/AIArtifactSpreadsheetPanel/spreadsheet-export';
import { triggerBrowserDownload } from '@/shared/utils/file';
import useSpreadsheetEditor from '@/modules/ai/components/AIArtifactSpreadsheetPanel/use-spreadsheet-editor';
import { Button, Tooltip, cn } from '@heroui/react';
import PanelHeader from '@/shared/ui/components/PanelHeader';
import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { useEffect, useId, useRef, useState } from 'react';
import { Check, Clipboard, FileSpreadsheet, FileText } from 'lucide-react';
import type { AITableArtifact } from '@/modules/ai/contracts/artifacts';
import type { SheetExportFormat } from '@/modules/ai/components/AIArtifactSpreadsheetPanel/spreadsheet-export';
import type { CSSProperties } from 'react';

interface AIArtifactSpreadsheetPanelProps {
    artifact: AITableArtifact;
    onClose: () => void;
    width?: number;
}

const EMPTY_CELL_PLACEHOLDER = '\u2014';

const COPY_FEEDBACK_MS = 2000;

const SHEET_FORMAT_LABEL: Record<SheetExportFormat, string> = {
    csv: 'CSV',
    xlsx: 'Excel'
};

const TOOLBAR_BUTTON_CLASS = 'text-muted hover:text-foreground';

// Each cell draws its right and bottom rule and the frame draws the outer edge, so the last column
// and the last row leave theirs to the frame.
const GRID_CELL_CLASS = 'border-r border-b border-foreground/8 last:border-r-0';

// The header row stays over the rows as they scroll under it, so it paints over the canvas.
const HEADER_CELL_CLASS = cn(
    GRID_CELL_CLASS,
    'sticky top-0 z-[1] whitespace-nowrap bg-[color-mix(in_oklab,var(--foreground)_5%,var(--canvas))] px-2.5 py-1.5 text-2xs font-medium text-muted'
);

const AIArtifactSpreadsheetPanel = ({ artifact, onClose, width }: AIArtifactSpreadsheetPanelProps) => {
    const { columns, rows } = artifact;

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

    if (columns.length === 0) return null;

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

        return (
            <td
                key={col}
                ref={registerCellRef(rowIndex, colIndex)}
                className={cn(
                    GRID_CELL_CLASS,
                    'relative min-w-[120px] cursor-default p-0 text-sm text-foreground',
                    isEdited && 'bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]',
                    isActive && 'outline-2 -outline-offset-2 outline-[color-mix(in_srgb,var(--accent)_32%,transparent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]'
                )}
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
                        className='h-full w-full rounded-none border-none bg-canvas px-2.5 py-1.5 text-sm leading-[1.4] text-foreground outline-2 -outline-offset-2 outline-accent focus:outline-2 focus:-outline-offset-2 focus:outline-accent'
                        value={editBuffer}
                        onChange={(event) => setEditBuffer(event.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleEditKeyDown}
                        aria-label={`Edit row ${rowIndex + 1}, ${col}`}
                    />
                ) : (
                    <span className={cn('block max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap px-2.5 py-1.5', isEdited && 'text-accent')}>
                        {getCellValue(rowIndex, colIndex) || EMPTY_CELL_PLACEHOLDER}
                    </span>
                )}
            </td>
        );
    };

    const toolbarActions = (
        <>
            <Tooltip>
                <Button
                    isIconOnly
                    variant='ghost'
                    aria-label='Copy table to clipboard'
                    onPress={handleCopyToClipboard}
                    className={TOOLBAR_BUTTON_CLASS}
                >
                    {copyFeedback ? <Check size={16} /> : <Clipboard size={16} />}
                </Button>
                <Tooltip.Content>{copyFeedback ? 'Copied!' : 'Copy to clipboard'}</Tooltip.Content>
            </Tooltip>
            <Tooltip>
                <Button
                    isIconOnly
                    variant='ghost'
                    aria-label='Download CSV'
                    onPress={createDownloadHandler('csv')}
                    className={TOOLBAR_BUTTON_CLASS}
                >
                    <FileText size={16} />
                </Button>
                <Tooltip.Content>Download CSV</Tooltip.Content>
            </Tooltip>
            <Tooltip>
                <Button
                    isIconOnly
                    variant='ghost'
                    aria-label='Download Excel'
                    onPress={createDownloadHandler('xlsx')}
                    className={TOOLBAR_BUTTON_CLASS}
                >
                    <FileSpreadsheet size={16} />
                </Button>
                <Tooltip.Content>Download Excel</Tooltip.Content>
            </Tooltip>
        </>
    );

    return (
        <div className='my-2 mr-2 flex min-w-[320px] max-w-[900px] flex-col overflow-hidden rounded-3xl bg-foreground/4 max-[1180px]:min-w-[280px] max-md:mx-2 max-md:mt-0 max-md:min-w-0 max-md:max-w-none max-md:w-auto! max-md:flex-1 max-md:max-h-[calc(45vh-env(safe-area-inset-bottom,0px))]' style={panelStyle} aria-label={artifact.title}>
            <PanelHeader
                title={artifact.title}
                actions={toolbarActions}
                onClose={onClose}
            />
            <div className='flex shrink-0 min-w-0 flex-col gap-1 px-5 pb-3 text-xs text-muted'>
                <p>
                    {rows.length} rows · {columns.length} columns
                    {hasEdits && ' · edited'}
                </p>
                {artifact.summary && <p>{artifact.summary}</p>}
            </div>
            <p className='sr-only' id={instructionsId}>
                Enter or F2 edits the selected cell. Arrow keys move between cells. Tab and Shift+Tab move while editing.
            </p>
            <span className='sr-only' id={statusId} aria-live='polite' aria-atomic='true'>
                {statusMessage}
            </span>
            <div className='mx-5 mb-5 min-h-0 overflow-auto rounded-xl border border-foreground/8'>
                <table
                    className='min-w-full border-separate border-spacing-0 tabular-nums'
                    role='grid'
                    aria-label={`${artifact.title} spreadsheet`}
                    aria-describedby={`${instructionsId} ${statusId}`}
                    aria-rowcount={rows.length + 1}
                    aria-colcount={columns.length + 1}
                >
                    <thead>
                        <tr role='row'>
                            <th scope='col' className={cn(HEADER_CELL_CLASS, 'w-12 min-w-12 max-w-12 text-center')}>#</th>
                            {columns.map((col) => (
                                <th key={col} scope='col' className={cn(HEADER_CELL_CLASS, 'text-left')}>
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((_, rowIndex) => (
                            <tr key={rowIndex} role='row' className='hover:bg-foreground/4 last:[&>td]:border-b-0 last:[&>th]:border-b-0'>
                                <th scope='row' className={cn(GRID_CELL_CLASS, 'w-12 min-w-12 max-w-12 bg-foreground/3 px-2.5 py-1.5 text-center text-2xs font-medium text-muted')}>
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
