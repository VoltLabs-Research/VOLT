import getListingDisplayState from '@/shared/presentation/components/DocumentListing/listing-state';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import useInfiniteScroll from '@/shared/presentation/hooks/use-infinite-scroll';
import './DocumentListingGrid.css';
import { FileText } from 'lucide-react';
import { useRef } from 'react';

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
    emptyTitle = 'No items to show',
    emptyMessage = 'Nothing to display here.',
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

    const content = shouldShowContent && data.map((item, index) => (
        <div key={item._id} className='document-listing-grid-item'>
            {renderItem(item, index)}
        </div>
    ));

    return (
        <div ref={containerRef} className={`document-listing-grid ${className}`}>
            {isInitialLoading && renderSkeleton?.()}

            {shouldShowEmptyState && (
                <div className='document-listing-grid-empty flex-center'>
                    <RecoveryState
                        icon={emptyIcon ? emptyIcon : <FileText size={26} strokeWidth={1.5} />}
                        title={emptyTitle}
                        description={emptyMessage}
                        retryLabel={emptyButtonText}
                        isRetrying={emptyButtonIsLoading}
                        onRetry={onEmptyButtonClick}
                    />
                </div>
            )}

            {shouldShowErrorState && (
                <div className='document-listing-grid-empty flex-center'>
                    <RecoveryState
                        title="Couldn't load these items"
                        description={errorMessage ?? 'Try again in a moment.'}
                        tone={RecoveryStateTone.Error}
                        retryLabel={retryButtonText}
                        isRetrying={isLoading}
                        onRetry={onRetry}
                    />
                </div>
            )}

            {shouldShowAccessDeniedState && (
                <div className='document-listing-grid-empty flex-center'>
                    <RecoveryState
                        title='Access denied'
                        description={errorMessage ?? "You don't have permission to view these items."}
                        tone={RecoveryStateTone.AccessDenied}
                    />
                </div>
            )}

            {content}

            {isFetchingMore && renderSkeleton?.()}

            <div ref={sentinelRef} className='document-listing-grid-sentinel' aria-hidden='true' />
        </div>
    );
};

export default DocumentListingGrid;
