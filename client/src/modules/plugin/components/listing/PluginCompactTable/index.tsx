import Skeleton from '@/shared/presentation/primitives/Skeleton';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { List } from 'react-window';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import ContextMenuPopover from '@/shared/presentation/primitives/ContextMenuPopover';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import type { MenuOption } from '@/shared/presentation/types/menu';
import { formatUnknownValue } from '@/shared/utils/format';
import { inferColumnType, type InferredColumnType } from '@/modules/plugin/components/listing/PluginCompactTable/typeInference';
import { renderInferredCell } from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers';
import '@/modules/plugin/components/listing/PluginExposureTable/PluginExposureTable.css';
import '@/modules/plugin/components/listing/PluginCompactTable/PluginCompactTable.css';

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

interface TableRowProps {
    index: number;
    style: React.CSSProperties;
    data: Record<string, unknown>[];
    columns: ColumnConfig[];
    getMenuOptions?: (row: Record<string, unknown>) => MenuOption[];
    rowId?: string;
    inferredColumnTypes?: Record<string, InferredColumnType>;
    onRowClick?: (row: Record<string, unknown>) => void;
    isSelected?: boolean;
};

const resolveRowIdentifier = (row: Record<string, unknown>, fallback: number): string => {
    const candidate = row._id ?? row.id;
    if(typeof candidate === 'string' || typeof candidate === 'number'){
        return String(candidate);
    }
    return String(fallback);
};

const TableRow = ({ index, style, data: rows, columns, getMenuOptions, rowId, inferredColumnTypes, onRowClick, isSelected }: TableRowProps) => {
    const row = rows[index];
    if (!row) return null;

    const menuOptions = getMenuOptions ? getMenuOptions(row) : [];
    const resolvedId = rowId || resolveRowIdentifier(row, index);
    const isClickable = Boolean(onRowClick);

    const handleClick = isClickable
        ? (event: React.MouseEvent<HTMLDivElement>) => {
            if(event.defaultPrevented) return;
            onRowClick?.(row);
        }
        : undefined;

    const handleKeyDown = isClickable
        ? (event: React.KeyboardEvent<HTMLDivElement>) => {
            if(event.key === 'Enter' || event.key === ' '){
                event.preventDefault();
                onRowClick?.(row);
            }
        }
        : undefined;

    const rowClassName = [
        'plugin-compact-table-row',
        isClickable ? 'plugin-compact-table-row--interactive' : null,
        isSelected ? 'plugin-compact-table-row--selected' : null
    ].filter(Boolean).join(' ');

    const content = (
        <div
            style={style}
            className={rowClassName}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            aria-pressed={isClickable ? isSelected : undefined}
        >
            {columns.map((col) => {
                const columnKey = getColumnKey(col);
                const rawValue = row[columnKey];
                const inferred = inferredColumnTypes?.[columnKey];

                let cellContent: React.ReactNode;
                let titleAttribute: string | undefined;

                if(col.render){
                    cellContent = col.render(rawValue, row);
                }else if(inferred){
                    cellContent = renderInferredCell(rawValue, inferred);
                }else{
                    const fallbackValue = formatUnknownValue(rawValue);
                    cellContent = fallbackValue;
                    titleAttribute = fallbackValue;
                }

                return (
                    <div
                        key={columnKey}
                        className='plugin-compact-table-cell overflow-hidden font-size-1 color-secondary'
                        style={{
                            minWidth: `${getColumnMinWidth(col)}px`,
                            flex: `1 1 ${getColumnMinWidth(col)}px`
                        }}
                        title={titleAttribute}
                    >
                        {cellContent}
                    </div>
                );
            })}
        </div>
    );

    if (menuOptions.length === 0) return content;

    return (
        <ContextMenuPopover
            id={`compact-row-menu-${resolvedId}`}
            trigger={content}
            options={menuOptions}
        />
    );
};

interface VirtualizedRowExtraProps {
    data: Record<string, unknown>[];
    columns: ColumnConfig[];
    getMenuOptions?: (row: Record<string, unknown>) => MenuOption[];
    inferredColumnTypes?: Record<string, InferredColumnType>;
    onRowClick?: (row: Record<string, unknown>) => void;
    selectedRowId?: string | null;
}

const VirtualizedRow = ({ index, style, data, columns, getMenuOptions, inferredColumnTypes, onRowClick, selectedRowId }: VirtualizedRowExtraProps & { index: number; style: React.CSSProperties }) => {
    const row = data[index];
    const rowId = row ? resolveRowIdentifier(row, index) : undefined;
    const isSelected = Boolean(selectedRowId && rowId === selectedRowId);
    return (
        <TableRow
            index={index}
            style={style}
            data={data}
            columns={columns}
            getMenuOptions={getMenuOptions}
            inferredColumnTypes={inferredColumnTypes}
            onRowClick={onRowClick}
            rowId={rowId}
            isSelected={isSelected}
        />
    );
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
    getMenuOptions?: (row: Record<string, unknown>) => MenuOption[];
    onRowClick?: (row: Record<string, unknown>) => void;
    selectedRowId?: string | null;
}

const getDisplayErrorMessage = (error: unknown): string => {
    if (typeof error === 'string' && error.length > 0) {
        return error;
    }

    return reportError(error, {
        surface: ErrorSurface.Silent,
        fallbackTitle: 'Failed to load data.'
    }).title;
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
    getMenuOptions,
    onRowClick,
    selectedRowId
}: PluginCompactTableProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const [height, setHeight] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const [isMeasured, setIsMeasured] = useState(false);
    const lastScrollOffset = useRef(0);

    const inferredColumnTypes = useMemo(() => {
        const result: Record<string, InferredColumnType> = {};
        const autoColumns = columns.filter((col) => !col.render);
        if(autoColumns.length === 0) return result;

        for(const col of autoColumns){
            const key = getColumnKey(col);
            if(!key) continue;
            const samples = data.slice(0, 30).map((row) => row[key]);
            result[key] = inferColumnType(samples);
        }
        return result;
    }, [columns, data]);

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
                        {data.map((row, index) => {
                            const rowId = resolveRowIdentifier(row, index);
                            return (
                                <TableRow
                                    key={String(row.id ?? row._id ?? `${index}`)}
                                    index={index}
                                    data={data}
                                    columns={columns}
                                    getMenuOptions={getMenuOptions}
                                    rowId={rowId}
                                    inferredColumnTypes={inferredColumnTypes}
                                    onRowClick={onRowClick}
                                    isSelected={Boolean(selectedRowId && rowId === selectedRowId)}
                                    style={{
                                        position: 'relative',
                                        height: rowHeight,
                                        width: '100%'
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
                {isFetchingMore && (
                    <div className='plugin-exposure-loading' style={{ padding: '0.25rem', borderTop: '1px solid var(--color-border-soft)' }}>
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
                            columns,
                            getMenuOptions,
                            inferredColumnTypes,
                            onRowClick,
                            selectedRowId: selectedRowId ?? null
                        }}
                        style={{ height: resolvedHeight, width: '100%', overflowX: 'hidden' }}
                    />
                </div>
            </div>
            {isFetchingMore && (
                <div className='plugin-exposure-loading' style={{ padding: '0.25rem', borderTop: '1px solid var(--color-border-soft)' }}>
                    Loading more...
                </div>
            )}
        </div>
    );
};

export default PluginCompactTable;
