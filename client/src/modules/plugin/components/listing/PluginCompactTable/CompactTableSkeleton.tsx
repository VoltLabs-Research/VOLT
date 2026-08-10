import { Skeleton } from '@heroui/react';
import {
    TABLE_CELL_CLASS,
    TABLE_FRAME_CLASS,
    TABLE_HEADER_CELL_CLASS,
    TABLE_HEADER_CLASS,
    TABLE_ROW_CLASS
} from '@/modules/plugin/components/listing/PluginCompactTable/table-styles';
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

/*
 * bravais's Skeleton took `variant` / `width` / `height` / `animation`; HeroUI's
 * takes `animationType` and is sized entirely by className. `variant='text'` was a
 * pill with the small radius, so the height that used to be a prop is now `h-*` and
 * the radius is `rounded-md` (bravais's 6px `--radius-xs`, spec §3b). `animation`
 * was `wave`, which is HeroUI's default `shimmer`, so it is simply omitted.
 *
 * The staggered per-cell widths stay an inline `style` — a computed percentage is
 * exactly what Tailwind's scanner cannot follow, and it is where bravais's `width`
 * prop put them anyway. Three literals replace the old `55 + n * 15`% arithmetic.
 */
const CELL_SKELETON_WIDTHS = ['55%', '70%', '85%'] as const;

/** Placeholder shown while the first page is in flight. */
const CompactTableSkeleton = ({ rowHeight = 28 }: { rowHeight?: number }) => (
    <div className={TABLE_FRAME_CLASS}>
        <div style={skeletonFrameStyle}>
            <div className={TABLE_HEADER_CLASS}>
                {SKELETON_COLUMNS.map((index) => (
                    <div
                        key={`skeleton-header-${index}`}
                        className={TABLE_HEADER_CELL_CLASS}
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
                        className={TABLE_ROW_CLASS}
                        style={{
                            height: rowHeight,
                            width: '100%'
                        }}
                    >
                        {SKELETON_COLUMNS.map((cellIndex) => (
                            <div
                                key={`skeleton-cell-${rowIndex}-${cellIndex}`}
                                className={TABLE_CELL_CLASS}
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
