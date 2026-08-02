import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { cn } from '@/shared/utils/cn';
import { formatUnknownValue } from '@voltstack/bravais';
import { getColumnKey } from '@/shared/ui/components/DocumentListingTable';
import { renderInferredCell } from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers';
import { resolveColumnStyle } from '@/modules/plugin/components/listing/PluginCompactTable/column-layout';
import type { InferredColumnType } from '@/modules/plugin/components/listing/PluginCompactTable/typeInference';
import type { MenuOption } from '@/shared/contracts/menu';
import type { PluginTableColumnConfig } from '@/modules/plugin/components/listing/PluginCompactTable/column-layout';
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react';

/** The `rowProps` bag `react-window` forwards to every row it renders. */
export interface CompactTableRowProps {
    data: Record<string, unknown>[];
    columns: PluginTableColumnConfig[];
    getMenuOptions?: (row: Record<string, unknown>) => MenuOption[];
    inferredColumnTypes?: Record<string, InferredColumnType>;
    onRowClick?: (row: Record<string, unknown>) => void;
    selectedRowId?: string | null;
    columnWidthScale: number;
}

export const resolveRowIdentifier = (row: Record<string, unknown>, fallback: number): string => {
    const candidate = row._id ?? row.id;
    if(typeof candidate === 'string' || typeof candidate === 'number'){
        return String(candidate);
    }
    return String(fallback);
};

const CompactTableRow = ({
    index,
    style,
    data: rows,
    columns,
    getMenuOptions,
    inferredColumnTypes,
    onRowClick,
    selectedRowId,
    columnWidthScale
}: CompactTableRowProps & { index: number; style: CSSProperties }) => {
    const row = rows[index];
    if (!row) return null;

    const rowId = resolveRowIdentifier(row, index);
    const isSelected = Boolean(selectedRowId && rowId === selectedRowId);
    const isClickable = Boolean(onRowClick);

    const handleClick = isClickable
        ? (event: MouseEvent<HTMLDivElement>) => {
            if(event.defaultPrevented) return;
            onRowClick?.(row);
        }
        : undefined;

    const handleKeyDown = isClickable
        ? (event: KeyboardEvent<HTMLDivElement>) => {
            if(event.key === 'Enter' || event.key === ' '){
                event.preventDefault();
                onRowClick?.(row);
            }
        }
        : undefined;

    const content = (
        <div
            style={style}
            className={cn(
                'plugin-compact-table-row',
                isClickable ? 'plugin-compact-table-row--interactive' : null,
                isSelected ? 'plugin-compact-table-row--selected' : null
            )}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            aria-pressed={isClickable ? isSelected : undefined}
        >
            {columns.map((col) => {
                const columnKey = getColumnKey(col);
                const rawValue = row[columnKey];
                const inferred = inferredColumnTypes?.[columnKey];

                let cellContent: ReactNode;
                let titleAttribute: string | undefined;

                if(col.render){
                    cellContent = col.render(rawValue, row);
                }else if(inferred){
                    cellContent = renderInferredCell(rawValue, inferred);
                }else{
                    // Nothing is known about this column, so fall back to a
                    // stringified cell that also carries the full value.
                    titleAttribute = formatUnknownValue(rawValue);
                    cellContent = titleAttribute;
                }

                return (
                    <div
                        key={columnKey}
                        className='plugin-compact-table-cell overflow-hidden font-size-1'
                        style={resolveColumnStyle(col, columnWidthScale)}
                        title={titleAttribute}
                    >
                        {cellContent}
                    </div>
                );
            })}
        </div>
    );

    const menuOptions = getMenuOptions ? getMenuOptions(row) : [];
    if (menuOptions.length === 0) return content;

    return (
        <ContextMenuPopover
            id={`compact-row-menu-${rowId}`}
            trigger={content}
            options={menuOptions}
        />
    );
};

export default CompactTableRow;
