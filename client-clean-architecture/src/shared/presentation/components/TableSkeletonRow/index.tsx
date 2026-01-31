import { Skeleton } from '@mui/material';
import Container from '@/shared/presentation/components/Container';
import type { ColumnConfig } from '../DocumentListingTable';

interface TableSkeletonRowProps {
    columns: ColumnConfig[];
    columnWidths?: number[];
    useFlexDistribution?: boolean;
    columnGap?: number;
};

const TableSkeletonRow: React.FC<TableSkeletonRowProps> = ({ 
    columns, 
    columnWidths, 
    useFlexDistribution = false,
    columnGap = 16
}) => {
    return (
        <Container
            className='document-listing-table-row-container skeleton-row d-flex f-shrink-0'
            style={{
                gap: useFlexDistribution ? undefined : `${columnGap}px`,
                justifyContent: useFlexDistribution ? 'space-between' : 'flex-start'
            }}
        >
            {columns.map((col, colIdx) => (
                <Container
                    className='document-listing-cell overflow-hidden d-flex items-center color-primary'
                    data-label={col.title}
                    key={col.key}
                    style={
                        useFlexDistribution
                            ? { flex: 1, minWidth: 0 }
                            : columnWidths
                                ? { width: columnWidths[colIdx], minWidth: columnWidths[colIdx], flexShrink: 0 }
                                : { flex: 1 }
                    }
                >
                    <span className='document-listing-cell-value'>
                        <Skeleton
                            {...(col.skeleton ?? { variant: 'text', width: 100 })}
                            animation='wave'
                            sx={{ 
                                bgcolor: 'rgba(0, 0, 0, 0.06)', 
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
