import type { DragEndEvent } from '@dnd-kit/core';
import type { Identifiable } from '@/shared/contracts/entity';

export interface DocumentListingDragEndPayload<T extends Identifiable> {
    event: DragEndEvent;
    activeId: string;
    overId: string | null;
    activeItem: T | null;
    overItem: T | null;
};

export interface DocumentListingDragAndDropConfig<T extends Identifiable> {
    activationDistance?: number;
    showDragAffordance?: boolean;
    getDraggableId: (item: T) => string | null;
    getDroppableId: (item: T) => string | null;
    onDragEnd: (payload: DocumentListingDragEndPayload<T>) => void | Promise<void>;
};
