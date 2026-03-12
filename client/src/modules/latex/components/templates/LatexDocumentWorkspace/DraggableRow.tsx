import { useDraggable } from '@dnd-kit/core';
import { useCallback } from 'react';

interface DraggableRowProps {
    id: string;
    children: (isDragging: boolean) => React.ReactNode;
    disabled?: boolean;
};

/** A draggable wrapper that exposes `isDragging` to its render-prop child. */
const DraggableRow = ({ id, children, disabled }: DraggableRowProps) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled });
    const handlePointerDownCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            event.stopPropagation();
        }
    }, []);

    return (
        <div
            ref={setNodeRef}
            onPointerDownCapture={handlePointerDownCapture}
            {...attributes}
            {...listeners}
        >
            {children(isDragging)}
        </div>
    );
};

export default DraggableRow;
