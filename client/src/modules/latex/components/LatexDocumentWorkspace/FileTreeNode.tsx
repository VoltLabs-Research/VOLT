import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import WorkspaceAssetRow from './WorkspaceAssetRow';
import WorkspaceCreationInputs from './WorkspaceCreationInputs';
import WorkspaceEditableName from './WorkspaceEditableName';
import WorkspaceFileRow from './WorkspaceFileRow';
import WorkspaceTreeRow from './WorkspaceTreeRow';
import { createDeleteMenuOption, createRenameMenuOption } from './workspace-row-menus';
import { useWorkspaceTree } from './workspace-tree-context';
import { IconButton, Row, Stack } from '@voltstack/bravais';
import {
    buildLatexWorkspaceDropId,
    canDropLatexWorkspaceItemInFolder
} from '@/modules/latex/utils/workspace-dnd';
import {
    ChevronDown,
    ChevronRight,
    FileCode,
    Folder,
    FolderOpen,
    FolderPlus,
    Plus
} from 'lucide-react';
import { useCallback } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/shared/utils/cn';
import type { FileTreeNode as FileTreeNodeType } from '@/modules/latex/utils/file-tree';
import type { MenuOption } from '@/shared/contracts/menu';
import type { KeyboardEvent } from 'react';

interface FileTreeNodeProps {
    node: FileTreeNodeType;
    depth: number;
}

/**
 * Folder row: expand/collapse control, drop target for moves and OS drops,
 * and the recursion point for everything nested inside it.
*/
const WorkspaceFolderRow = ({ node, depth }: FileTreeNodeProps) => {
    const {
        expandedFolders,
        renamingTarget,
        activeDragData,
        externalDropTargetPath,
        toggleFolder,
        openNewFileIn,
        openNewFolderIn,
        renameFolder,
        startRenameFolder,
        handleDeleteFolder,
        handleExternalFilesDragOver,
        handleExternalFilesDragLeave,
        handleExternalFilesDrop
    } = useWorkspaceTree();
    const isExpanded = expandedFolders.has(node.folderPath);
    const isRenaming = renamingTarget?.id === `folder:${node.folderPath}`;
    const {
        attributes,
        listeners,
        setNodeRef: setDraggableNodeRef,
        transform,
        isDragging
    } = useDraggable({
        id: node.id,
        data: {
            kind: 'folder',
            id: node.folderPath,
            label: node.name,
            folderPath: node.folderPath
        },
        disabled: isRenaming
    });
    const {
        setNodeRef: setDroppableNodeRef,
        isOver
    } = useDroppable({
        id: buildLatexWorkspaceDropId(node.folderPath),
        data: {
            folderPath: node.folderPath,
            label: node.name
        },
        disabled: isRenaming
    });
    const setRowNodeRef = useCallback((element: HTMLDivElement | null) => {
        setDraggableNodeRef(element);
        setDroppableNodeRef(element);
    }, [setDraggableNodeRef, setDroppableNodeRef]);
    const canDropHere = canDropLatexWorkspaceItemInFolder(activeDragData, node.folderPath);

    const handleFolderKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        const isToggleKey = event.key === 'Enter'
            || event.key === ' '
            || (event.key === 'ArrowRight' && !isExpanded)
            || (event.key === 'ArrowLeft' && isExpanded);

        if (!isToggleKey) {
            return;
        }

        event.preventDefault();
        toggleFolder(node.folderPath);
    };

    const folderMenuOptions: MenuOption[] = [
        {
            label: 'New file',
            icon: Plus,
            onClick: () => openNewFileIn(node.folderPath)
        },
        {
            label: 'New folder',
            icon: FolderPlus,
            onClick: () => openNewFolderIn(node.folderPath)
        },
        createRenameMenuOption(() => startRenameFolder(node.folderPath)),
        createDeleteMenuOption(() => handleDeleteFolder(node.folderPath))
    ];

    return (
        <>
            <ContextMenuPopover
                id={`folder-ctx-${node.folderPath || 'root'}`}
                trigger={(
                    <WorkspaceTreeRow
                        ref={setRowNodeRef}
                        depth={depth}
                        icon={(
                            <Row as='span' gap='025'>
                                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                {isExpanded ? <FolderOpen size={13} /> : <Folder size={13} />}
                            </Row>
                        )}
                        label={(
                            <WorkspaceEditableName
                                isRenaming={isRenaming}
                                onSave={(nextName) => {
                                    void renameFolder(node.folderPath, nextName);
                                }}
                            >
                                {node.name}
                            </WorkspaceEditableName>
                        )}
                        treeItemLevel={depth + 1}
                        expanded={isExpanded}
                        ariaLabel={`Folder ${node.name}`}
                        onClick={() => toggleFolder(node.folderPath)}
                        onKeyDown={handleFolderKeyDown}
                        onDragOver={(event) => handleExternalFilesDragOver(node.folderPath, event)}
                        onDragLeave={(event) => handleExternalFilesDragLeave(node.folderPath, event)}
                        onDrop={(event) => {
                            void handleExternalFilesDrop(node.folderPath, event);
                        }}
                        className={cn(
                            ((isOver && canDropHere) || externalDropTargetPath === node.folderPath) && 'is-drop-target',
                            isOver && !canDropHere && 'is-invalid-drop-target',
                            isDragging && 'is-dragging'
                        )}
                        style={{
                            transform: CSS.Translate.toString(transform),
                            zIndex: isDragging ? 3 : undefined
                        }}
                        trailing={(
                            <Row gap='025'>
                                <IconButton
                                    variant='ghost'
                                    size='sm'
                                    title='New subfolder'
                                    aria-label={`Create a folder inside ${node.name}`}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        openNewFolderIn(node.folderPath);
                                    }}
                                >
                                    <FolderPlus size={12} />
                                </IconButton>
                                <IconButton
                                    variant='ghost'
                                    size='sm'
                                    title='New file'
                                    aria-label={`Create a file inside ${node.name}`}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        openNewFileIn(node.folderPath);
                                    }}
                                >
                                    <Plus size={12} />
                                </IconButton>
                            </Row>
                        )}
                        {...attributes}
                        {...listeners}
                    />
                )}
                options={folderMenuOptions}
                size='sm'
            />
            {isExpanded && (
                <Stack role='group'>
                    {node.children.map((child) => (
                        <FileTreeNode key={child.id} node={child} depth={depth + 1} />
                    ))}
                    <WorkspaceCreationInputs
                        folderPath={node.folderPath}
                        parentLabel={`inside ${node.name}`}
                        fileIcon={<FileCode size={13} />}
                    />
                </Stack>
            )}
        </>
    );
};

const FileTreeNode = ({ node, depth }: FileTreeNodeProps) => {
    if (node.type === 'folder') {
        return <WorkspaceFolderRow node={node} depth={depth} />;
    }

    if (node.type === 'file') {
        return <WorkspaceFileRow node={node} depth={depth} />;
    }

    return <WorkspaceAssetRow node={node} depth={depth} />;
};

export default FileTreeNode;
