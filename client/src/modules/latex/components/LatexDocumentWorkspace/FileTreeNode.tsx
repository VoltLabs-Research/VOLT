import ContextMenuPopover from '@/shared/presentation/primitives/ContextMenuPopover';
import EditableTag from '@/shared/presentation/components/EditableTag';
import IconButton from '@/shared/presentation/primitives/IconButton';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import WorkspaceCreationInputs from './WorkspaceCreationInputs';
import WorkspaceTreeRow from './WorkspaceTreeRow';
import {
    buildLatexWorkspaceDropId,
    canDropLatexWorkspaceItemInFolder
} from '@/modules/latex/utilities/workspace-dnd';
import { isWorkspaceImageFile, isWorkspacePdfFile, isWorkspaceTextLikeFile } from '@/modules/latex/utilities/workspace';
import {
    File,
    FileCode,
    Folder,
    FolderOpen,
    FolderPlus,
    Image,
    Link,
    Pencil,
    Plus,
    Star,
    Trash2,
    ChevronDown,
    ChevronRight,
    FileText
} from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/shared/utils';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';
import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';
import type {
    LatexWorkspaceDragData,
    LatexWorkspaceDropData
} from '@/modules/latex/utilities/workspace-dnd';
import type { FileTreeNode as FileTreeNodeType } from '@/modules/latex/utilities/file-tree';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { DragEvent, KeyboardEvent, ReactNode } from 'react';

interface RenameTarget {
    id: string;
    type: 'folder' | 'file' | 'asset';
    initialName: string;
}

interface FileTreeNodeProps {
    node: FileTreeNodeType;
    depth: number;
    expandedFolders: Set<string>;
    selectedAssetId: string | null;
    newFileTargetFolder: string | null;
    newFolderTargetFolder: string | null;
    renamingTarget: RenameTarget | null;
    activeDragData: LatexWorkspaceDragData | null;
    externalDropTargetPath: string | null;
    onToggleFolder: (folderPath: string) => void;
    onOpenNewFileIn: (folderPath: string) => void;
    onOpenNewFolderIn: (folderPath: string) => void;
    onConfirmNewFile: (name: string) => Promise<void>;
    onCancelNewFile: () => void;
    onConfirmNewFolder: (name: string) => Promise<void>;
    onCancelNewFolder: () => void;
    onFileSelect: (fileId: string) => void;
    onAssetSelect: (assetId: string) => void;
    onFileDelete: (fileId: string) => Promise<void>;
    onFolderDelete: (folderPath: string) => Promise<void>;
    onAssetDelete: (asset: LatexAsset) => Promise<void>;
    onAssetInsertRef: (asset: LatexAsset) => void;
    onStartRenameFile: (file: LatexFileEntry) => void;
    onStartRenameFolder: (folderPath: string) => void;
    onStartRenameAsset: (asset: LatexAsset) => void;
    onSaveFileName: (fileId: string, name: string) => Promise<void>;
    onSaveFolderName: (folderPath: string, name: string) => Promise<void>;
    onSaveAssetName: (asset: LatexAsset, name: string) => Promise<void>;
    onCancelRename: () => void;
    onFileSetEntrypoint: (fileId: string) => Promise<void>;
    onExternalFilesDragOver: (targetFolderPath: string, event: DragEvent<HTMLElement>) => void;
    onExternalFilesDragLeave: (targetFolderPath: string, event: DragEvent<HTMLElement>) => void;
    onExternalFilesDrop: (targetFolderPath: string, event: DragEvent<HTMLElement>) => Promise<void>;
}

const stopPropagation = (event: { stopPropagation: () => void }): void => {
    event.stopPropagation();
};

const getAssetIcon = (asset: LatexAsset) => {
    const pathname = asset.path;

    if (isWorkspacePdfFile(pathname, asset.mimetype)) {
        return <FileText size={13} />;
    }

    if (isWorkspaceImageFile(pathname, asset.mimetype)) {
        return <Image size={13} />;
    }

    if (isWorkspaceTextLikeFile(pathname, asset.mimetype)) {
        return <FileCode size={13} />;
    }

    return <File size={13} />;
};

const handleSelectableRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, onSelect: () => void): void => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect();
    }
};

const createRenameMenuOption = (onClick: () => void | Promise<void>): MenuOption => ({
    label: 'Rename',
    icon: Pencil,
    onClick
});

const createDeleteMenuOption = (onClick: () => void | Promise<void>): MenuOption => ({
    label: 'Delete',
    icon: Trash2,
    onClick,
    destructive: true
});

interface EditableWorkspaceNameProps {
    children: string;
    isRenaming: boolean;
    onCancelRename: () => void;
    onSave: (nextName: string) => void;
}

const EditableWorkspaceName = ({
    children,
    isRenaming,
    onCancelRename,
    onSave
}: EditableWorkspaceNameProps) => (
    <EditableTag
        as='span'
        className='latex-workspace__file-name text-truncate'
        title='Double-click to rename'
        allowSingleClickPropagation
        editing={isRenaming ? true : undefined}
        onEditingChange={(nextEditing) => {
            if (!nextEditing && isRenaming) {
                onCancelRename();
            }
        }}
        onSave={onSave}
    >
        {children}
    </EditableTag>
);

interface DraggableLeafTreeRowProps {
    contextMenuId: string;
    nodeId: string;
    depth: number;
    icon: ReactNode;
    label: ReactNode;
    selected?: boolean;
    treeItemLabel: string;
    title: string;
    dragData: LatexWorkspaceDragData;
    isRenaming: boolean;
    activeDragData: LatexWorkspaceDragData | null;
    menuOptions: MenuOption[];
    onSelect: () => void;
}

