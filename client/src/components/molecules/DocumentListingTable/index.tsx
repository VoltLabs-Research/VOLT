import ActionBasedFloatingContainer from '@/components/organisms/ActionBasedFloatingContainer';
import type { ColumnConfig } from '@/components/organisms/DocumentListing';
import { Skeleton } from '@mui/material';
import { useEffect, useRef } from 'react';

const SkeletonRow = ({ columns }: { columns: ColumnConfig[] }) => {
    return (
        <div className='document-listing-table-row-container skeleton-row'>
            {columns.map((col) => (
                <div className='document-listing-cell' key={col.key}>
                    <Skeleton
                        {...(col.skeleton ?? { variant: 'text', width: 100 })}
                        animation='wave'
                        sx={{
                            bgcolor: 'rgba(0, 0, 0, 0.06)',
                            borderRadius: col.skeleton?.variant === 'rounded' ? '12px' : '4px'
                        }}
                    />
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
    scrollContainerRef = null
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

    const isInitialLoading = !!isLoading && (Array.isArray(data) ? data.length === 0 : true);

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
                {isInitialLoading ? (
                    Array.from({ length: 16 }).map((_, index) => (
                        <SkeletonRow key={`skeleton-${index}`} columns={columns} />
                    )) 
                ) : data.length === 0 ? (
                    <div className='document-listing-empty'>
                        <p>{emptyMessage}</p>
                    </div>
                ) : (
                    <>
                        {data.map((item: any, idx: number) => (
                            <ActionBasedFloatingContainer
                                key={'item-' + idx}
                                options={getMenuOptions ? getMenuOptions(item) : []}
                                className='document-listing-table-row-container'
                                useCursorPosition={true}
                                deleteMenuStyle={true}
                            >
                                {columns.map((col: any, colIdx: number) => (
                                    <div
                                        className='document-listing-cell'
                                        key={`cell-${col.title}-${colIdx}`}
                                        title={String(item?.[col.key] ?? '')}
                                    >
                                        {col.render
                                            ? col.render(item[col.key], item)
                                            : String(item[col.key] ?? '—')}
                                    </div>    
                                ))}
                            </ActionBasedFloatingContainer>
                        ))}
                        {enableInfinite && hasMore && (isFetchingMore || (isLoading && data.length > 0)) && (
                            Array.from({ length: skeletonRowsCount }).map((_, index) => (
                                <SkeletonRow key={`append-skeleton-${index}`} columns={columns} />
                            ))
                        )}
                    </>
                )}
                {/* Infinite scroll sentinel */}
                {enableInfinite && <div ref={sentinelRef} style={{ height: 1 }} />}
            </div>

            <div className='document-listing-table-footer-container' />
        </div>
    );
};

export default DocumentListingTable;