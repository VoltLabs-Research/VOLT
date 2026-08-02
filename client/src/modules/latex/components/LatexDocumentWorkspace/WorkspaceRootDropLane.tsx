import { useWorkspaceTree } from './workspace-tree-context';
import { ROOT_FOLDER_LABEL } from './workspace-dropped-entries';
import { LATEX_WORKSPACE_ROOT_DROP_ID } from '@/modules/latex/utils/workspace-dnd';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/shared/utils/cn';
import { useState } from 'react';
import type { DragEvent } from 'react';

interface WorkspaceRootDropLaneProps {
    position: 'top' | 'bottom';
    isVisible: boolean;
}

export const ROOT_DROP_PATH = '';

/**
 * Drop target that lets an item be moved back to the project root without
 * having a root row to aim at.
*/
const WorkspaceRootDropLane = ({ position, isVisible }: WorkspaceRootDropLaneProps) => {
    const {
        handleExternalFilesDragOver,
        handleExternalFilesDragLeave,
        handleExternalFilesDrop
    } = useWorkspaceTree();
    const [isExternallyActive, setIsExternallyActive] = useState(false);
    const { setNodeRef, isOver } = useDroppable({
        id: `${LATEX_WORKSPACE_ROOT_DROP_ID}:${position}`,
        data: {
            folderPath: ROOT_DROP_PATH,
            label: ROOT_FOLDER_LABEL
        }
    });

    if (!isVisible) {
        return null;
    }

    const handleDragLeave = (event: DragEvent<HTMLElement>): void => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
            setIsExternallyActive(false);
        }

        handleExternalFilesDragLeave(ROOT_DROP_PATH, event);
    };

    return (
        <div ref={setNodeRef} className={cn(
                'latex-workspace__root-drop-lane d-flex items-center',
                position === 'bottom' && 'is-fill-area',
                (isOver || isExternallyActive) && 'is-root-drop-target'
            )} aria-hidden='true' onDragOver={(event) => {
                setIsExternallyActive(true);
                handleExternalFilesDragOver(ROOT_DROP_PATH, event);
            }} onDragLeave={handleDragLeave} onDrop={(event) => {
                setIsExternallyActive(false);
                void handleExternalFilesDrop(ROOT_DROP_PATH, event);
            }}>
            <span className='latex-workspace__root-drop-lane-line' />
        </div>
    );
};

export default WorkspaceRootDropLane;
