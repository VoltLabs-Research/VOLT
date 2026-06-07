import './Table.css';
import Skeleton from '../Skeleton';
import { forwardRef, useCallback } from 'react';
import { formatUnknownValue } from '@/shared/utils/format';
import type { Ref } from 'react';

export enum TableSortDirection {
    Ascending = 'ascending',
    Descending = 'descending',
    None = 'none'
};

export interface Column<T> {
    key: string;
    header: string;
    render?: (row: T) => React.ReactNode;
    headerClassName?: string;
    cellClassName?: string;
    sortable?: boolean;
};

interface TableProps<T> {
    columns: Column<T>[];
    data: T[];
    getRowKey: (row: T, index: number) => string | number;
    isLoading?: boolean;
    skeletonRows?: number;
    onRowClick?: (row: T) => void;
    rowClassName?: string | ((row: T) => string);
    className?: string;
    getAriaSort?: (column: Column<T>) => TableSortDirection;
    onSort?: (column: Column<T>) => void;
    caption?: string;
};

const TableImpl = <T,>(
    {
        columns,
        data,
        getRowKey,
        isLoading = false,
        skeletonRows = 5,
        onRowClick,
        rowClassName,
        className = '',
        getAriaSort = () => TableSortDirection.None,
        onSort,
        caption
    }: TableProps<T>,
    ref: Ref<HTMLDivElement>
) => {
    const getRowClass = useCallback((row: T): string => {
        const base = onRowClick ? 'clickable' : '';
        if (!rowClassName) return base;
        if (typeof rowClassName === 'string') return `${base} ${rowClassName}`;
        return `${base} ${rowClassName(row)}`;
    }, [onRowClick, rowClassName]);

    const renderSkeletonRows = () => (
        Array.from({ length: skeletonRows }).map((_, i) => (
            <tr key={`skeleton-${i}`} aria-hidden='true'>
                {columns.map((col) => (
                    <td key={col.key}>
                        <Skeleton variant='text' width='70%' height={20} animation='wave' />
                    </td>
                ))}
            </tr>
        ))
    );

    const renderCell = (row: T, col: Column<T>) => {
        if (col.render) return col.render(row);
        return formatUnknownValue((row as Record<string, unknown>)[col.key]);
    };

    const renderHeaderCell = (col: Column<T>) => {
        if (!col.sortable || !onSort) {
            return col.header;
        }

        return (
            <button
                type='button'
                className='table-sort-button'
                onClick={() => onSort(col)}
                aria-label={`Sort by ${col.header}`}
            >
                {col.header}
            </button>
        );
    };

    return (
        <div ref={ref} className='table-scroll-wrapper'>
            <table className={`table ${className}`}>
                {caption && <caption className='table-caption'>{caption}</caption>}
                <thead>
                    <tr>
                        {columns.map((col) => (
                            <th key={col.key} scope='col' className={col.headerClassName} aria-sort={getAriaSort(col)}>
                                {renderHeaderCell(col)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {isLoading ? renderSkeletonRows() : (
                        data.map((row, index) => (
                            <tr
                                key={getRowKey(row, index)}
                                className={getRowClass(row)}
                                onClick={onRowClick ? () => onRowClick(row) : undefined}
                            >
                                {columns.map((col) => (
                                    <td key={col.key} className={col.cellClassName}>
                                        {renderCell(row, col)}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

const Table = forwardRef(TableImpl) as (<T>(
    props: TableProps<T> & { ref?: Ref<HTMLDivElement> }
) => ReturnType<typeof TableImpl>) & { displayName?: string };

Table.displayName = 'Table';

export default Table;
