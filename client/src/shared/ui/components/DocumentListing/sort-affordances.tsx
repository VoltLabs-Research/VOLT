import { getColumnKey, getColumnTitle } from '@/shared/ui/components/DocumentListingTable';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { SortConfig } from '@/shared/utils/sort';
import type { ReactNode } from 'react';

type AriaSort = 'ascending' | 'descending' | 'none';

const isSortedBy = <TRow,>(col: ColumnConfig<TRow>, sortConfig: SortConfig | null): boolean => {
    return Boolean(col.sortable) && sortConfig?.key === getColumnKey(col);
};

export const getColumnSortIndicator = <TRow,>(
    col: ColumnConfig<TRow>,
    sortConfig: SortConfig | null
): ReactNode => {
    if(!col.sortable) return null;

    const isActive = isSortedBy(col, sortConfig);
    const Icon = !isActive
        ? ArrowUpDown
        : sortConfig?.direction === 'asc' ? ArrowUp : ArrowDown;

    return (
        <span
            className={`sort-indicator d-flex flex-center ${isActive ? 'is-active' : ''}`}
            aria-hidden='true'
        >
            <Icon size={12} strokeWidth={2} />
        </span>
    );
};

export const getColumnAriaSort = <TRow,>(
    col: ColumnConfig<TRow>,
    sortConfig: SortConfig | null
): AriaSort => {
    if(!isSortedBy(col, sortConfig)) return 'none';

    return sortConfig?.direction === 'asc' ? 'ascending' : 'descending';
};

export const describeSortState = <TRow,>(
    columns: ColumnConfig<TRow>[],
    sortConfig: SortConfig | null
): string => {
    if(!sortConfig) return 'List sorted by default order.';

    const activeColumn = columns.find((col) => getColumnKey(col) === sortConfig.key);
    const columnTitle = (activeColumn && getColumnTitle(activeColumn)) || 'selected column';
    const directionLabel = sortConfig.direction === 'asc' ? 'ascending' : 'descending';

    return `Sorted by ${columnTitle} in ${directionLabel} order.`;
};
