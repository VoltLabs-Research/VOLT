import Skeleton from '@/shared/presentation/components/Skeleton';
import type { CSSProperties } from 'react';
import type { ColumnConfig } from '../DocumentListingTable';

interface TableSkeletonRowProps<TRow = unknown> {
    columns: ColumnConfig<TRow>[];
    columnStyles?: CSSProperties[];
    columnGap?: number;
};

const TableSkeletonRow = <TRow,>({
    columns,
    columnStyles,
    columnGap = 16
}: TableSkeletonRowProps<TRow>) => {
    return (
        <div className='volt-container document-listing-table-row-container skeleton-row d-flex f-shrink-0' role='row' aria-hidden='true' style={{ gap: `${columnGap}px` }}>
            {columns.map((col, colIdx) => (
                <div className={`volt-container document-listing-cell overflow-hidden d-flex items-center font-size-2 color-secondary ${col.numeric ? 'is-numeric' : ''}`} data-label={col.title} key={`${String(col.key ?? col.path ?? col.title ?? colIdx)}-skeleton`} role='gridcell' style={columnStyles?.[colIdx] ?? { flex: 1, minWidth: 0 }}>
                    <span className='document-listing-cell-value'>
                        <Skeleton
                            {...(col.skeleton ?? { variant: 'text', width: 100 })}
                            animation='wave'
                            className='document-listing-skeleton-bar'
                            style={{
                                borderRadius: col.skeleton?.variant === 'rounded' ? 12 : 4
                            }}
                        />
                    </span>
                </div>
            ))}
        </div>
    );
};

export default TableSkeletonRow;
