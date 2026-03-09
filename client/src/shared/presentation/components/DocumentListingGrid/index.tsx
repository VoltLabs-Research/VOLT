import Container from '@/shared/presentation/components/Container';
import getListingDisplayState from '@/shared/presentation/components/DocumentListing/listing-state';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
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
    errorMessage?: string | null;
    isAccessDenied?: boolean;
    onRetry?: () => void;
    retryButtonText?: string;
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
    className = '',
    errorMessage,
    isAccessDenied = false,
    onRetry,
    retryButtonText
}: DocumentListingGridProps<T>) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { sentinelRef } = useInfiniteScroll({
        rootRef: containerRef,
        hasMore,
        isFetchingMore,
        onLoadMore
    });

    const {
        isInitialLoading,
        shouldShowContent,
        shouldShowEmptyState,
        shouldShowErrorState,
        shouldShowAccessDeniedState
    } = getListingDisplayState({
        dataLength: data.length,
        isLoading,
        errorMessage,
        isAccessDenied
    });

    return (
        <Container
            ref={containerRef}
            className={`document-listing-grid ${className}`}
        >
            {isInitialLoading && renderSkeleton?.()}

            {shouldShowEmptyState && (
                <Container className='document-listing-grid-empty flex-center'>  
                    <RecoveryState
                        icon={emptyIcon ? emptyIcon : <FileText size={26} strokeWidth={1.5} />}
                        title={emptyTitle}
                        description={emptyMessage}
                        retryLabel={emptyButtonText}
                        isRetrying={emptyButtonIsLoading}
                        onRetry={onEmptyButtonClick}
                    />
                </Container>
            )}

            {shouldShowErrorState && (
                <Container className='document-listing-grid-empty flex-center'>
                    <RecoveryState
                        title='Unable to load these items'
                        description={errorMessage ?? 'Something went wrong while loading this content.'}
                        tone={RecoveryStateTone.Error}
                        retryLabel={retryButtonText}
                        isRetrying={isLoading}
                        onRetry={onRetry}
                    />
                </Container>
            )}

            {shouldShowAccessDeniedState && (
                <Container className='document-listing-grid-empty flex-center'>
                    <RecoveryState
                        title='Access denied'
                        description={errorMessage ?? 'You do not have permission to view these items.'}
                        tone={RecoveryStateTone.AccessDenied}
                    />
                </Container>
            )}

            {shouldShowContent && data.map((item, index) => (
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
