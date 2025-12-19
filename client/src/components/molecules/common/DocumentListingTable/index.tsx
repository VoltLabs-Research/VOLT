import Popover from '@/components/molecules/common/Popover';
import PopoverMenuItem from '@/components/atoms/common/PopoverMenuItem';
import type { ColumnConfig } from '@/components/organisms/common/DocumentListing';
import EmptyState from '@/components/atoms/common/EmptyState';
import { Skeleton } from '@mui/material';
import { useEffect, useRef, useCallback, useState } from 'react';
import { List, type RowComponentProps } from 'react-window';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';

const ROW_HEIGHT = 64;
const MIN_COLUMN_WIDTH = 180;
const MAX_COLUMN_WIDTH = 280;

// Calculate column width based on header title length
const getColumnWidth = (col: ColumnConfig): number => {
    const titleLength = col.title?.length || 10;
    const calculatedWidth = Math.max(MIN_COLUMN_WIDTH, Math.min(titleLength * 14, MAX_COLUMN_WIDTH));
    return calculatedWidth;
};

type VirtualRowProps = {
    data: any[];
    columns: ColumnConfig[];
    columnWidths: number[];
    totalRowWidth: number;
    getMenuOptions?: (item: any) => any[];
    keyExtractor?: (item: any, index: number) => string | number;
    useFlexDistribution: boolean;
};

const VirtualizedRow = ({ index, style, ...props }: RowComponentProps<VirtualRowProps>) => {
    const { data, columns, columnWidths, totalRowWidth, getMenuOptions, keyExtractor, useFlexDistribution } = props;
    const item = data[index];
    const rowKey = keyExtractor ? keyExtractor(item, index) : `item-${index}`;
    const menuOptions = getMenuOptions ? getMenuOptions(item) : [];

    const rowStyle: React.CSSProperties = {
        ...style,
        width: useFlexDistribution ? '100%' : totalRowWidth,
        display: 'flex',
        alignItems: 'center',
        justifyContent: useFlexDistribution ? 'space-between' : 'flex-start',
        gap: useFlexDistribution ? undefined : '16px'
    };

    const rowContent = (
        <button
            type="button"
            style={rowStyle}
            className='document-listing-table-row-container cursor-pointer'
        >
            {columns.map((col: any, colIdx: number) => (
                <div
                    className='document-listing-cell overflow-hidden d-flex items-center color-primary'
                    data-label={col.title}
                    key={`cell-${col.title}-${colIdx}`}
                    title={String(item?.[col.key] ?? '')}
                    style={useFlexDistribution ? { flex: 1, minWidth: 0 } : {
                        width: columnWidths[colIdx],
                        minWidth: columnWidths[colIdx],
                        maxWidth: columnWidths[colIdx],
                        flexShrink: 0
                    }}
                >
                    <span className='document-listing-cell-value'>
                        {col.render
                            ? col.render(item[col.key], item)
                            : String(item[col.key] ?? '-')}
                    </span>
                </div>
            ))}
        </button>
    );

    if (menuOptions.length > 0) {
        return (
            <Popover id={`row-menu-${rowKey}`} trigger={rowContent}>
                {menuOptions.map((option: any, idx: number) => {
                    if (Array.isArray(option)) {
                        const [label, Icon, onClick] = option;
                        return (
                            <PopoverMenuItem key={idx} icon={<Icon />} onClick={onClick}>
                                {label}
                            </PopoverMenuItem>
                        );
                    }
                    return (
                        <PopoverMenuItem
                            key={idx}
                            icon={option.icon ? <option.icon /> : undefined}
                            onClick={option.onClick}
                            variant={option.destructive ? 'danger' : 'default'}
                        >
                            {option.label}
                        </PopoverMenuItem>
                    );
                })}
            </Popover>
        );
    }

    return rowContent;
};

const SkeletonRow = ({ columns, columnWidths, useFlexDistribution }: { columns: ColumnConfig[], columnWidths?: number[], useFlexDistribution?: boolean }) => {
    return (
        <div
            className='document-listing-table-row-container skeleton-row d-flex'
            style={{
                gap: useFlexDistribution ? undefined : '16px',
                justifyContent: useFlexDistribution ? 'space-between' : 'flex-start'
            }}
        >
            {columns.map((col, colIdx) => (
                <div
                    className='document-listing-cell overflow-hidden d-flex items-center color-primary'
                    data-label={col.title}
                    key={col.key}
                    style={useFlexDistribution ? { flex: 1, minWidth: 0 } : (columnWidths ? {
                        width: columnWidths[colIdx],
                        minWidth: columnWidths[colIdx],
                        flexShrink: 0
                    } : { flex: 1 })}
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
                </div>
            ))}
        </div>
    )
};

type TableRowProps = {
    item: any;
    index: number;
    columns: ColumnConfig[];
    columnWidths: number[];
    totalRowWidth: number;
    getMenuOptions?: (item: any) => any[];
    keyExtractor?: (item: any, index: number) => string | number;
    useFlexDistribution: boolean;
};

