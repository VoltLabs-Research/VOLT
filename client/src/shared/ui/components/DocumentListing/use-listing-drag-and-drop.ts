import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useMemo } from 'react';
import type { DocumentListingDragAndDropConfig } from '@/shared/ui/components/DocumentListing/drag-and-drop';
import type { DragEndEvent } from '@dnd-kit/core';
import type { Identifiable } from '@/shared/contracts/entity';

interface ListingDragAndDrop<T> {
    sensors: ReturnType<typeof useSensors>;
    draggableIdByItemId: Map<string, string>;
    droppableIdByItemId: Map<string, string>;
    getDraggableItem: (draggableId: string) => T | null;
    dispatchDragEnd: (event: DragEndEvent) => Promise<void>;
};

/**
 * Resolves the drag/drop identity of every listing row once per data change, so
 * both the table and the grid can translate a dnd-kit event back into an item.
 */
const useListingDragAndDrop = <T extends Identifiable>(
    data: T[],
    dragAndDrop: DocumentListingDragAndDropConfig<T> | undefined,
    activationDistance: number
): ListingDragAndDrop<T> => {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: dragAndDrop?.activationDistance ?? activationDistance
            }
        })
    );

    const identities = useMemo(() => {
        const draggableIdByItemId = new Map<string, string>();
        const droppableIdByItemId = new Map<string, string>();
        const itemsByDraggableId = new Map<string, T>();
        const itemsByDroppableId = new Map<string, T>();

        data.forEach((item) => {
            const draggableId = dragAndDrop?.getDraggableId(item);
            if(draggableId){
                draggableIdByItemId.set(item._id, draggableId);
                itemsByDraggableId.set(draggableId, item);
            }

            const droppableId = dragAndDrop?.getDroppableId(item);
            if(droppableId){
                droppableIdByItemId.set(item._id, droppableId);
                itemsByDroppableId.set(droppableId, item);
            }
        });

        return {
            draggableIdByItemId,
            droppableIdByItemId,
            itemsByDraggableId,
            itemsByDroppableId
        };
    }, [data, dragAndDrop]);

    return {
        sensors,
        draggableIdByItemId: identities.draggableIdByItemId,
        droppableIdByItemId: identities.droppableIdByItemId,
        getDraggableItem: (draggableId: string) => identities.itemsByDraggableId.get(draggableId) ?? null,
        dispatchDragEnd: async (event: DragEndEvent) => {
            if(!dragAndDrop) return;

            const activeId = String(event.active.id);
            const overId = event.over ? String(event.over.id) : null;

            await dragAndDrop.onDragEnd({
                event,
                activeId,
                overId,
                activeItem: identities.itemsByDraggableId.get(activeId) ?? null,
                overItem: overId ? identities.itemsByDroppableId.get(overId) ?? null : null
            });
        }
    };
};

export default useListingDragAndDrop;
