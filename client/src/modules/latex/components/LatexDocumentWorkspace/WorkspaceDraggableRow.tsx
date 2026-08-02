import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import WorkspaceEditableName from './WorkspaceEditableName';
import WorkspaceTreeRow from './WorkspaceTreeRow';
import { useWorkspaceTree } from './workspace-tree-context';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/shared/utils/cn';
import type { LatexWorkspaceDragData } from '@/modules/latex/utils/workspace-dnd';
import type { MenuOption } from '@/shared/contracts/menu';
import type { KeyboardEvent, ReactNode } from 'react';

interface WorkspaceDraggableRowProps {
    contextMenuId: string;
    nodeId: string;
    depth: number;
    icon: ReactNode;
    name: string;
    selected: boolean;
    treeItemLabel: string;
    title: string;
    dragData: LatexWorkspaceDragData;
    isRenaming: boolean;
    menuOptions: MenuOption[];
    onSelect: () => void;
    onRename: (nextName: string) => void;
}

/**
 * Selectable, draggable leaf row shared by file and asset nodes. Folders are
 * not rendered through here: they are also drop targets and expand on click.
*/
const WorkspaceDraggableRow = ({
    contextMenuId,
    nodeId,
    depth,
    icon,
    name,
    selected,
    treeItemLabel,
    title,
    dragData,
    isRenaming,
    menuOptions,
    onSelect,
    onRename
}: WorkspaceDraggableRowProps) => {
    const { activeDragData } = useWorkspaceTree();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging
    } = useDraggable({
        id: nodeId,
        data: dragData,
        disabled: isRenaming
    });
    const isCurrentDragSource = activeDragData?.kind === dragData.kind && activeDragData.id === dragData.id;

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
        }
    };

    return (
        <ContextMenuPopover
            id={contextMenuId}
            trigger={(
                <WorkspaceTreeRow
                    ref={setNodeRef}
                    depth={depth}
                    icon={icon}
                    label={(
                        <WorkspaceEditableName isRenaming={isRenaming} onSave={onRename}>
                            {name}
                        </WorkspaceEditableName>
                    )}
                    selected={selected}
                    treeItemLevel={depth + 1}
                    ariaLabel={treeItemLabel}
                    onClick={onSelect}
                    onKeyDown={handleKeyDown}
                    title={title}
                    className={cn((isDragging || isCurrentDragSource) && 'is-dragging')}
                    style={{
                        transform: CSS.Translate.toString(transform),
                        zIndex: isDragging ? 3 : undefined
                    }}
                    {...attributes}
                    {...listeners}
                />
            )}
            options={menuOptions}
            size='sm'
        />
    );
};

export default WorkspaceDraggableRow;