const DraggableLeafTreeRow = ({
    contextMenuId,
    nodeId,
    depth,
    icon,
    label,
    selected = false,
    treeItemLabel,
    title,
    dragData,
    isRenaming,
    activeDragData,
    menuOptions,
    onSelect
}: DraggableLeafTreeRowProps) => {
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

    return (
        <ContextMenuPopover
            id={contextMenuId}
            trigger={(
                <WorkspaceTreeRow
                    ref={setNodeRef}
                    depth={depth}
                    icon={icon}
                    label={label}
                    selected={selected}
                    treeItemLevel={depth + 1}
                    ariaLabel={treeItemLabel}
                    onClick={onSelect}
                    onKeyDown={(event) => handleSelectableRowKeyDown(event, onSelect)}
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

const FolderTreeNode = (props: FileTreeNodeProps) => {
    const {
        node,
        depth,
        ...treeProps
    } = props;
    const {
        expandedFolders,
        newFileTargetFolder,
        newFolderTargetFolder,
        renamingTarget,
        activeDragData,
        externalDropTargetPath,
        onToggleFolder,
        onOpenNewFileIn,
        onOpenNewFolderIn,
        onConfirmNewFile,
        onCancelNewFile,
        onConfirmNewFolder,
        onCancelNewFolder,
        onFolderDelete,
        onStartRenameFolder,
        onSaveFolderName,
        onCancelRename,
        onExternalFilesDragOver,
        onExternalFilesDragLeave,
        onExternalFilesDrop
    } = treeProps;
    const isExpanded = expandedFolders.has(node.folderPath);
    const isRenaming = renamingTarget?.id === `folder:${node.folderPath}`;
    const dragData = useMemo<LatexWorkspaceDragData>(() => ({
        kind: 'folder',
        id: node.folderPath,
        label: node.name,
        folderPath: node.folderPath
    }), [node.folderPath, node.name]);
    const dropData = useMemo<LatexWorkspaceDropData>(() => ({
        folderPath: node.folderPath,
        label: node.name
    }), [node.folderPath, node.name]);
    const {
        attributes,
        listeners,
        setNodeRef: setDraggableNodeRef,
        transform,
        isDragging
    } = useDraggable({
        id: node.id,
        data: dragData,
        disabled: isRenaming
    });
    const {
        setNodeRef: setDroppableNodeRef,
        isOver
    } = useDroppable({
        id: buildLatexWorkspaceDropId(node.folderPath),
        data: dropData,
        disabled: isRenaming
    });
    const setRowNodeRef = useCallback((element: HTMLDivElement | null) => {
        setDraggableNodeRef(element);
        setDroppableNodeRef(element);
    }, [setDraggableNodeRef, setDroppableNodeRef]);
    const canDropHere = canDropLatexWorkspaceItemInFolder(activeDragData, node.folderPath);
    const isDropTarget = (isOver && canDropHere) || externalDropTargetPath === node.folderPath;
    const isInvalidDropTarget = isOver && !canDropHere;

    const handleFolderKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggleFolder(node.folderPath);
            return;
        }

        if (event.key === 'ArrowRight' && !isExpanded) {
            event.preventDefault();
            onToggleFolder(node.folderPath);
            return;
        }

        if (event.key === 'ArrowLeft' && isExpanded) {
            event.preventDefault();
            onToggleFolder(node.folderPath);
        }
    }, [isExpanded, node.folderPath, onToggleFolder]);

    const folderMenuOptions: MenuOption[] = [
        {
            label: 'New file',
            icon: Plus,
            onClick: () => onOpenNewFileIn(node.folderPath)
        },
        {
            label: 'New folder',
            icon: FolderPlus,
            onClick: () => onOpenNewFolderIn(node.folderPath)
        },
        createRenameMenuOption(() => onStartRenameFolder(node.folderPath)),
        createDeleteMenuOption(() => onFolderDelete(node.folderPath))
    ];

    const folderLabel = (
        <EditableWorkspaceName
            isRenaming={isRenaming}
            onCancelRename={onCancelRename}
            onSave={(nextName) => {
                void onSaveFolderName(node.folderPath, nextName);
            }}
        >
            {node.name}
        </EditableWorkspaceName>
    );

    return (
        <>
            <ContextMenuPopover
                id={`folder-ctx-${node.folderPath || 'root'}`}
                trigger={(
                    <WorkspaceTreeRow
                        ref={setRowNodeRef}
                        depth={depth}
                        icon={(
                            <span className='d-flex items-center gap-025'>
                                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                {isExpanded ? <FolderOpen size={13} /> : <Folder size={13} />}
                            </span>
                        )}
                        label={folderLabel}
                        treeItemLevel={depth + 1}
                        expanded={isExpanded}
                        ariaLabel={`Folder ${node.name}`}
                        onClick={() => onToggleFolder(node.folderPath)}
                        onKeyDown={handleFolderKeyDown}
                        onDragOver={(event) => onExternalFilesDragOver(node.folderPath, event)}
                        onDragLeave={(event) => onExternalFilesDragLeave(node.folderPath, event)}
                        onDrop={(event) => {
                            void onExternalFilesDrop(node.folderPath, event);
                        }}
                        className={cn(
                            isDropTarget && 'is-drop-target',
                            isInvalidDropTarget && 'is-invalid-drop-target',
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
                                    onPointerDown={stopPropagation}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onOpenNewFolderIn(node.folderPath);
                                    }}
                                >
                                    <FolderPlus size={12} />
                                </IconButton>
                                <IconButton
                                    variant='ghost'
                                    size='sm'
                                    title='New file'
                                    aria-label={`Create a file inside ${node.name}`}
                                    onPointerDown={stopPropagation}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onOpenNewFileIn(node.folderPath);
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
                        <FileTreeNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            {...treeProps}
                        />
                    ))}
                    <WorkspaceCreationInputs
                        folderPath={node.folderPath}
                        newFileTargetFolder={newFileTargetFolder}
                        newFolderTargetFolder={newFolderTargetFolder}
                        folderLabel={`Create a folder inside ${node.name}`}
                        fileLabel={`Create a file inside ${node.name}`}
                        fileIcon={<FileCode size={13} />}
                        onConfirmNewFolder={onConfirmNewFolder}
                        onCancelNewFolder={onCancelNewFolder}
                        onConfirmNewFile={onConfirmNewFile}
                        onCancelNewFile={onCancelNewFile}
                    />
                </Stack>
            )}
        </>
    );
};

