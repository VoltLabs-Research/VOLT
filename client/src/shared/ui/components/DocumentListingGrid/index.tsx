import getListingDisplayState from '@/shared/ui/components/DocumentListing/listing-state';
import GridItem from '@/shared/ui/components/DocumentListingGrid/GridItem';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import Scrollable from '@/shared/ui/components/Scrollable';
import useListingDragAndDrop from '@/shared/ui/components/DocumentListing/use-listing-drag-and-drop';
import { useInfiniteScroll } from '@/shared/ui/hooks/use-infinite-scroll';
import { cn } from '@heroui/react';
import { DndContext, DragOverlay, pointerWithin, rectIntersection } from '@dnd-kit/core';
import { FileText, GripVertical } from 'lucide-react';
import { useRef, useState } from 'react';
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { DocumentListingDragAndDropConfig } from '@/shared/ui/components/DocumentListing/drag-and-drop';
import type { Identifiable } from '@/shared/contracts/entity';
import type { MenuOption } from '@/shared/contracts/menu';
import type { ReactNode } from 'react';

const DRAG_ACTIVATION_DISTANCE = 8;




interface DocumentListingGridProps<T extends Identifiable> {
    data: T[];
    isLoading?: boolean;
    isFetchingMore?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    renderItem: (item: T, index: number) => ReactNode;
    renderSkeleton?: () => ReactNode;
    emptyIcon?: ReactNode;
    emptyTitle?: string;
    emptyMessage?: string;
    emptyButtonText?: string;
    emptyButtonIsLoading?: boolean;
    onEmptyButtonClick?: () => void;
    beforeContent?: ReactNode;
    getMenuOptions?: (item: T, selectedItems: T[]) => MenuOption[];
    dragAndDrop?: DocumentListingDragAndDropConfig<T>;
    className?: string;
    errorMessage?: string | null;
    isAccessDenied?: boolean;
    onRetry?: () => void;
    retryButtonText?: string;
};

const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);

    return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
};

const getGridItemTitle = (item: { _id: string }): string => {
    const record = item as Record<string, unknown>;
    const value = record.name ?? record.title;

    return typeof value === 'string' && value.trim().length > 0 ? value : 'Item';
};

const DocumentListingGrid = <T extends Identifiable,>({
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
    beforeContent,
    getMenuOptions,
    dragAndDrop,
    className = '',
    errorMessage,
    isAccessDenied = false,
    onRetry,
    retryButtonText
}: DocumentListingGridProps<T>) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const suppressNextClickRef = useRef(false);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const {
        sensors,
        draggableIdByItemId,
        droppableIdByItemId,
        getDraggableItem,
        dispatchDragEnd
    } = useListingDragAndDrop(data, dragAndDrop, DRAG_ACTIVATION_DISTANCE);
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

    const activeDragItem = activeDragId ? getDraggableItem(activeDragId) : null;
    const showDragAffordance = dragAndDrop?.showDragAffordance ?? true;

    const handleDragStart = (event: DragStartEvent) => {
        suppressNextClickRef.current = true;
        setActiveDragId(String(event.active.id));
    };

    const handleDragCancel = () => {
        suppressNextClickRef.current = true;
        setActiveDragId(null);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        suppressNextClickRef.current = true;
        setActiveDragId(null);

        await dispatchDragEnd(event);

        window.setTimeout(() => {
            suppressNextClickRef.current = false;
        }, 0);
    };

    const grid = (
        <Scrollable ref={containerRef} className={cn('document-listing-grid grid flex-1 auto-rows-auto grid-cols-[repeat(auto-fill,minmax(300px,1fr))] content-start gap-6 max-md:grid-cols-1 max-md:p-4', className)}>
            {isInitialLoading && renderSkeleton?.()}

            {shouldShowEmptyState && (
                <div className='col-span-full min-h-[300px] items-center justify-center'>
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
                <div className='col-span-full min-h-[300px] items-center justify-center'>
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
                <div className='col-span-full min-h-[300px] items-center justify-center'>
                    <RecoveryState
                        title='Access denied'
                        description={errorMessage ?? "You don't have permission to view these items."}
                        tone={RecoveryStateTone.AccessDenied}
                    />
                </div>
            )}

            {shouldShowContent && data.map((item, index) => (
                <GridItem
                    key={item._id}
                    item={item}
                    index={index}
                    renderItem={renderItem}
                    getMenuOptions={getMenuOptions}
                    isDragAndDropEnabled={Boolean(dragAndDrop)}
                    draggableId={draggableIdByItemId.get(item._id) ?? null}
                    droppableId={droppableIdByItemId.get(item._id) ?? null}
                    showDragAffordance={showDragAffordance}
                    suppressNextClickRef={suppressNextClickRef}
                />
            ))}

            {isFetchingMore && renderSkeleton?.()}

            <div ref={sentinelRef} className='col-span-full h-px' aria-hidden='true' />
        </Scrollable>
    );

    const gridContent = (
        <>
            {beforeContent}
            {grid}
        </>
    );

    if(!dragAndDrop) return gridContent;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
        >
            {gridContent}
            <DragOverlay>
                {activeDragItem ? (
                    <div className='inline-flex min-w-[15rem] max-w-[22rem] items-center gap-3 rounded-xl px-4 py-3.5 text-foreground bg-surface border border-border'>
                        {showDragAffordance ? (
                            <span className='inline-flex size-8 items-center justify-center rounded-full text-foreground'>
                                <GripVertical size={16} strokeWidth={1.8} />
                            </span>
                        ) : null}
                        <span className='flex min-w-0 flex-col'>
                            <span className='max-w-[16rem] overflow-hidden text-ellipsis whitespace-nowrap text-base font-medium text-foreground'>
                                {getGridItemTitle(activeDragItem)}
                            </span>
                        </span>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default DocumentListingGrid;
