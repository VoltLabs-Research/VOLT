import CompactTableRow from '@/modules/plugin/components/listing/PluginCompactTable/CompactTableRow';
import CompactTableSkeleton from '@/modules/plugin/components/listing/PluginCompactTable/CompactTableSkeleton';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { useMedia } from '@/shared/ui/hooks/use-media';
import { ErrorSurface } from '@/shared/contracts/errors';
import { reportError } from '@/shared/errors/core/report-error';
import { getColumnKey, getColumnTitle } from '@/shared/ui/components/DocumentListingTable';
import { getTotalColumnsWidth, MOBILE_COLUMN_WIDTH_SCALE, resolveColumnStyle } from '@/modules/plugin/components/listing/PluginCompactTable/column-layout';
import { inferColumnType, type InferredColumnType } from '@/modules/plugin/components/listing/PluginCompactTable/typeInference';
import { List } from 'react-window';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CompactTableRowProps } from '@/modules/plugin/components/listing/PluginCompactTable/CompactTableRow';
import type { MenuOption } from '@/shared/contracts/menu';
import type { PluginTableColumnConfig } from '@/modules/plugin/components/listing/PluginCompactTable/column-layout';
import type { CSSProperties } from 'react';

export type { PluginTableColumnConfig };

interface PluginCompactTableProps {
    columns: PluginTableColumnConfig[];
    data: Record<string, unknown>[];
    hasMore?: boolean;
    isLoading?: boolean;
    isFetchingMore?: boolean;
    onLoadMore?: () => void;

    error?: unknown;
    rowHeight?: number;
    getMenuOptions?: (row: Record<string, unknown>) => MenuOption[];
    onRowClick?: (row: Record<string, unknown>) => void;
    selectedRowId?: string | null;
}

const DEFAULT_VISIBLE_ROWS = 24;

const TYPE_INFERENCE_SAMPLE_SIZE = 30;

const SCROLL_LOAD_MORE_THRESHOLD_PX = 200;

const compactTableFrameStyle: CSSProperties = {
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'auto',
    overflowY: 'hidden'
};

const compactTableInnerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    height: '100%'
};

const listContainerStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    height: '100%'
};

const listStyle: CSSProperties = {
    height: '100%',
    width: '100%',
    overflowX: 'hidden'
};

const getDisplayErrorMessage = (error: unknown): string => {
    if (typeof error === 'string' && error.length > 0) {
        return error;
    }

    return reportError(error, {
        surface: ErrorSurface.Silent,
        fallbackTitle: 'Failed to load data.'
    }).title;
};

const PluginCompactTable = ({
    columns,
    data,
    hasMore,
    isLoading,
    isFetchingMore,
    onLoadMore,
    error,
    rowHeight = 28,
    getMenuOptions,
    onRowClick,
    selectedRowId
}: PluginCompactTableProps) => {
    const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const lastScrollOffset = useRef(0);
    const isMobile = useMedia('(max-width: 768px)');
    const columnWidthScale = isMobile ? MOBILE_COLUMN_WIDTH_SCALE : 1;

    const inferredColumnTypes = useMemo(() => {
        const result: Record<string, InferredColumnType> = {};

        for(const col of columns){
            if(col.render) continue;
            const key = getColumnKey(col);
            if(!key) continue;
            result[key] = inferColumnType(data.slice(0, TYPE_INFERENCE_SAMPLE_SIZE).map((row) => row[key]));
        }

        return result;
    }, [columns, data]);

    const effectiveWidth = Math.max(getTotalColumnsWidth(columns, columnWidthScale), containerWidth);

    useEffect(() => {
        if(!containerElement) return;

        const measureWidth = () => {
            const { width } = containerElement.getBoundingClientRect();
            if(width > 0){
                setContainerWidth(width);
            }
        };

        const observer = new ResizeObserver(measureWidth);
        observer.observe(containerElement);
        measureWidth();

        return () => {
            observer.disconnect();
        };
    }, [containerElement]);

    const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        if (!hasMore || isLoading || isFetchingMore || !onLoadMore) return;

        const target = event.target as HTMLDivElement;
        const scrollOffset = target.scrollTop;
        const scrollThreshold = (data.length * rowHeight) - target.clientHeight - SCROLL_LOAD_MORE_THRESHOLD_PX;

        if (scrollOffset > lastScrollOffset.current && scrollOffset >= scrollThreshold) {
            onLoadMore();
        }

        lastScrollOffset.current = scrollOffset;
    }, [data.length, hasMore, isLoading, isFetchingMore, onLoadMore, rowHeight]);

    if (isLoading && data.length === 0) {
        return <CompactTableSkeleton rowHeight={rowHeight} />;
    }

    if (error) {
        return (
            <RecoveryState
                title='Unable to load this data'
                description={getDisplayErrorMessage(error)}
                tone={RecoveryStateTone.Error}
                className='min-h-[240px]'
            />
        );
    }

    if (data.length === 0) {
        return (
            <RecoveryState
                title='No data available'
                description='There are no rows to display for this selection.'
                className='min-h-[240px]'
            />
        );
    }

    return (
        <div
            className='flex h-full w-full flex-col overflow-hidden'
            ref={setContainerElement}
            style={compactTableFrameStyle}
        >
            <div style={{
                ...compactTableInnerStyle,
                minWidth: `${effectiveWidth}px`
            }}>
                <div className='sticky top-0 z-10 flex flex-row justify-between border-b border-border pb-1'>
                    {columns.map((col) => (
                        <div
                            key={getColumnKey(col)}
                            className='overflow-hidden whitespace-nowrap text-ellipsis px-2 py-1 text-2xs font-medium text-muted max-[768px]:px-1 max-[768px]:text-2xs'
                            style={resolveColumnStyle(col, columnWidthScale)}
                        >
                            {getColumnTitle(col)}
                        </div>
                    ))}
                </div>
                <div style={listContainerStyle}>
                    <List<CompactTableRowProps>
                        onScroll={handleScroll}
                        defaultHeight={rowHeight * Math.min(Math.max(data.length, 1), DEFAULT_VISIBLE_ROWS)}
                        rowCount={data.length}
                        rowHeight={rowHeight}
                        rowComponent={CompactTableRow}
                        rowProps={{
                            data,
                            columns,
                            getMenuOptions,
                            inferredColumnTypes,
                            onRowClick,
                            selectedRowId: selectedRowId ?? null,
                            columnWidthScale
                        }}
                        style={listStyle}
                    />
                </div>
            </div>
            {isFetchingMore && (
                <div className='border-t border-border p-1 text-center text-xs text-muted'>
                    Loading more...
                </div>
            )}
        </div>
    );
};

export default PluginCompactTable;