const TableRow = ({ item, index, columns, columnWidths, totalRowWidth, getMenuOptions, keyExtractor, useFlexDistribution }: TableRowProps) => {
    const rowKey = keyExtractor ? keyExtractor(item, index) : `item-${index}`;
    const menuOptions = getMenuOptions ? getMenuOptions(item) : [];

    const rowContent = (
        <button
            type="button"
            style={{
                width: useFlexDistribution ? '100%' : totalRowWidth,
                display: 'flex',
                alignItems: 'center',
                justifyContent: useFlexDistribution ? 'space-between' : 'flex-start',
                gap: useFlexDistribution ? undefined : '16px'
            }}
            className='document-listing-table-row-container cursor-pointer'
        >
            {columns.map((col: any, colIdx: number) => (
                <div
                    className='document-listing-cell overflow-hidden d-flex items-center color-primary'
                    data-label={col.title}
                    key={`cell-${col.title}-${colIdx}`}
                    title={String(item?.[col.key] ?? '')}
                    style={useFlexDistribution ? { flex: 1, minWidth: 0 } : {
                        width: columnWidths[colIdx],
                        minWidth: columnWidths[colIdx],
                        maxWidth: columnWidths[colIdx],
                        flexShrink: 0
                    }}
                >
                    <span className='document-listing-cell-value'>
                        {col.render
                            ? col.render(item[col.key], item)
                            : String(item[col.key] ?? '-')}
                    </span>
                </div>
            ))}
        </button>
    );

    if (menuOptions.length > 0) {
        return (
            <Popover id={`row-menu-${rowKey}`} trigger={rowContent}>
                {menuOptions.map((option: any, idx: number) => {
                    if (Array.isArray(option)) {
                        const [label, Icon, onClick] = option;
                        return (
                            <PopoverMenuItem key={idx} icon={<Icon />} onClick={onClick}>
                                {label}
                            </PopoverMenuItem>
                        );
                    }
                    return (
                        <PopoverMenuItem
                            key={idx}
                            icon={option.icon ? <option.icon /> : undefined}
                            onClick={option.onClick}
                            variant={option.destructive ? 'danger' : 'default'}
                        >
                            {option.label}
                        </PopoverMenuItem>
                    );
                })}
            </Popover>
        );
    }

    return rowContent;
};

type InfiniteProps = {
    enableInfinite?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    isFetchingMore?: boolean;
    skeletonRowsCount?: number;
    scrollContainerRef?: React.RefObject<HTMLElement> | null;
    keyExtractor?: (item: any, index: number) => string | number;
    emptyButtonText?: string;
    onEmptyButtonClick?: () => void;
    useVirtualization?: boolean;
    listHeight?: number;
}

