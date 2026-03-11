import type { DragEndEvent } from '@dnd-kit/core';
import type { Identifiable } from '@/shared/presentation/components/DocumentListingTable';

/** Resolves the dragged row and target row for an opted-in document listing drop action. */
export interface DocumentListingDragEndPayload<T extends Identifiable> {
    event: DragEndEvent;
    activeId: string;
    overId: string | null;
    activeItem: T | null;
    overItem: T | null;
};

/** Optional drag-and-drop hooks for listings that support row-to-folder moves. */
export interface DocumentListingDragAndDropConfig<T extends Identifiable> {
    activationDistance?: number;
    getDraggableId: (item: T) => string | null;
    getDroppableId: (item: T) => string | null;
    onDragEnd: (payload: DocumentListingDragEndPayload<T>) => void | Promise<void>;
};
