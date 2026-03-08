import { motion } from 'framer-motion';
import Container from '@/shared/presentation/components/Container';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { ColumnConfig, Identifiable } from '../DocumentListingTable';

interface TableRowProps<T extends Identifiable> {
    item: T;
    columns: ColumnConfig[];
    columnWidths: number[];
    getMenuOptions?: (item: T, selectedItems: T[]) => MenuOption[];
    selectedItems: T[];
    isSelected: boolean;
    onClick: (event: React.MouseEvent, item: T) => void;
    onContextMenu: (item: T) => void;
    useFlexDistribution: boolean;
    columnGap?: number;
};

const TableRow = <T extends Identifiable>({ 
    item, 
    columns, 
    columnWidths, 
    getMenuOptions, 
    selectedItems,
    isSelected,
    onClick,
    onContextMenu,
    useFlexDistribution,
    columnGap = 16
}: TableRowProps<T>) => {
    const menuOptions = getMenuOptions ? getMenuOptions(item, selectedItems) : [];
    const itemRecord = item as Record<string, unknown>;
    const getColumnKey = (col: ColumnConfig): string => String(col.key ?? col.path ?? '');
    const getColumnTitle = (col: ColumnConfig): string => String(col.title ?? col.label ?? col.key ?? col.path ?? '');

    const rowStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: useFlexDistribution ? 'space-between' : 'flex-start',
        gap: useFlexDistribution ? undefined : `${columnGap}px`
    };

    const content = (
        <motion.button
            type='button'
            style={rowStyle}
            className={`document-listing-table-row-container cursor-pointer w-max ${isSelected ? 'is-selected' : ''}`}
            transition={{ duration: 0.1 }}
            onClick={(event) => onClick(event, item)}
            onContextMenu={() => onContextMenu(item)}
            aria-pressed={isSelected}
        >
            {columns.map((col, colIdx) => {
                const columnKey = getColumnKey(col);
                const cellValue = itemRecord?.[columnKey];
                const title = String(cellValue ?? '');
                const columnTitle = getColumnTitle(col);

                return (
                    <Container
                        className='document-listing-cell overflow-hidden d-flex items-center color-primary'
                        data-label={columnTitle}
                        key={`cell-${columnTitle}-${colIdx}`}
                        title={title}
                        style={
                            useFlexDistribution
                                ? { flex: 1, minWidth: 0 }
                                : { 
                                    width: columnWidths[colIdx], 
                                    minWidth: columnWidths[colIdx], 
                                    maxWidth: columnWidths[colIdx], 
                                    flexShrink: 0 
                                }
                        }
                    >
                        <span className='document-listing-cell-value'>
                            {col.render ? col.render(cellValue, item) : String(cellValue ?? '-')}
                        </span>
                    </Container>
                );
            })}
        </motion.button>
    );

    if(menuOptions.length === 0) return content;

    return (
        <ContextMenuPopover id={`row-menu-${item._id}`} trigger={content} options={menuOptions} />
    );
};

export default TableRow;
