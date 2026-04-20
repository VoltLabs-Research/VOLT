import Container from '@/shared/presentation/components/Container';
import { Skeleton } from '@mui/material';
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
        <Container
            className='document-listing-table-row-container skeleton-row d-flex f-shrink-0'
            role='row'
            aria-hidden='true'
            style={{ gap: `${columnGap}px` }}
        >
            {columns.map((col, colIdx) => (
                <Container
                    className='document-listing-cell overflow-hidden d-flex items-center font-size-2 color-secondary'
                    data-label={col.title}
                    key={`${String(col.key ?? col.path ?? col.title ?? colIdx)}-skeleton`}
                    role='gridcell'
                    style={columnStyles?.[colIdx] ?? { flex: 1, minWidth: 0 }}
                >
                    <span className='document-listing-cell-value'>
                        <Skeleton
                            {...(col.skeleton ?? { variant: 'text', width: 100 })}
                            animation='wave'
                            className='document-listing-skeleton-bar'
                            sx={{
                                borderRadius: col.skeleton?.variant === 'rounded' ? '12px' : '4px'
                            }}
                        />
                    </span>
                </Container>
            ))}
        </Container>
    );
};

export default TableSkeletonRow;
