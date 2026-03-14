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
            className={cn('latex-tree__root-drop-shell', isOver && 'is-over')}
        >
            <div className='latex-tree__root-drop-affordance' aria-hidden='true'>
                Drop here to move items to the project root
            </div>
            <div className='latex-tree__root-drop' role='tree' aria-label='Project files and assets'>
                {children}
            </div>
        </div>
    );
};

export default RootDropZone;
