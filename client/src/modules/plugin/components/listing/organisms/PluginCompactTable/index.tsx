import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Skeleton } from '@mui/material';
import { List } from 'react-window';
import { getApiErrorMessage } from '@/shared/errors/notify-api-error';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import '@/modules/plugin/components/listing/organisms/PluginExposureTable/PluginExposureTable.css';

export interface ColumnConfig {
    key?: string;
    title?: string;
    path?: string;
    label?: string;
    width?: number;
    render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

const getColumnKey = (col: ColumnConfig): string => String(col.key ?? col.path ?? '');
const getColumnTitle = (col: ColumnConfig): string => String(col.title ?? col.label ?? col.key ?? col.path ?? '');
const getColumnMinWidth = (col: ColumnConfig): number => Number(col.width ?? 120);

const TableRow = ({ index, style, data: rows, columns }: { index: number; style: React.CSSProperties; data: Record<string, unknown>[]; columns: ColumnConfig[] }) => {
    const row = rows[index];
    if (!row) return null;

    return (
        <div style={style} className='plugin-compact-table-row'>
            {columns.map((col) => (
                <div
                    key={getColumnKey(col)}
                    className='plugin-compact-table-cell overflow-hidden font-size-1 color-secondary'
                    style={{
                        minWidth: `${getColumnMinWidth(col)}px`,
                        flex: `1 1 ${getColumnMinWidth(col)}px`
                    }}
                >
                    {col.render ? col.render(row[getColumnKey(col)], row) : row[getColumnKey(col)] as React.ReactNode}
                </div>
            ))}
        </div>
    );
};

interface VirtualizedRowExtraProps {
    data: Record<string, unknown>[];
    columns: ColumnConfig[];
}

const VirtualizedRow = ({ index, style, data, columns }: VirtualizedRowExtraProps & { ariaAttributes: unknown; index: number; style: React.CSSProperties }) => {
    return <TableRow index={index} style={style} data={data} columns={columns} />;
};

interface PluginCompactTableProps {
    columns: ColumnConfig[];
    data: Record<string, unknown>[];
    hasMore?: boolean;
    isLoading?: boolean;
    isFetchingMore?: boolean;
    onLoadMore?: () => void;
    error?: unknown;
    rowHeight?: number;
    onDataReady?: (columns: ColumnConfig[], data: Record<string, unknown>[]) => void;
}

const getDisplayErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return getApiErrorMessage(error, 'Failed to load data.');
    }

    if (typeof error === 'string' && error.length > 0) {
        return error;
    }

    return 'Failed to load data.';
};

