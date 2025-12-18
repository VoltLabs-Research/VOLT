import Popover from '@/components/molecules/common/Popover';
import PopoverMenuItem from '@/components/atoms/common/PopoverMenuItem';
import type { ColumnConfig } from '@/components/organisms/common/DocumentListing';
import EmptyState from '@/components/atoms/common/EmptyState';
import { Skeleton } from '@mui/material';
import { useEffect, useRef } from 'react';
import { List, type ListImperativeAPI } from 'react-window';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';

const ROW_HEIGHT = 64;

const SkeletonRow = ({ columns }: { columns: ColumnConfig[] }) => {
    return (
        <div className='document-listing-table-row-container skeleton-row gap-1 d-flex content-between'>
            {columns.map((col) => (
                <div className='document-listing-cell overflow-hidden d-flex flex-1 items-center color-primary' data-label={col.title} key={col.key}>
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

const VirtualizedRow = (props: any) => {
    const { index, style, data, columns, getMenuOptions, keyExtractor } = props;
    const item = data[index];
    const rowKey = keyExtractor ? keyExtractor(item, index) : `item-${index}`;
    const menuOptions = getMenuOptions ? getMenuOptions(item) : [];

    const rowContent = (
        <button
            type="button"
            style={style}
            className='document-listing-table-row-container gap-1 d-flex content-between cursor-pointer w-full'
        >
            {columns.map((col: any, colIdx: number) => (
                <div
                    className='document-listing-cell overflow-hidden d-flex flex-1 items-center color-primary'
                    data-label={col.title}
                    key={`cell-${col.title}-${colIdx}`}
                    title={String(item?.[col.key] ?? '')}
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
    // How many skeleton rows to show when fetching more
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
    const virtualizationListRef = useRef<ListImperativeAPI | null>(null);
    const lastScrollOffset = useRef(0);

    // Observe intersection of the sentinel within the provided scroll container
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
    const handleScroll = (event: any) => {
        if (!enableInfinite || !useVirtualization) return;

        const target = event.target as HTMLElement;
        const scrollOffset = target.scrollTop;
        const totalHeight = data.length * ROW_HEIGHT;
        const visibleHeight = listHeight;
        const scrollThreshold = totalHeight - visibleHeight - 200; // 200px before end

        // Only trigger when scrolling down
        if (scrollOffset > lastScrollOffset.current && scrollOffset >= scrollThreshold && hasMore && !isFetchingMore) {
            onLoadMore && onLoadMore();
        }
        lastScrollOffset.current = scrollOffset;
    };

    const isInitialLoading = isLoading && data.length === 0;
    const hasNoData = data.length === 0;
    const shouldShowEmptyState = hasNoData && !isLoading;

    return (
        <Container className='d-flex column'>
            {columns.length > 0 && (
                <div className='document-listing-table-header-container p-sticky gap-1 d-flex content-between'>
                    {columns.map((col: any, colIdx: number) => (
                        <div
                            className={`document-listing-cell header-cell ${col.sortable ? 'sortable' : ''} overflow-hidden d-flex flex-1 items-center color-primary`}
                            key={`header-${col.title}-${colIdx}`}
                            onClick={() => onCellClick(col)}
                        >
                            <Title className='font-size-2-5 font-weight-5 text-secondary'>{getCellTitle(col)}</Title>
                        </div>
                    ))}
                </div>
            )}

            <Container className='d-flex column p-relative document-listing-table-body-container'>
                {!hasNoData && useVirtualization && Array.isArray(data) ? (
                    <div style={{ height: listHeight, overflow: 'auto' }} onScroll={(e) => handleScroll(e)}>
                        <List
                            listRef={virtualizationListRef}
                            rowCount={data.length}
                            rowHeight={ROW_HEIGHT}
                            rowComponent={VirtualizedRow}
                            rowProps={{
                                data,
                                columns,
                                getMenuOptions,
                                keyExtractor
                            }}
                        />
                    </div>
                ) : !hasNoData ? (
                    // Non-virtualized rendering(fallback)
                    <>
                        {data.map((item: any, idx: number) => {
                            const rowKey = keyExtractor ? keyExtractor(item, idx) : `item-${idx}`;
                            const menuOptions = getMenuOptions ? getMenuOptions(item) : [];

                            const rowContent = (
                                <button type="button" key={rowKey} className='document-listing-table-row-container gap-1 d-flex content-between cursor-pointer w-full'>
                                    {columns.map((col: any, colIdx: number) => (
                                        <div
                                            className='document-listing-cell overflow-hidden d-flex flex-1 items-center color-primary'
                                            data-label={col.title}
                                            key={`cell-${col.title}-${colIdx}`}
                                            title={String(item?.[col.key] ?? '')}
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
                                    <Popover key={rowKey} id={`row-menu-fallback-${rowKey}`} trigger={rowContent}>
                                        {menuOptions.map((option: any, optIdx: number) => {
                                            if (Array.isArray(option)) {
                                                const [label, Icon, onClick] = option;
                                                return (
                                                    <PopoverMenuItem key={optIdx} icon={<Icon />} onClick={onClick}>
                                                        {label}
                                                    </PopoverMenuItem>
                                                );
                                            }
                                            return (
                                                <PopoverMenuItem
                                                    key={optIdx}
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
                        })}
                    </>
                ) : null}

                {!hasNoData && enableInfinite && hasMore && isFetchingMore && (
                    Array.from({ length: skeletonRowsCount }).map((_, index) => (
                        <SkeletonRow key={`append-skeleton-${index}`} columns={columns} />
                    ))
                )}

                {/* Infinite scroll sentinel(for non-virtualized) */}
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
                        {/* Show loading skeleton rows during initial load */}
                        <div className='document-listing-infinite-skeleton-loader p-absolute overflow-hidden d-flex column'>
                            {Array.from({ length: 20 }).map((_, index) => (
                                <SkeletonRow key={`loading-skeleton-${index}`} columns={columns} />
                            ))}
                        </div>
                    </div>
                )}
            </Container>

            <div className='document-listing-table-footer-container' />
        </Container>
    );
};

export default DocumentListingTable;
