import { getColumnKey, getColumnTitle } from '@/shared/ui/components/DocumentListingTable';
import { cn } from '@heroui/react';
import { ChevronUp } from 'lucide-react';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { SortConfig } from '@/shared/utils/sort';
import type { ReactNode } from 'react';

type AriaSort = 'ascending' | 'descending' | 'none';

const isSortedBy = <TRow,>(col: ColumnConfig<TRow>, sortConfig: SortConfig | null): boolean => {
    return Boolean(col.sortable) && sortConfig?.key === getColumnKey(col);
};

// The mockup's chevron: hidden until the column sorts, then up for ascending and turned for
// descending.
export const getColumnSortIndicator = <TRow,>(
    col: ColumnConfig<TRow>,
    sortConfig: SortConfig | null
): ReactNode => {
    if(!col.sortable) return null;

    const isActive = isSortedBy(col, sortConfig);

    return (
        <span
            className={cn(
                'ml-1 inline-grid size-3 shrink-0 place-content-center transition-[transform,opacity] duration-100 ease-out',
                isActive ? 'opacity-100' : 'opacity-0',
                isActive && sortConfig?.direction === 'desc' && 'rotate-180'
            )}
            aria-hidden='true'
        >
            <ChevronUp size={12} strokeWidth={2} />
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
    const columnTitle = (activeColumn && getColumnTitle(activeColumn)) || 'the selected column';
    const directionLabel = sortConfig.direction === 'asc' ? 'ascending' : 'descending';

    return `Sorted by ${columnTitle} in ${directionLabel} order.`;
};
