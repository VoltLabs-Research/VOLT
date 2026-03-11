import { cn } from '@/shared/utils';
import { useDroppable } from '@dnd-kit/core';

interface DroppableFolderProps {
    id: string;
    children: React.ReactNode;
    isOver?: boolean;
};

/** A droppable zone that highlights when a draggable is held over it. */
const DroppableFolder = ({ id, children, isOver }: DroppableFolderProps) => {
    const { setNodeRef, isOver: dndIsOver } = useDroppable({ id });
    const active = isOver ?? dndIsOver;

    return (
        <div ref={setNodeRef} className={cn('latex-tree__drop-zone', active && 'is-over')}>
            {children}
        </div>
    );
};

export default DroppableFolder;
