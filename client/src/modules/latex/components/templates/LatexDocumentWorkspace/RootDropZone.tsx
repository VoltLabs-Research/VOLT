import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/shared/utils';
import type React from 'react';

interface RootDropZoneProps {
    children: React.ReactNode;
};

/** Droppable root area — items dropped here move to the project root (path = ""). */
const RootDropZone = ({ children }: RootDropZoneProps) => {
    const { setNodeRef, isOver } = useDroppable({ id: 'folder:' });
    return (
        <div
            ref={setNodeRef}
            className={cn('latex-tree__root-drop', isOver && 'is-over')}
        >
            {children}
        </div>
    );
};

export default RootDropZone;
