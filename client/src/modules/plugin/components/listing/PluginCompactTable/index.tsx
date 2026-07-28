import { Box, Skeleton } from '@voltstack/bravais';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { List } from 'react-window';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { cn } from '@/shared/utils/cn';
import type { MenuOption } from '@/shared/contracts/menu';
import { formatUnknownValue } from '@voltstack/bravais';
import { inferColumnType, type InferredColumnType } from '@/modules/plugin/components/listing/PluginCompactTable/typeInference';
import { renderInferredCell } from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers';
import { useMedia } from '@voltstack/bravais';
import '@/modules/plugin/components/listing/PluginExposureTable/PluginExposureTable.css';
import '@/modules/plugin/components/listing/PluginCompactTable/PluginCompactTable.css';
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react';

export interface PluginTableColumnConfig {
    key?: string;
    title?: string;
    path?: string;
    label?: string;
    width?: number;
    render?: (value: unknown, row: Record<string, unknown>) => ReactNode;
}

const getColumnKey = (col: PluginTableColumnConfig): string => String(col.key ?? col.path ?? '');
const getColumnTitle = (col: PluginTableColumnConfig): string => String(col.title ?? col.label ?? col.key ?? col.path ?? '');
const getColumnMinWidth = (col: PluginTableColumnConfig): number => Number(col.width ?? 120);
const MOBILE_COLUMN_WIDTH_SCALE = 0.62;
const MIN_MOBILE_COLUMN_WIDTH = 44;
const getResolvedColumnWidth = (col: PluginTableColumnConfig, widthScale = 1): number => {
    const width = getColumnMinWidth(col);
    if (widthScale === 1) return width;
    return Math.max(MIN_MOBILE_COLUMN_WIDTH, Math.round(width * widthScale));
};
const getColumnFlex = (width: number, widthScale = 1): string => {
    return widthScale === 1 ? `1 1 ${width}px` : `0 0 ${width}px`;
};

interface PluginTableRowProps {
    index: number;
    style: CSSProperties;
    data: Record<string, unknown>[];
    columns: PluginTableColumnConfig[];
    getMenuOptions?: (row: Record<string, unknown>) => MenuOption[];
    rowId?: string;
    inferredColumnTypes?: Record<string, InferredColumnType>;
    onRowClick?: (row: Record<string, unknown>) => void;
    isSelected?: boolean;
    columnWidthScale?: number;
}

const resolveRowIdentifier = (row: Record<string, unknown>, fallback: number): string => {
    const candidate = row._id ?? row.id;
    if(typeof candidate === 'string' || typeof candidate === 'number'){
        return String(candidate);
    }
    return String(fallback);
};

