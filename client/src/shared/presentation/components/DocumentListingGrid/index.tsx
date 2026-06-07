import getListingDisplayState from '@/shared/presentation/components/DocumentListing/listing-state';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import type { DocumentListingDragAndDropConfig } from '@/shared/presentation/components/DocumentListing/drag-and-drop';
import { buildItemMapByGeneratedId } from '@/shared/presentation/components/DocumentListing/dnd-maps';
import useInfiniteScroll from '@/shared/presentation/hooks/use-infinite-scroll';
import './DocumentListingGrid.css';
import { CSS } from '@dnd-kit/utilities';
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { FileText, GripVertical } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MutableRefObject, ReactNode } from 'react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { MenuOption } from '@/shared/presentation/types/menu';

interface DocumentListingGridProps<T extends { _id: string }> {
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

interface DocumentListingGridItemProps<T extends { _id: string }> {
    item: T;
    index: number;
    renderItem: (item: T, index: number) => ReactNode;
    getMenuOptions?: (item: T, selectedItems: T[]) => MenuOption[];
    draggableId?: string | null;
    droppableId?: string | null;
    showDragAffordance: boolean;
    suppressNextClickRef: MutableRefObject<boolean>;
}

const getGridItemTitle = (item: unknown): string => {
    if (typeof item !== 'object' || item === null) {
        return 'Item';
    }

    const record = item as Record<string, unknown>;
    const value = record.name ?? record.title;
    return typeof value === 'string' && value.trim().length > 0 ? value : 'Item';
};

const DocumentListingGridItem = <T extends { _id: string },>({
    item,
    index,
    renderItem,
    getMenuOptions,
    draggableId = null,
    droppableId = null,
    showDragAffordance,
    suppressNextClickRef
}: DocumentListingGridItemProps<T>) => {
    const {
        attributes,
        listeners,
        setNodeRef: setDraggableNodeRef,
        transform,
        isDragging
    } = useDraggable({
        id: draggableId ?? `document-listing-grid-disabled-draggable:${item._id}`,
        disabled: !draggableId
    });
    const {
        setNodeRef: setDroppableNodeRef,
        isOver
    } = useDroppable({
        id: droppableId ?? `document-listing-grid-disabled-droppable:${item._id}`,
        disabled: !droppableId
    });
    const menuOptions = getMenuOptions ? getMenuOptions(item, []) : [];

    const setItemNodeRef = useCallback((node: HTMLDivElement | null) => {
        setDraggableNodeRef(node);
        setDroppableNodeRef(node);
    }, [setDraggableNodeRef, setDroppableNodeRef]);

    const itemStyle: CSSProperties = {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 20 : undefined
    };

    const itemClassName = [
        'document-listing-grid-item',
        draggableId ? 'is-draggable' : '',
        droppableId ? 'is-droppable' : '',
        isDragging ? 'is-dragging' : '',
        isOver ? 'is-drag-over' : ''
    ].filter(Boolean).join(' ');

    const content = (
        <div
            ref={setItemNodeRef}
            className={itemClassName}
            style={itemStyle}
            onClickCapture={(event) => {
                if (!suppressNextClickRef.current) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();
                suppressNextClickRef.current = false;
            }}
            {...(draggableId ? attributes : {})}
            {...(draggableId ? listeners : {})}
        >
            {draggableId && showDragAffordance ? (
                <div className='document-listing-grid-drag-affordance' aria-hidden='true'>
                    <GripVertical size={14} strokeWidth={1.8} />
                </div>
            ) : null}
            {renderItem(item, index)}
        </div>
    );

    if (menuOptions.length === 0) {
        return content;
    }

    return (
        <ContextMenuPopover id={`grid-item-menu-${item._id}`} trigger={content} options={menuOptions} />
    );
};

const PlainDocumentListingGridItem = <T extends { _id: string },>({
    item,
    index,
    renderItem,
    getMenuOptions
}: Pick<DocumentListingGridItemProps<T>, 'item' | 'index' | 'renderItem' | 'getMenuOptions'>) => {
    const menuOptions = getMenuOptions ? getMenuOptions(item, []) : [];
    const content = (
        <div className='document-listing-grid-item'>
            {renderItem(item, index)}
        </div>
    );

    if (menuOptions.length === 0) {
        return content;
    }

    return (
        <ContextMenuPopover id={`grid-item-menu-${item._id}`} trigger={content} options={menuOptions} />
    );
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
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: dragAndDrop?.activationDistance ?? 8
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

    const draggableItemsById = useMemo(() => {
        return buildItemMapByGeneratedId(data, Boolean(dragAndDrop), (item) => {
            return dragAndDrop?.getDraggableId(item);
        });
    }, [data, dragAndDrop]);

    const droppableItemsById = useMemo(() => {
        return buildItemMapByGeneratedId(data, Boolean(dragAndDrop), (item) => {
            return dragAndDrop?.getDroppableId(item);
        });
    }, [data, dragAndDrop]);

    const activeDragItem = activeDragId ? draggableItemsById.get(activeDragId) ?? null : null;
    const showDragAffordance = dragAndDrop?.showDragAffordance ?? true;

    const handleDragStart = useCallback((event: DragStartEvent) => {
        suppressNextClickRef.current = true;
        setActiveDragId(String(event.active.id));
    }, []);

    const handleDragCancel = useCallback(() => {
        suppressNextClickRef.current = true;
        setActiveDragId(null);
    }, []);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        if (!dragAndDrop) {
            setActiveDragId(null);
            return;
        }

        suppressNextClickRef.current = true;
        const activeId = String(event.active.id);
        const overId = event.over ? String(event.over.id) : null;

        setActiveDragId(null);

        await dragAndDrop.onDragEnd({
            event,
            activeId,
            overId,
            activeItem: draggableItemsById.get(activeId) ?? null,
            overItem: overId ? droppableItemsById.get(overId) ?? null : null
        });

        window.setTimeout(() => {
            suppressNextClickRef.current = false;
        }, 0);
    }, [dragAndDrop, draggableItemsById, droppableItemsById]);

    const content = shouldShowContent && data.map((item, index) => {
        if (!dragAndDrop) {
            return (
                <PlainDocumentListingGridItem
                    key={item._id}
                    item={item}
                    index={index}
                    renderItem={renderItem}
                    getMenuOptions={getMenuOptions}
                />
            );
        }

        return (
            <DocumentListingGridItem
                key={item._id}
                item={item}
                index={index}
                renderItem={renderItem}
                getMenuOptions={getMenuOptions}
                draggableId={dragAndDrop.getDraggableId(item)}
                droppableId={dragAndDrop.getDroppableId(item)}
                showDragAffordance={showDragAffordance}
                suppressNextClickRef={suppressNextClickRef}
            />
        );
    });

    const grid = (
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

    const gridContent = (
        <>
            {beforeContent}
            {grid}
        </>
    );

    if (!dragAndDrop) {
        return gridContent;
    }

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
        >
            {gridContent}
            <DragOverlay>
                {activeDragItem ? (
                    <div className='document-listing-grid-drag-overlay glass-bg'>
                        {showDragAffordance ? (
                            <span className='document-listing-grid-drag-overlay__icon'>
                                <GripVertical size={16} strokeWidth={1.8} />
                            </span>
                        ) : null}
                        <span className='document-listing-grid-drag-overlay__content'>
                            <span className='document-listing-grid-drag-overlay__title'>
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
