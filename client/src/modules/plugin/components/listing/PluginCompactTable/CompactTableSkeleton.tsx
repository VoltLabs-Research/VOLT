import { Box, Skeleton } from '@voltstack/bravais';
import type { CSSProperties } from 'react';

const SKELETON_COLUMNS = [0, 1, 2, 3];
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5, 6, 7];

const skeletonFrameStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    height: '100%'
};

const skeletonListStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    height: '100%',
    overflow: 'hidden'
};

const skeletonCellStyle: CSSProperties = {
    minWidth: '140px',
    flex: '1 1 140px'
};

/** Placeholder shown while the first page is in flight. */
const CompactTableSkeleton = ({ rowHeight = 28 }: { rowHeight?: number }) => (
    <div className='plugin-exposure-table-compact w-full h-full overflow-hidden'>
        <div style={skeletonFrameStyle}>
            <Box position='sticky' className='plugin-compact-table-header'>
                {SKELETON_COLUMNS.map((index) => (
                    <div
                        key={`skeleton-header-${index}`}
                        className='plugin-compact-table-header-cell overflow-hidden font-weight-5'
                        style={skeletonCellStyle}
                    >
                        <Skeleton variant='text' width='70%' height={18} animation='wave' />
                    </div>
                ))}
            </Box>
            <div className='plugin-compact-table-list-container' style={skeletonListStyle}>
                {SKELETON_ROWS.map((rowIndex) => (
                    <div
                        key={`skeleton-row-${rowIndex}`}
                        className='plugin-compact-table-row'
                        style={{
                            height: rowHeight,
                            width: '100%'
                        }}
                    >
                        {SKELETON_COLUMNS.map((cellIndex) => (
                            <div
                                key={`skeleton-cell-${rowIndex}-${cellIndex}`}
                                className='plugin-compact-table-cell overflow-hidden font-size-1'
                                style={skeletonCellStyle}
                            >
                                <Skeleton variant='text' width={`${55 + ((rowIndex + cellIndex) % 3) * 15}%`} height={16} animation='wave' />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export default CompactTableSkeleton;
