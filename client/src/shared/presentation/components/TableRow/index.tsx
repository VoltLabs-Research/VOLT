import { motion } from 'framer-motion';
import Container from '@/shared/presentation/components/Container';
import Popover from '@/shared/presentation/components/Popover';
import AsyncMenuItemWrapper from '@/shared/presentation/components/AsyncMenuItemWrapper';
import type { ColumnConfig, MenuOption, Identifiable } from '../DocumentListingTable';

interface TableRowProps<T extends Identifiable> {
    item: T;
    columns: ColumnConfig[];
    columnWidths: number[];
    getMenuOptions?: (item: T) => MenuOption[];
    useFlexDistribution: boolean;
    columnGap?: number;
};

const TableRow = <T extends Identifiable>({ 
    item, 
    columns, 
    columnWidths, 
    getMenuOptions, 
    useFlexDistribution,
    columnGap = 16
}: TableRowProps<T>) => {
    const menuOptions = getMenuOptions ? getMenuOptions(item) : [];
    const itemRecord = item as Record<string, unknown>;

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
            className='document-listing-table-row-container cursor-pointer w-max'
            transition={{ duration: 0.1 }}
        >
            {columns.map((col, colIdx) => {
                const cellValue = itemRecord?.[col.key];
                const title = String(cellValue ?? '');

                return (
                    <Container
                        className='document-listing-cell overflow-hidden d-flex items-center color-primary'
                        data-label={col.title}
                        key={`cell-${col.title}-${colIdx}`}
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
        <Popover id={`row-menu-${item._id}`} trigger={content}>
            {menuOptions.map((option, idx) => (
                <AsyncMenuItemWrapper key={idx} option={option} />
            ))}
        </Popover>
    );
};

export default TableRow;
