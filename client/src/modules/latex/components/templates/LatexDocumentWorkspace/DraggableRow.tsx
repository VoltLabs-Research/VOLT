import { useDraggable } from '@dnd-kit/core';

interface DraggableRowProps {
    id: string;
    children: (isDragging: boolean) => React.ReactNode;
    disabled?: boolean;
};

/** A draggable wrapper that exposes `isDragging` to its render-prop child. */
const DraggableRow = ({ id, children, disabled }: DraggableRowProps) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled });

    return (
        <div ref={setNodeRef} {...attributes} {...listeners}>
            {children(isDragging)}
        </div>
    );
};

export default DraggableRow;
