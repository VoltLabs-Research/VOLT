import './Table.css';
import { Skeleton } from '@mui/material';

export interface Column<T> {
    key: string;
    header: string;
    render?: (row: T) => React.ReactNode;
    headerClassName?: string;
    cellClassName?: string;
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
};

const Table = <T,>({
    columns,
    data,
    getRowKey,
    isLoading = false,
    skeletonRows = 5,
    onRowClick,
    rowClassName,
    className = ''
}: TableProps<T>) => {
    const getRowClass = (row: T): string => {
        const base = onRowClick ? 'clickable' : '';
        if(!rowClassName) return base;
        if(typeof rowClassName === 'string') return `${base} ${rowClassName}`;
        return `${base} ${rowClassName(row)}`;
    };

    const renderSkeletonRows = () => (
        Array.from({ length: skeletonRows }).map((_, i) => (
            <tr key={`skeleton-${i}`}>
                {columns.map((col) => (
                    <td key={col.key}>
                        <Skeleton variant='text' width='70%' height={20} animation='wave' />
                    </td>
                ))}
            </tr>
        ))
    );

    const renderCell = (row: T, col: Column<T>) => {
        if(col.render) return col.render(row);
        return (row as Record<string, unknown>)[col.key] as React.ReactNode;
    };

    return (
        <table className={`table ${className}`}>
            <thead>
                <tr>
                    {columns.map((col) => (
                        <th key={col.key} className={col.headerClassName}>
                            {col.header}
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
    );
};

export default Table;
