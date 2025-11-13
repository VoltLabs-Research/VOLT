import ActionBasedFloatingContainer from '@/components/organisms/ActionBasedFloatingContainer';
import type { ColumnConfig } from '@/components/organisms/DocumentListing';
import { Skeleton } from '@mui/material';
import { useEffect, useRef } from 'react';

const SkeletonRow = ({ columns }: { columns: ColumnConfig[] }) => {
    return (
        <div className='document-listing-table-row-container skeleton-row'>
            {columns.map((col) => (
                <div className='document-listing-cell' data-label={col.title} key={col.key}>
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

type InfiniteProps = {
  enableInfinite?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isFetchingMore?: boolean;
    // How many skeleton rows to show when fetching more
    skeletonRowsCount?: number;
  scrollContainerRef?: React.RefObject<HTMLElement> | null;
  keyExtractor?: (item: any, index: number) => string | number;
}

const DocumentListingTable = ({
    columns, 
    data,
    onCellClick = (_col: any) => {},
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
    keyExtractor
}: any & InfiniteProps) => {
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    // Observe intersection of the sentinel within the provided scroll container
    useEffect(() => {
        if (!enableInfinite) return;
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
    }, [enableInfinite, hasMore, isFetchingMore, onLoadMore, scrollContainerRef]);

    const isInitialLoading = isLoading && data.length === 0;
    const hasNoData = data.length === 0;

    return (
        <div className='document-listing-table-container'>
            {columns.length > 0 && (
                <div className='document-listing-table-header-container'>
                    {columns.map((col: any, colIdx: number) => (
                        <div
                            className={`document-listing-cell header-cell ${col.sortable ? 'sortable' : ''}`}
                            key={`header-${col.title}-${colIdx}`} 
                            onClick={() => onCellClick(col)}
                        >
                            <h4 className='document-listing-cell-title'>
                                {getCellTitle(col)}
                            </h4>
                        </div>
                    ))}
                </div>
            )}

            <div className='document-listing-table-body-container'>
                {!hasNoData && data.map((item: any, idx: number) => {
                    const rowKey = keyExtractor ? keyExtractor(item, idx) : `item-${idx}`;
                    return (
                    <ActionBasedFloatingContainer
                        key={rowKey}
                        options={getMenuOptions ? getMenuOptions(item) : []}
                        className='document-listing-table-row-container'
                        useCursorPosition={true}
                        deleteMenuStyle={true}
                    >
                        {columns.map((col: any, colIdx: number) => (
                            <div
                                className='document-listing-cell'
                                data-label={col.title}
                                key={`cell-${col.title}-${colIdx}`}
                                title={String(item?.[col.key] ?? '')}
                            >
                                <span className='document-listing-cell-value'>  
                                    {col.render
                                        ? col.render(item[col.key], item)
                                        : String(item[col.key] ?? '—')}
                                </span>
                            </div>
                        ))}
                    </ActionBasedFloatingContainer>
                    );
                })}

                {!hasNoData && enableInfinite && hasMore && isFetchingMore && (
                    Array.from({ length: skeletonRowsCount }).map((_, index) => (
                        <SkeletonRow key={`append-skeleton-${index}`} columns={columns} />
                    ))
                )}

                {/* Infinite scroll sentinel */}
                {enableInfinite && <div ref={sentinelRef} style={{ height: 1 }} />}

                {hasNoData && (
                    <div className='document-listing-overlay-blur'>
                        {/* Infinite skeleton loader background */}
                        <div className='document-listing-infinite-skeleton-loader'>
                            {Array.from({ length: 20 }).map((_, index) => (
                                <SkeletonRow key={`infinite-skeleton-${index}`} columns={columns} />
                            ))}
                        </div>

                        {/* Empty message overlay */}
                        <div className='document-listing-empty-content document-listing-empty-message'>
                            <h3 className='document-listing-empty-title'>No Documents</h3>
                            <p className='document-listing-empty-description'>{emptyMessage}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className='document-listing-table-footer-container' />
        </div>
    );
};

export default DocumentListingTable;