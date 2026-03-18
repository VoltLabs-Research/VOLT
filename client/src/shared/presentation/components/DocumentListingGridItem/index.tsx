import { CSS } from '@dnd-kit/utilities';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { CSSProperties, PropsWithChildren } from 'react';

interface DocumentListingGridItemProps extends PropsWithChildren {
    itemId: string;
    draggableId?: string | null;
    droppableId?: string | null;
};

const DocumentListingGridItem = ({
    children,
    itemId,
    draggableId = null,
    droppableId = null
}: DocumentListingGridItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef: setDraggableNodeRef,
        transform,
        isDragging
    } = useDraggable({
        id: draggableId ?? `document-listing-grid-item-disabled-draggable:${itemId}`,
        disabled: !draggableId
    });
    const {
        setNodeRef: setDroppableNodeRef,
        isOver
    } = useDroppable({
        id: droppableId ?? `document-listing-grid-item-disabled-droppable:${itemId}`,
        disabled: !droppableId
    });

    const style: CSSProperties = {
        transform: CSS.Translate.toString(transform)
    };

    const setGridItemNodeRef = (node: HTMLDivElement | null) => {
        setDraggableNodeRef(node);
        setDroppableNodeRef(node);
    };

    const className = [
        'document-listing-grid-item',
        draggableId ? 'is-draggable' : '',
        droppableId ? 'is-droppable' : '',
        isDragging ? 'is-dragging' : '',
        isOver ? 'is-drag-over' : ''
    ].filter(Boolean).join(' ');

    return (
        <div
            ref={setGridItemNodeRef}
            className={className}
            style={style}
            {...(draggableId ? attributes : {})}
            {...(draggableId ? listeners : {})}
        >
            {children}
        </div>
    );
};

export default DocumentListingGridItem;
