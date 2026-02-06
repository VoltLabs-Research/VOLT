import React, { useRef, useEffect } from 'react';
import { FileText } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import './DocumentListingGrid.css';

interface DocumentListingGridProps<T = unknown> {
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

const DocumentListingGrid = <T,>({
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
    const sentinelRef = useRef<HTMLDivElement>(null);
    const hasMountedRef = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            hasMountedRef.current = true;
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const root = containerRef.current;
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry?.isIntersecting && hasMore && !isFetchingMore && hasMountedRef.current) {
                    onLoadMore?.();
                }
            },
            { root, rootMargin: '0px 0px 200px 0px', threshold: 0 }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, isFetchingMore, onLoadMore]);

    const isInitialLoading = isLoading && data.length === 0;
    const shouldShowEmptyState = data.length === 0 && !isLoading;

    return (
        <Container
            ref={containerRef}
            className={`document-listing-grid ${className}`}
        >
            {isInitialLoading && renderSkeleton?.()}

            {shouldShowEmptyState && (
                <Container className='document-listing-grid-empty'>
                    <EmptyState
                        icon={emptyIcon || <FileText size={26} strokeWidth={1.5} />}
                        title={emptyTitle}
                        description={emptyMessage}
                        buttonText={emptyButtonText}
                        buttonOnClick={onEmptyButtonClick}
                        buttonIsLoading={emptyButtonIsLoading}
                    />
                </Container>
            )}

            {!isInitialLoading && data.map((item, index) => (
                <React.Fragment key={index}>
                    {renderItem(item, index)}
                </React.Fragment>
            ))}

            {isFetchingMore && renderSkeleton?.()}

            <Container ref={sentinelRef} style={{ height: 1 }} />
        </Container>
    );
};

export default DocumentListingGrid;
