import Container from '@/shared/presentation/components/Container';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import EditableTag from '@/shared/presentation/components/EditableTag';
import IconButton from '@/shared/presentation/components/IconButton';
import WorkspaceEntryInput from './WorkspaceEntryInput';
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
import type { DragEvent, KeyboardEvent } from 'react';

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

const FolderTreeNode = ({
    node,
    depth,
    expandedFolders,
    selectedAssetId,
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
    onFileSelect,
    onAssetSelect,
    onFileDelete,
    onFolderDelete,
    onAssetDelete,
    onAssetInsertRef,
    onStartRenameFile,
    onStartRenameFolder,
    onStartRenameAsset,
    onSaveFileName,
    onSaveFolderName,
    onSaveAssetName,
    onCancelRename,
    onFileSetEntrypoint,
    onExternalFilesDragOver,
    onExternalFilesDragLeave,
    onExternalFilesDrop
}: FileTreeNodeProps) => {
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

    const renderChild = useCallback((child: FileTreeNodeType) => (
        <FileTreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            expandedFolders={expandedFolders}
            selectedAssetId={selectedAssetId}
            newFileTargetFolder={newFileTargetFolder}
            newFolderTargetFolder={newFolderTargetFolder}
            renamingTarget={renamingTarget}
            activeDragData={activeDragData}
            externalDropTargetPath={externalDropTargetPath}
            onToggleFolder={onToggleFolder}
            onOpenNewFileIn={onOpenNewFileIn}
            onOpenNewFolderIn={onOpenNewFolderIn}
            onConfirmNewFile={onConfirmNewFile}
            onCancelNewFile={onCancelNewFile}
            onConfirmNewFolder={onConfirmNewFolder}
            onCancelNewFolder={onCancelNewFolder}
            onFileSelect={onFileSelect}
            onAssetSelect={onAssetSelect}
            onFileDelete={onFileDelete}
            onFolderDelete={onFolderDelete}
            onAssetDelete={onAssetDelete}
            onAssetInsertRef={onAssetInsertRef}
            onStartRenameFile={onStartRenameFile}
            onStartRenameFolder={onStartRenameFolder}
            onStartRenameAsset={onStartRenameAsset}
            onSaveFileName={onSaveFileName}
            onSaveFolderName={onSaveFolderName}
            onSaveAssetName={onSaveAssetName}
            onCancelRename={onCancelRename}
            onFileSetEntrypoint={onFileSetEntrypoint}
            onExternalFilesDragOver={onExternalFilesDragOver}
            onExternalFilesDragLeave={onExternalFilesDragLeave}
            onExternalFilesDrop={onExternalFilesDrop}
        />
    ), [
        activeDragData,
        depth,
        expandedFolders,
        externalDropTargetPath,
        newFileTargetFolder,
        newFolderTargetFolder,
        onAssetDelete,
        onAssetInsertRef,
        onAssetSelect,
        onCancelNewFile,
        onCancelNewFolder,
        onCancelRename,
        onConfirmNewFile,
        onConfirmNewFolder,
        onExternalFilesDragLeave,
        onExternalFilesDragOver,
        onExternalFilesDrop,
        onFileDelete,
        onFileSelect,
        onFileSetEntrypoint,
        onFolderDelete,
        onOpenNewFileIn,
        onOpenNewFolderIn,
        onSaveAssetName,
        onSaveFileName,
        onSaveFolderName,
        onStartRenameAsset,
        onStartRenameFile,
        onStartRenameFolder,
        onToggleFolder,
        renamingTarget,
        selectedAssetId
    ]);

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
        {
            label: 'Rename',
            icon: Pencil,
            onClick: () => onStartRenameFolder(node.folderPath)
        },
        {
            label: 'Delete',
            icon: Trash2,
            onClick: () => onFolderDelete(node.folderPath),
            destructive: true
        }
    ];

    const folderLabel = (
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
            onSave={(nextName) => {
                void onSaveFolderName(node.folderPath, nextName);
            }}
        >
            {node.name}
        </EditableTag>
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
                            <Container className='d-flex items-center gap-025'>
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
                            </Container>
                        )}
                        {...attributes}
                        {...listeners}
                    />
                )}
                options={folderMenuOptions}
                size='sm'
            />
            {isExpanded && (
                <Container className='d-flex column' role='group'>
                    {node.children.map(renderChild)}
                    {newFolderTargetFolder === node.folderPath && (
                        <WorkspaceEntryInput
                            icon={<FolderPlus size={13} />}
                            label={`Create a folder inside ${node.name}`}
                            placeholder='Folder name'
                            onConfirm={onConfirmNewFolder}
                            onCancel={onCancelNewFolder}
                        />
                    )}
                    {newFileTargetFolder === node.folderPath && (
                        <WorkspaceEntryInput
                            icon={<FileCode size={13} />}
                            label={`Create a file inside ${node.name}`}
                            placeholder='File name'
                            onConfirm={onConfirmNewFile}
                            onCancel={onCancelNewFile}
                        />
                    )}
                </Container>
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
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging
    } = useDraggable({
        id: node.id,
        data: dragData,
        disabled: isRenaming
    });
    const isTexFile = file.name.toLowerCase().endsWith('.tex');
    const isCurrentDragSource = activeDragData?.kind === dragData.kind && activeDragData.id === dragData.id;
    const menuOptions: MenuOption[] = [
        ...(isTexFile ? [{
            label: 'Set as entrypoint',
            icon: Star,
            onClick: () => onFileSetEntrypoint(file._id),
            disabled: file.isEntrypoint
        }] : []),
        {
            label: 'Rename',
            icon: Pencil,
            onClick: () => onStartRenameFile(file)
        },
        {
            label: 'Delete',
            icon: Trash2,
            onClick: () => onFileDelete(file._id),
            destructive: true
        }
    ];

    const fileLabel = (
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
            onSave={(nextName) => {
                void onSaveFileName(file._id, nextName);
            }}
        >
            {file.name}
        </EditableTag>
    );

    return (
        <ContextMenuPopover
            id={`file-ctx-${file._id}`}
            trigger={(
                <WorkspaceTreeRow
                    ref={setNodeRef}
                    depth={depth}
                    icon={<FileCode size={13} />}
                    label={fileLabel}
                    selected={file.isSelected}
                    treeItemLevel={depth + 1}
                    ariaLabel={`File ${file.name}`}
                    onClick={() => onFileSelect(file._id)}
                    onKeyDown={(event) => handleSelectableRowKeyDown(event, () => onFileSelect(file._id))}
                    title={file.path}
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
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging
    } = useDraggable({
        id: node.id,
        data: dragData,
        disabled: isRenaming
    });
    const isCurrentDragSource = activeDragData?.kind === dragData.kind && activeDragData.id === dragData.id;
    const assetMenuOptions: MenuOption[] = [
        {
            label: 'Insert reference',
            icon: Link,
            onClick: () => onAssetInsertRef(asset)
        },
        {
            label: 'Rename',
            icon: Pencil,
            onClick: () => onStartRenameAsset(asset)
        },
        {
            label: 'Delete',
            icon: Trash2,
            onClick: () => onAssetDelete(asset),
            destructive: true
        }
    ];

    const assetLabel = (
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
            onSave={(nextName) => {
                void onSaveAssetName(asset, nextName);
            }}
        >
            {node.name}
        </EditableTag>
    );

    return (
        <ContextMenuPopover
            id={`asset-ctx-${asset._id}`}
            trigger={(
                <WorkspaceTreeRow
                    ref={setNodeRef}
                    depth={depth}
                    icon={getAssetIcon(asset)}
                    label={assetLabel}
                    selected={isSelected}
                    treeItemLevel={depth + 1}
                    ariaLabel={`Asset ${node.name}`}
                    onClick={() => onAssetSelect(asset._id)}
                    onKeyDown={(event) => handleSelectableRowKeyDown(event, () => onAssetSelect(asset._id))}
                    title={assetPath}
                    className={cn((isDragging || isCurrentDragSource) && 'is-dragging')}
                    style={{
                        transform: CSS.Translate.toString(transform),
                        zIndex: isDragging ? 3 : undefined
                    }}
                    {...attributes}
                    {...listeners}
                />
            )}
            options={assetMenuOptions}
            size='sm'
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
