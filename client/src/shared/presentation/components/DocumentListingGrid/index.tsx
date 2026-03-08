import Container from '@/shared/presentation/components/Container';
import getListingDisplayState from '@/shared/presentation/components/DocumentListing/listing-state';
import EmptyState from '@/shared/presentation/components/EmptyState';
import useInfiniteScroll from '@/shared/presentation/hooks/use-infinite-scroll';
import './DocumentListingGrid.css';
import { FileText } from 'lucide-react';
import { useRef } from 'react';
import React from 'react';

interface DocumentListingGridProps<T extends { _id: string }> {
    data: T[];
    isLoading?: boolean;
    isFetchingMore?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    renderItem: (item: T, index: number) => React.ReactNode;
    renderSkeleton?: () => React.ReactNode;
    emptyIcon?: React.ReactNode;
    emptyTitle?: string;
    emptyMessage?: string;
    emptyButtonText?: string;
    emptyButtonIsLoading?: boolean;
    onEmptyButtonClick?: () => void;
    className?: string;
};

const DocumentListingGrid = <T extends { _id: string },>({
    data,
    isLoading = false,
    isFetchingMore = false,
    hasMore = false,
    onLoadMore,
    renderItem,
    renderSkeleton,
    emptyIcon,
    emptyTitle = 'Nothing here yet',
    emptyMessage = 'No items to display',
    emptyButtonText,
    emptyButtonIsLoading = false,
    onEmptyButtonClick,
    className = ''
}: DocumentListingGridProps<T>) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { sentinelRef } = useInfiniteScroll({
        rootRef: containerRef,
        hasMore,
        isFetchingMore,
        onLoadMore
    });

    const { isInitialLoading, shouldShowEmptyState } = getListingDisplayState(data.length, isLoading);

    return (
        <Container
            ref={containerRef}
            className={`document-listing-grid ${className}`}
        >
            {isInitialLoading && renderSkeleton?.()}

            {shouldShowEmptyState && (
                <Container className='document-listing-grid-empty flex-center'>  
                    <EmptyState
                        icon={emptyIcon ? emptyIcon : <FileText size={26} strokeWidth={1.5} />}
                        title={emptyTitle}
                        description={emptyMessage}
                        buttonText={emptyButtonText}
                        buttonOnClick={onEmptyButtonClick}
                        buttonIsLoading={emptyButtonIsLoading}
                    />
                </Container>
            )}

            {!isInitialLoading && data.map((item, index) => (
                <React.Fragment key={item._id}>
                    {renderItem(item, index)}
                </React.Fragment>
            ))}

            {isFetchingMore && renderSkeleton?.()}

            <Container ref={sentinelRef} style={{ height: 1 }} />
        </Container>
    );
};

export default DocumentListingGrid;
