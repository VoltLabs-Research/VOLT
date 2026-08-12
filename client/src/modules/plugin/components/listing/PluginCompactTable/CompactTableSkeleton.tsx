import { Skeleton } from '@heroui/react';
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

const CELL_SKELETON_WIDTHS = ['55%', '70%', '85%'] as const;

const CompactTableSkeleton = ({ rowHeight = 28 }: { rowHeight?: number }) => (
    <div className='flex h-full w-full flex-col overflow-hidden'>
        <div style={skeletonFrameStyle}>
            <div className='sticky top-0 z-10 flex flex-row justify-between border-b border-border pb-1'>
                {SKELETON_COLUMNS.map((index) => (
                    <div
                        key={`skeleton-header-${index}`}
                        className='overflow-hidden whitespace-nowrap text-ellipsis px-2 py-1 text-2xs font-medium text-muted max-[768px]:px-1 max-[768px]:text-2xs'
                        style={skeletonCellStyle}
                    >
                        <Skeleton className='h-[18px] rounded-md' style={{ width: '70%' }} />
                    </div>
                ))}
            </div>
            <div style={skeletonListStyle}>
                {SKELETON_ROWS.map((rowIndex) => (
                    <div
                        key={`skeleton-row-${rowIndex}`}
                        className='flex flex-row justify-between hover:bg-surface-hover'
                        style={{
                            height: rowHeight,
                            width: '100%'
                        }}
                    >
                        {SKELETON_COLUMNS.map((cellIndex) => (
                            <div
                                key={`skeleton-cell-${rowIndex}-${cellIndex}`}
                                className='flex flex-row items-center overflow-hidden whitespace-nowrap text-ellipsis px-2 py-0.5 text-xs text-muted max-[768px]:px-1 max-[768px]:text-2xs'
                                style={skeletonCellStyle}
                            >
                                <Skeleton
                                    className='h-4 rounded-md'
                                    style={{ width: CELL_SKELETON_WIDTHS[(rowIndex + cellIndex) % 3] }}
                                />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export default CompactTableSkeleton;