const CompactTableSkeleton = ({ rowHeight = 28 }: { rowHeight?: number }) => {
    return (
        <div className='plugin-exposure-table-compact w-full h-full overflow-hidden'>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
                <div className='plugin-compact-table-header p-sticky'>
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div
                            key={`skeleton-header-${index}`}
                            className='plugin-compact-table-header-cell overflow-hidden font-weight-5'
                            style={{ minWidth: '140px', flex: '1 1 140px' }}
                        >
                            <Skeleton variant='text' width='70%' height={18} animation='wave' />
                        </div>
                    ))}
                </div>
                <div className='plugin-compact-table-list-container' style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
                    {Array.from({ length: 8 }).map((_, rowIndex) => (
                        <div
                            key={`skeleton-row-${rowIndex}`}
                            className='plugin-compact-table-row'
                            style={{ height: rowHeight, width: '100%' }}
                        >
                            {Array.from({ length: 4 }).map((__, cellIndex) => (
                                <div
                                    key={`skeleton-cell-${rowIndex}-${cellIndex}`}
                                    className='plugin-compact-table-cell overflow-hidden font-size-1 color-secondary'
                                    style={{ minWidth: '140px', flex: '1 1 140px' }}
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
    onDataReady
}: PluginCompactTableProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const [height, setHeight] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const [isMeasured, setIsMeasured] = useState(false);
    const lastScrollOffset = useRef(0);

    const minimumColumnsWidth = columns.reduce((sum, col) => sum + getColumnMinWidth(col), 0);
    const effectiveWidth = Math.max(minimumColumnsWidth, containerWidth);
    const fallbackHeight = useMemo(() => {
        const visibleRows = Math.min(Math.max(data.length, 1), 6);
        return Math.max(rowHeight * visibleRows, rowHeight * 4);
    }, [data.length, rowHeight]);
    const resolvedHeight = height > 0 ? height : fallbackHeight;

    const updateMeasurements = useCallback(() => {
        const containerRect = containerRef.current?.getBoundingClientRect();
        const listRect = listContainerRef.current?.getBoundingClientRect();

        if (containerRect?.width && containerRect.width > 0) {
            setContainerWidth(containerRect.width);
        }

        if (listRect?.height && listRect.height > 0) {
            setHeight(Math.floor(listRect.height));
            setIsMeasured(true);
            return;
        }

        setIsMeasured(false);
    }, []);

    const scheduleMeasurement = useCallback(() => {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
            animationFrameRef.current = requestAnimationFrame(() => {
                updateMeasurements();
            });
        });
    }, [updateMeasurements]);

    useEffect(() => {
        if (!containerRef.current && !listContainerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            if (!entries.length) return;
            scheduleMeasurement();
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        if (listContainerRef.current) {
            observer.observe(listContainerRef.current);
        }

        scheduleMeasurement();

        return () => {
            observer.disconnect();
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [scheduleMeasurement]);

    useLayoutEffect(() => {
        scheduleMeasurement();
    }, [scheduleMeasurement, columns.length, data.length]);

    useEffect(() => {
        if (onDataReady && columns.length > 0 && data.length > 0) {
            onDataReady(columns, data);
        }
    }, [columns, data, onDataReady]);

    const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        if (!hasMore || isLoading || isFetchingMore || !onLoadMore) return;

        const target = event.target as HTMLDivElement;
        const scrollOffset = target.scrollTop;

        const totalHeight = data.length * rowHeight;
        const scrollThreshold = totalHeight - resolvedHeight - 200;

        if (scrollOffset > lastScrollOffset.current && scrollOffset >= scrollThreshold) {
            onLoadMore();
        }

        lastScrollOffset.current = scrollOffset;
    }, [data.length, hasMore, isLoading, isFetchingMore, onLoadMore, rowHeight, resolvedHeight]);

    if (isLoading && data.length === 0) {
        return <CompactTableSkeleton rowHeight={rowHeight} />;
    }

    if (error) {
        return (
            <RecoveryState
                title='Unable to load this data'
                description={getDisplayErrorMessage(error)}
                tone={RecoveryStateTone.Error}
                className='plugin-exposure-recovery-state'
            />
        );
    }

    if (data.length === 0) {
        return (
            <RecoveryState
                title='No data available'
                description='There are no rows to display for this selection.'
                className='plugin-exposure-recovery-state'
            />
        );
    }

    if (!isMeasured && data.length > 0) {
        return (
            <div
                className='plugin-exposure-table-compact w-full h-full overflow-hidden'
                ref={containerRef}
                style={{
                    height: '100%',
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflowX: 'auto',
                    overflowY: 'hidden'
                }}
            >
                <div style={{ minWidth: `${effectiveWidth}px`, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
                    <div className='plugin-compact-table-header p-sticky'>
                        {columns.map((col) => (
                            <div
                                key={getColumnKey(col)}
                                className='plugin-compact-table-header-cell overflow-hidden font-weight-5'
                                style={{
                                    minWidth: `${getColumnMinWidth(col)}px`,
                                    flex: `1 1 ${getColumnMinWidth(col)}px`
                                }}
                            >
                                {getColumnTitle(col)}
                            </div>
                        ))}
                    </div>
                    <div
                        ref={listContainerRef}
                        className='plugin-compact-table-list-container y-auto'
                        onScroll={handleScroll}
                        style={{
                            flex: 1,
                            height: '100%',
                            minHeight: `${fallbackHeight}px`,
                            overflowY: 'auto',
                            overflowX: 'hidden'
                        }}
                    >
                        {data.map((row, index) => (
                            <TableRow
                                key={String(row.id ?? row._id ?? `${index}`)}
                                index={index}
                                data={data}
                                columns={columns}
                                style={{
                                    position: 'relative',
                                    height: rowHeight,
                                    width: '100%'
                                }}
                            />
                        ))}
                    </div>
                </div>
                {isFetchingMore && (
                    <div className='plugin-exposure-loading' style={{ padding: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        Loading more...
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            className='plugin-exposure-table-compact w-full h-full overflow-hidden'
            ref={containerRef}
            style={{
                height: '100%',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflowX: 'auto',
                overflowY: 'hidden'
            }}
        >
            <div style={{ minWidth: `${effectiveWidth}px`, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
                <div className='plugin-compact-table-header p-sticky'>
                    {columns.map((col) => (
                        <div
                            key={getColumnKey(col)}
                            className='plugin-compact-table-header-cell overflow-hidden font-weight-5'
                            style={{
                                minWidth: `${getColumnMinWidth(col)}px`,
                                flex: `1 1 ${getColumnMinWidth(col)}px`
                            }}
                        >
                            {getColumnTitle(col)}
                        </div>
                    ))}
                </div>
                <div
                    ref={listContainerRef}
                    className='plugin-compact-table-list-container'
                    style={{ flex: 1, minHeight: 0, height: '100%' }}
                >
                    <List<VirtualizedRowExtraProps>
                        onScroll={handleScroll}
                        rowCount={data.length}
                        rowHeight={rowHeight}
                        rowComponent={VirtualizedRow}
                        rowProps={{
                            data,
                            columns
                        }}
                        style={{ height: resolvedHeight, width: '100%', overflowX: 'hidden' }}
                    />
                </div>
            </div>
            {isFetchingMore && (
                <div className='plugin-exposure-loading' style={{ padding: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    Loading more...
                </div>
            )}
        </div>
    );
};

export default PluginCompactTable;
