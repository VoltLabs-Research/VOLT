import Container from '@/shared/presentation/components/Container';
import DocumentListingGridItem from '@/shared/presentation/components/DocumentListingGridItem';
import type { DocumentListingDragAndDropConfig } from '@/shared/presentation/components/DocumentListing/drag-and-drop';
import getListingDisplayState from '@/shared/presentation/components/DocumentListing/listing-state';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import useInfiniteScroll from '@/shared/presentation/hooks/use-infinite-scroll';
import './DocumentListingGrid.css';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { FileText } from 'lucide-react';
import { useCallback, useMemo, useRef } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';

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
    dragAndDrop?: DocumentListingDragAndDropConfig<T>;
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
    dragAndDrop,
    errorMessage,
    isAccessDenied = false,
    onRetry,
    retryButtonText
}: DocumentListingGridProps<T>) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: dragAndDrop?.activationDistance ?? 6
            }
        })
    );
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

    const draggableIdsByItemId = useMemo(() => {
        const nextMap = new Map<string, string>();
        if (!dragAndDrop) {
            return nextMap;
        }

        data.forEach((item) => {
            const draggableId = dragAndDrop.getDraggableId(item);
            if (draggableId) {
                nextMap.set(item._id, draggableId);
            }
        });

        return nextMap;
    }, [data, dragAndDrop]);

    const droppableIdsByItemId = useMemo(() => {
        const nextMap = new Map<string, string>();
        if (!dragAndDrop) {
            return nextMap;
        }

        data.forEach((item) => {
            const droppableId = dragAndDrop.getDroppableId(item);
            if (droppableId) {
                nextMap.set(item._id, droppableId);
            }
        });

        return nextMap;
    }, [data, dragAndDrop]);

    const draggableItemsById = useMemo(() => {
        const nextMap = new Map<string, T>();
        if (!dragAndDrop) {
            return nextMap;
        }

        data.forEach((item) => {
            const draggableId = dragAndDrop.getDraggableId(item);
            if (draggableId) {
                nextMap.set(draggableId, item);
            }
        });

        return nextMap;
    }, [data, dragAndDrop]);

    const droppableItemsById = useMemo(() => {
        const nextMap = new Map<string, T>();
        if (!dragAndDrop) {
            return nextMap;
        }

        data.forEach((item) => {
            const droppableId = dragAndDrop.getDroppableId(item);
            if (droppableId) {
                nextMap.set(droppableId, item);
            }
        });

        return nextMap;
    }, [data, dragAndDrop]);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        if (!dragAndDrop) {
            return;
        }

        const activeId = String(event.active.id);
        const overId = event.over ? String(event.over.id) : null;

        await dragAndDrop.onDragEnd({
            event,
            activeId,
            overId,
            activeItem: draggableItemsById.get(activeId) ?? null,
            overItem: overId ? droppableItemsById.get(overId) ?? null : null
        });
    }, [dragAndDrop, draggableItemsById, droppableItemsById]);

    const content = shouldShowContent && data.map((item, index) => (
        <DocumentListingGridItem
            key={item._id}
            itemId={item._id}
            draggableId={draggableIdsByItemId.get(item._id) ?? null}
            droppableId={droppableIdsByItemId.get(item._id) ?? null}
        >
            {renderItem(item, index)}
        </DocumentListingGridItem>
    ));

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

            {dragAndDrop ? (
                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                    {content}
                </DndContext>
            ) : content}

            {isFetchingMore && renderSkeleton?.()}

            <Container ref={sentinelRef} style={{ height: 1 }} />
        </Container>
    );
};

export default DocumentListingGrid;