const FileLeafNode = ({
    node,
    depth,
    renamingTarget,
    activeDragData,
    onFileSelect,
    onFileDelete,
    onStartRenameFile,
    onSaveFileName,
    onCancelRename,
    onFileSetEntrypoint
}: FileTreeNodeProps) => {
    const file = node.data as LatexFileEntry;
    const isRenaming = renamingTarget?.id === `file:${file._id}`;
    const dragData = useMemo<LatexWorkspaceDragData>(() => ({
        kind: 'file',
        id: file._id,
        label: file.name,
        folderPath: file.path
    }), [file._id, file.name, file.path]);
    const isTexFile = file.name.toLowerCase().endsWith('.tex');
    const handleSelect = useCallback(() => onFileSelect(file._id), [file._id, onFileSelect]);
    const menuOptions: MenuOption[] = [
        ...(isTexFile ? [{
            label: 'Set as entrypoint',
            icon: Star,
            onClick: () => onFileSetEntrypoint(file._id),
            disabled: file.isEntrypoint
        }] : []),
        createRenameMenuOption(() => onStartRenameFile(file)),
        createDeleteMenuOption(() => onFileDelete(file._id))
    ];

    const fileLabel = (
        <EditableWorkspaceName
            isRenaming={isRenaming}
            onCancelRename={onCancelRename}
            onSave={(nextName) => {
                void onSaveFileName(file._id, nextName);
            }}
        >
            {file.name}
        </EditableWorkspaceName>
    );

    return (
        <DraggableLeafTreeRow
            contextMenuId={`file-ctx-${file._id}`}
            nodeId={node.id}
            depth={depth}
            icon={<FileCode size={13} />}
            label={fileLabel}
            selected={file.isSelected}
            treeItemLabel={`File ${file.name}`}
            title={file.path}
            dragData={dragData}
            isRenaming={isRenaming}
            activeDragData={activeDragData}
            menuOptions={menuOptions}
            onSelect={handleSelect}
        />
    );
};

const AssetLeafNode = ({
    node,
    depth,
    selectedAssetId,
    renamingTarget,
    activeDragData,
    onAssetSelect,
    onAssetDelete,
    onAssetInsertRef,
    onStartRenameAsset,
    onSaveAssetName,
    onCancelRename
}: FileTreeNodeProps) => {
    const asset = node.data as LatexAsset;
    const isRenaming = renamingTarget?.id === `asset:${asset._id}`;
    const assetPath = asset.path;
    const isSelected = selectedAssetId === asset._id;
    const dragData = useMemo<LatexWorkspaceDragData>(() => ({
        kind: 'asset',
        id: asset._id,
        label: node.name,
        folderPath: node.folderPath
    }), [asset._id, node.folderPath, node.name]);
    const handleSelect = useCallback(() => onAssetSelect(asset._id), [asset._id, onAssetSelect]);
    const assetMenuOptions: MenuOption[] = [
        {
            label: 'Insert reference',
            icon: Link,
            onClick: () => onAssetInsertRef(asset)
        },
        createRenameMenuOption(() => onStartRenameAsset(asset)),
        createDeleteMenuOption(() => onAssetDelete(asset))
    ];

    const assetLabel = (
        <EditableWorkspaceName
            isRenaming={isRenaming}
            onCancelRename={onCancelRename}
            onSave={(nextName) => {
                void onSaveAssetName(asset, nextName);
            }}
        >
            {node.name}
        </EditableWorkspaceName>
    );

    return (
        <DraggableLeafTreeRow
            contextMenuId={`asset-ctx-${asset._id}`}
            nodeId={node.id}
            depth={depth}
            icon={getAssetIcon(asset)}
            label={assetLabel}
            selected={isSelected}
            treeItemLabel={`Asset ${node.name}`}
            title={assetPath}
            dragData={dragData}
            isRenaming={isRenaming}
            activeDragData={activeDragData}
            menuOptions={assetMenuOptions}
            onSelect={handleSelect}
        />
    );
};

const FileTreeNode = (props: FileTreeNodeProps) => {
    if (props.node.type === 'folder') {
        return <FolderTreeNode {...props} />;
    }

    if (props.node.type === 'file') {
        return <FileLeafNode {...props} />;
    }

    return <AssetLeafNode {...props} />;
};

export default FileTreeNode;