const DocumentListingTable = ({
    columns,
    data,
    onCellClick = (_col: any) => { },
    getCellTitle = (col: any) => col.title,
    isLoading = false,
    getMenuOptions = undefined,
    emptyMessage = 'No documents to show.',
    enableInfinite = false,
    hasMore = false,
    onLoadMore,
    isFetchingMore = false,
    skeletonRowsCount = 8,
    scrollContainerRef = null,
    keyExtractor,
    emptyButtonText,
    onEmptyButtonClick,
    useVirtualization = true,
    listHeight = 600
}: any & InfiniteProps) => {
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const lastScrollOffset = useRef(0);
    const [containerWidth, setContainerWidth] = useState(0);

    // Calculate column widths
    const columnWidths = columns.map((col: ColumnConfig) => getColumnWidth(col));
    const totalRowWidth = columnWidths.reduce((sum: number, w: number) => sum + w, 0) + (columns.length - 1) * 16 + 300;

    // Determine if we should use flex distribution (no overflow) or fixed widths with scroll
    const minContentWidth = columnWidths.reduce((sum: number, w: number) => sum + w, 0) + (columns.length - 1) * 16;
    const useFlexDistribution = containerWidth > 0 && containerWidth >= minContentWidth;

    // Measure container width
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });

        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, []);

    // Observe intersection of the sentinel within the provided scroll container (non-virtualized)
    useEffect(() => {
        if (!enableInfinite || useVirtualization) return;
        const root = scrollContainerRef && 'current' in scrollContainerRef ? (scrollContainerRef.current as any) : null;
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting && hasMore && !isFetchingMore) {
                    onLoadMore && onLoadMore();
                }
            },
            { root: root ?? null, rootMargin: '0px 0px 200px 0px', threshold: 0 }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [enableInfinite, hasMore, isFetchingMore, onLoadMore, scrollContainerRef, useVirtualization]);

    // Handle infinite scroll for virtualized list
    const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        if (!enableInfinite || !useVirtualization) return;

        const target = event.target as HTMLElement;
        const scrollOffset = target.scrollTop;
        const totalHeight = data.length * ROW_HEIGHT;
        const visibleHeight = listHeight;
        const scrollThreshold = totalHeight - visibleHeight - 200;

        if (scrollOffset > lastScrollOffset.current && scrollOffset >= scrollThreshold && hasMore && !isFetchingMore) {
            onLoadMore && onLoadMore();
        }
        lastScrollOffset.current = scrollOffset;
    }, [enableInfinite, useVirtualization, data.length, listHeight, hasMore, isFetchingMore, onLoadMore]);

    const isInitialLoading = isLoading && data.length === 0;
    const hasNoData = data.length === 0;
    const shouldShowEmptyState = hasNoData && !isLoading;

    // Determine the actual width to use
    const effectiveWidth = useFlexDistribution ? '100%' : totalRowWidth;

    return (
        <Container className='d-flex column'>
            <div
                ref={containerRef}
                className='document-listing-horizontal-scroll-wrapper'
                style={{
                    width: useFlexDistribution ? '100%' : '100vw',
                    overflowX: useFlexDistribution ? 'hidden' : 'auto',
                    overflowY: 'hidden'
                }}
            >
                {/* Header */}
                {columns.length > 0 && (
                    <div
                        className='document-listing-table-header-container p-sticky d-flex'
                        style={{
                            width: effectiveWidth,
                            gap: useFlexDistribution ? undefined : '16px',
                            justifyContent: useFlexDistribution ? 'space-between' : 'flex-start'
                        }}
                    >
                        {columns.map((col: any, colIdx: number) => (
                            <div
                                className={`document-listing-cell header-cell ${col.sortable ? 'sortable' : ''} overflow-hidden d-flex items-center color-primary`}
                                key={`header-${col.title}-${colIdx}`}
                                onClick={() => onCellClick(col)}
                                style={useFlexDistribution ? { flex: 1, minWidth: 0 } : {
                                    width: columnWidths[colIdx],
                                    minWidth: columnWidths[colIdx],
                                    maxWidth: columnWidths[colIdx],
                                    flexShrink: 0
                                }}
                            >
                                <Title className='font-size-2-5 font-weight-5 text-secondary'>{getCellTitle(col)}</Title>
                            </div>
                        ))}
                    </div>
                )}

                {/* Body */}
                <Container className='d-flex column p-relative document-listing-table-body-container' style={{ minWidth: useFlexDistribution ? undefined : totalRowWidth }}>
                    {!hasNoData && useVirtualization && Array.isArray(data) ? (
                        <div
                            style={{
                                height: listHeight,
                                width: effectiveWidth,
                            }}
                            onScroll={handleScroll}
                        >
                            <List
                                rowCount={data.length}
                                rowHeight={ROW_HEIGHT}
                                rowComponent={VirtualizedRow}
                                rowProps={{
                                    data,
                                    columns,
                                    columnWidths,
                                    totalRowWidth,
                                    getMenuOptions,
                                    keyExtractor,
                                    useFlexDistribution
                                }}
                                style={{ height: listHeight, width: effectiveWidth, overflowX: 'hidden' }}
                            />
                        </div>
                    ) : !hasNoData ? (
                        // Non-virtualized rendering (fallback)
                        <>
                            {data.map((item: any, idx: number) => (
                                <TableRow
                                    key={keyExtractor ? keyExtractor(item, idx) : `item-${idx}`}
                                    item={item}
                                    index={idx}
                                    columns={columns}
                                    columnWidths={columnWidths}
                                    totalRowWidth={totalRowWidth}
                                    getMenuOptions={getMenuOptions}
                                    keyExtractor={keyExtractor}
                                    useFlexDistribution={useFlexDistribution}
                                />
                            ))}
                        </>
                    ) : null}

                    {!hasNoData && enableInfinite && hasMore && isFetchingMore && (
                        Array.from({ length: skeletonRowsCount }).map((_, index) => (
                            <SkeletonRow key={`append-skeleton-${index}`} columns={columns} columnWidths={columnWidths} useFlexDistribution={useFlexDistribution} />
                        ))
                    )}

                    {/* Infinite scroll sentinel (for non-virtualized) */}
                    {enableInfinite && !useVirtualization && <div ref={sentinelRef} style={{ height: 1 }} />}

                    {shouldShowEmptyState && (
                        <div className='document-listing-overlay-blur p-absolute'>
                            <div className='document-listing-empty-content p-absolute'>
                                <EmptyState
                                    title="No Documents"
                                    description={emptyMessage}
                                    buttonText={emptyButtonText}
                                    buttonOnClick={onEmptyButtonClick}
                                    className="document-listing-empty-message"
                                />
                            </div>
                        </div>
                    )}

                    {isInitialLoading && (
                        <div className='document-listing-overlay-blur p-absolute'>
                            <div className='document-listing-infinite-skeleton-loader p-absolute overflow-hidden d-flex column'>
                                {Array.from({ length: 20 }).map((_, index) => (
                                    <SkeletonRow key={`loading-skeleton-${index}`} columns={columns} columnWidths={columnWidths} useFlexDistribution={useFlexDistribution} />
                                ))}
                            </div>
                        </div>
                    )}
                </Container>
            </div>

            <div className='document-listing-table-footer-container' />
        </Container>
    );
};

export default DocumentListingTable;