const TableRow = ({ index, style, data: rows, columns, getMenuOptions, rowId, inferredColumnTypes, onRowClick, isSelected, columnWidthScale = 1 }: PluginTableRowProps) => {
    const row = rows[index];
    if (!row) return null;

    const menuOptions = getMenuOptions ? getMenuOptions(row) : [];
    const resolvedId = rowId || resolveRowIdentifier(row, index);
    const isClickable = Boolean(onRowClick);

    const handleClick = isClickable
        ? (event: MouseEvent<HTMLDivElement>) => {
            if(event.defaultPrevented) return;
            onRowClick?.(row);
        }
        : undefined;

    const handleKeyDown = isClickable
        ? (event: KeyboardEvent<HTMLDivElement>) => {
            if(event.key === 'Enter' || event.key === ' '){
                event.preventDefault();
                onRowClick?.(row);
            }
        }
        : undefined;

    const rowClassName = cn(
        'plugin-compact-table-row',
        isClickable ? 'plugin-compact-table-row--interactive' : null,
        isSelected ? 'plugin-compact-table-row--selected' : null
    );

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

                let cellContent: ReactNode;
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

                const columnWidth = getResolvedColumnWidth(col, columnWidthScale);

                return (
                    <div
                        key={columnKey}
                        className='plugin-compact-table-cell overflow-hidden font-size-1'
                        style={{
                            minWidth: `${columnWidth}px`,
                            flex: getColumnFlex(columnWidth, columnWidthScale)
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
    columns: PluginTableColumnConfig[];
    getMenuOptions?: (row: Record<string, unknown>) => MenuOption[];
    inferredColumnTypes?: Record<string, InferredColumnType>;
    onRowClick?: (row: Record<string, unknown>) => void;
    selectedRowId?: string | null;
    columnWidthScale?: number;
}

const VirtualizedRow = ({ index, style, data, columns, getMenuOptions, inferredColumnTypes, onRowClick, selectedRowId, columnWidthScale }: VirtualizedRowExtraProps & { index: number; style: CSSProperties }) => {
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
            columnWidthScale={columnWidthScale}
        />
    );
};

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

const getDisplayErrorMessage = (error: unknown): string => {
    if (typeof error === 'string' && error.length > 0) {
        return error;
    }

    return reportError(error, {
        surface: ErrorSurface.Silent,
        fallbackTitle: 'Failed to load data.'
    }).title;
};

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

const loadingMoreStyle: CSSProperties = {
    padding: '0.25rem',
    borderTop: '1px solid var(--color-border-soft)'
};

const CompactTableHeader = ({ columns, columnWidthScale = 1 }: { columns: PluginTableColumnConfig[]; columnWidthScale?: number }) => (
    <Box position='sticky' className='plugin-compact-table-header'>
        {columns.map((col) => {
            const columnWidth = getResolvedColumnWidth(col, columnWidthScale);

            return (
                <div
                    key={getColumnKey(col)}
                    className='plugin-compact-table-header-cell overflow-hidden font-weight-5'
                    style={{
                        minWidth: `${columnWidth}px`,
                        flex: getColumnFlex(columnWidth, columnWidthScale)
                    }}
                >
                    {getColumnTitle(col)}
                </div>
            );
        })}
    </Box>
);

interface CompactTableFrameProps {
    containerRef: Ref<HTMLDivElement>;
    effectiveWidth: number;
    isFetchingMore?: boolean;
    children: ReactNode;
}

const CompactTableFrame = ({
    containerRef,
    effectiveWidth,
    isFetchingMore,
    children
}: CompactTableFrameProps) => (
    <div
        className='plugin-exposure-table-compact w-full h-full overflow-hidden'
        ref={containerRef}
        style={compactTableFrameStyle}
    >
        <div style={{
            ...compactTableInnerStyle,
            minWidth: `${effectiveWidth}px`
        }}>
            {children}
        </div>
        {isFetchingMore && (
            <div className='plugin-exposure-loading' style={loadingMoreStyle}>
                Loading more...
            </div>
        )}
    </div>
);

const CompactTableSkeleton = ({ rowHeight = 28 }: { rowHeight?: number }) => {
    return (
        <div className='plugin-exposure-table-compact w-full h-full overflow-hidden'>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                height: '100%'
            }}>
                <Box position='sticky' className='plugin-compact-table-header'>
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div
                            key={`skeleton-header-${index}`}
                            className='plugin-compact-table-header-cell overflow-hidden font-weight-5'
                            style={{
                                minWidth: '140px',
                                flex: '1 1 140px'
                            }}
                        >
                            <Skeleton variant='text' width='70%' height={18} animation='wave' />
                        </div>
                    ))}
                </Box>
                <div className='plugin-compact-table-list-container' style={{
                    flex: 1,
                    minHeight: 0,
                    height: '100%',
                    overflow: 'hidden'
                }}>
                    {Array.from({ length: 8 }).map((_, rowIndex) => (
                        <div
                            key={`skeleton-row-${rowIndex}`}
                            className='plugin-compact-table-row'
                            style={{
                                height: rowHeight,
                                width: '100%'
                            }}
                        >
                            {Array.from({ length: 4 }).map((__, cellIndex) => (
                                <div
                                    key={`skeleton-cell-${rowIndex}-${cellIndex}`}
                                    className='plugin-compact-table-cell overflow-hidden font-size-1'
                                    style={{
                                        minWidth: '140px',
                                        flex: '1 1 140px'
                                    }}
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

// Only seeds `react-window`'s first (and SSR) paint: its own ResizeObserver reports
// the real viewport height as soon as the list is laid out.
const DEFAULT_VISIBLE_ROWS = 24;

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

    const minimumColumnsWidth = columns.reduce((sum, col) => sum + getResolvedColumnWidth(col, columnWidthScale), 0);
    const effectiveWidth = Math.max(minimumColumnsWidth, containerWidth);
    const defaultListHeight = rowHeight * Math.min(Math.max(data.length, 1), DEFAULT_VISIBLE_ROWS);

    // `react-window` measures its own height, but it cannot supply this width: the list
    // lives *inside* the horizontal scroll box, so its own width is already
    // `effectiveWidth`. Reading the frame instead keeps `effectiveWidth` from latching
    // onto the content width and never shrinking back.
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

        const totalHeight = data.length * rowHeight;
        const scrollThreshold = totalHeight - target.clientHeight - 200;

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

    return (
        <CompactTableFrame
            containerRef={setContainerElement}
            effectiveWidth={effectiveWidth}
            isFetchingMore={isFetchingMore}
        >
            <CompactTableHeader columns={columns} columnWidthScale={columnWidthScale} />
            <div
                className='plugin-compact-table-list-container'
                style={{
                    flex: 1,
                    minHeight: 0,
                    height: '100%'
                }}
            >
                <List<VirtualizedRowExtraProps>
                    onScroll={handleScroll}
                    defaultHeight={defaultListHeight}
                    rowCount={data.length}
                    rowHeight={rowHeight}
                    rowComponent={VirtualizedRow}
                    rowProps={{
                        data,
                        columns,
                        getMenuOptions,
                        inferredColumnTypes,
                        onRowClick,
                        selectedRowId: selectedRowId ?? null,
                        columnWidthScale
                    }}
                    style={{
                        height: '100%',
                        width: '100%',
                        overflowX: 'hidden'
                    }}
                />
            </div>
        </CompactTableFrame>
    );
};

export default PluginCompactTable;
