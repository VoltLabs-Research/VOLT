import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { cn } from '@/shared/utils/cn';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { useCallback } from 'react';
import type { Identifiable } from '@/shared/contracts/entity';
import type { MenuOption } from '@/shared/contracts/menu';
import type { MutableRefObject, ReactNode } from 'react';

interface GridItemProps<T extends Identifiable> {
    item: T;
    index: number;
    renderItem: (item: T, index: number) => ReactNode;
    getMenuOptions?: (item: T, selectedItems: T[]) => MenuOption[];
    isDragAndDropEnabled: boolean;
    draggableId: string | null;
    droppableId: string | null;
    showDragAffordance: boolean;
    suppressNextClickRef: MutableRefObject<boolean>;
};

type DraggableGridItemBodyProps<T extends Identifiable> = Pick<
    GridItemProps<T>,
    'item' | 'draggableId' | 'droppableId' | 'showDragAffordance' | 'suppressNextClickRef'
> & { children: ReactNode };

const DraggableGridItemBody = <T extends Identifiable,>({
    item,
    draggableId,
    droppableId,
    showDragAffordance,
    suppressNextClickRef,
    children
}: DraggableGridItemBodyProps<T>) => {
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

    const setItemNodeRef = useCallback((node: HTMLDivElement | null) => {
        setDraggableNodeRef(node);
        setDroppableNodeRef(node);
    }, [setDraggableNodeRef, setDroppableNodeRef]);

    return (
        <div
            ref={setItemNodeRef}
            className={cn(
                'document-listing-grid-item',
                draggableId ? 'is-draggable' : '',
                droppableId ? 'is-droppable' : '',
                isDragging ? 'is-dragging' : '',
                isOver ? 'is-drag-over' : ''
            )}
            style={{
                transform: CSS.Translate.toString(transform),
                zIndex: isDragging ? 20 : undefined
            }}
            onClickCapture={(event) => {
                if(!suppressNextClickRef.current) return;

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
            {children}
        </div>
    );
};

const GridItem = <T extends Identifiable,>({
    item,
    index,
    renderItem,
    getMenuOptions,
    isDragAndDropEnabled,
    draggableId,
    droppableId,
    showDragAffordance,
    suppressNextClickRef
}: GridItemProps<T>) => {
    const menuOptions = getMenuOptions ? getMenuOptions(item, []) : [];
    const body = renderItem(item, index);
    const content = isDragAndDropEnabled ? (
        <DraggableGridItemBody
            item={item}
            draggableId={draggableId}
            droppableId={droppableId}
            showDragAffordance={showDragAffordance}
            suppressNextClickRef={suppressNextClickRef}
        >
            {body}
        </DraggableGridItemBody>
    ) : (
        <div className='document-listing-grid-item'>
            {body}
        </div>
    );

    if(menuOptions.length === 0) return content;

    return (
        <ContextMenuPopover id={`grid-item-menu-${item._id}`} trigger={content} options={menuOptions} />
    );
};

export default GridItem;
