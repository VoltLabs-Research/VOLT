import Container from '@/shared/presentation/components/Container';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import IconButton from '@/shared/presentation/components/IconButton';
import DraggableRow from './DraggableRow';
import DroppableFolder from './DroppableFolder';
import WorkspaceEntryInput from './WorkspaceEntryInput';
import WorkspaceTreeRow from './WorkspaceTreeRow';
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
    Trash2,
    ChevronDown,
    ChevronRight,
    FileText
} from 'lucide-react';
import { useCallback } from 'react';
import type { FileTreeNode as FileTreeNodeType } from '@/modules/latex/utilities/file-tree';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';
import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';
import type { MenuOption } from '@/shared/presentation/types/menu';
import { isWorkspaceImageFile, isWorkspacePdfFile, isWorkspaceTextLikeFile } from '@/modules/latex/utilities/workspace';

interface RenameTarget {
    id: string;
    type: 'folder' | 'file' | 'asset';
    initialName: string;
}

interface FileTreeNodeProps {
    node: FileTreeNodeType;
    depth: number;
    expandedFolders: Set<string>;
    newFileTargetFolder: string | null;
    newFolderTargetFolder: string | null;
    renamingTarget: RenameTarget | null;
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
    onRenameFile: (file: LatexFileEntry) => void;
    onRenameFolder: (folderPath: string) => void;
    onRenameAsset: (asset: LatexAsset) => void;
    onConfirmRename: (name: string) => Promise<void>;
    onCancelRename: () => void;
}

const getAssetIcon = (asset: LatexAsset) => {
    const pathname = asset.path ?? asset.originalName;

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

const FileTreeNode = ({
    node,
    depth,
    expandedFolders,
    newFileTargetFolder,
    newFolderTargetFolder,
    renamingTarget,
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
    onRenameFile,
    onRenameFolder,
    onRenameAsset,
    onConfirmRename,
    onCancelRename
}: FileTreeNodeProps) => {
    const renderChild = useCallback((child: FileTreeNodeType) => (
        <FileTreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            expandedFolders={expandedFolders}
            newFileTargetFolder={newFileTargetFolder}
            newFolderTargetFolder={newFolderTargetFolder}
            renamingTarget={renamingTarget}
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
            onRenameFile={onRenameFile}
            onRenameFolder={onRenameFolder}
            onRenameAsset={onRenameAsset}
            onConfirmRename={onConfirmRename}
            onCancelRename={onCancelRename}
        />
    ), [
        depth,
        expandedFolders,
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
        onConfirmRename,
        onFileDelete,
        onFileSelect,
        onFolderDelete,
        onOpenNewFileIn,
        onOpenNewFolderIn,
        onRenameAsset,
        onRenameFile,
        onRenameFolder,
        onToggleFolder,
        renamingTarget
    ]);

    if (node.type === 'folder') {
        const isExpanded = expandedFolders.has(node.folderPath);
        const isRenaming = renamingTarget?.id === `folder:${node.folderPath}`;
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
                onClick: () => onRenameFolder(node.folderPath)
            },
            {
                label: 'Delete',
                icon: Trash2,
                onClick: () => onFolderDelete(node.folderPath),
                destructive: true
            }
        ];

        const folderRow = isRenaming ? (
            <WorkspaceEntryInput
                icon={<Folder size={13} />}
                placeholder='Folder name'
                defaultValue={renamingTarget?.initialName}
                onConfirm={onConfirmRename}
                onCancel={onCancelRename}
            />
        ) : (
            <WorkspaceTreeRow
                depth={depth}
                icon={
                    <span className='d-flex items-center gap-025'>
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {isExpanded ? <FolderOpen size={13} /> : <Folder size={13} />}
                    </span>
                }
                label={node.name}
                onClick={() => onToggleFolder(node.folderPath)}
                trailing={
                    <Container className='d-flex items-center gap-025'>
                        <IconButton
                            variant='ghost'
                            size='sm'
                            title='New subfolder'
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
                            onClick={(event) => {
                                event.stopPropagation();
                                onOpenNewFileIn(node.folderPath);
                            }}
                        >
                            <Plus size={12} />
                        </IconButton>
                    </Container>
                }
            />
        );

        return (
            <DroppableFolder id={`folder:${node.folderPath}`}>
                <ContextMenuPopover
                    id={`folder-ctx-${node.folderPath || 'root'}`}
                    trigger={folderRow}
                    options={folderMenuOptions}
                    size='sm'
                />
                {isExpanded && (
                    <Container className='d-flex column'>
                        {node.children.map(renderChild)}
                        {newFolderTargetFolder === node.folderPath && (
                            <WorkspaceEntryInput
                                icon={<FolderPlus size={13} />}
                                placeholder='Folder name'
                                onConfirm={onConfirmNewFolder}
                                onCancel={onCancelNewFolder}
                            />
                        )}
                        {newFileTargetFolder === node.folderPath && (
                            <WorkspaceEntryInput
                                icon={<FileCode size={13} />}
                                placeholder='File name'
                                onConfirm={onConfirmNewFile}
                                onCancel={onCancelNewFile}
                            />
                        )}
                    </Container>
                )}
            </DroppableFolder>
        );
    }

    if (node.type === 'file') {
        const file = node.data as LatexFileEntry;
        const isRenaming = renamingTarget?.id === `file:${file._id}`;
        const menuOptions: MenuOption[] = [
            {
                label: 'Rename',
                icon: Pencil,
                onClick: () => onRenameFile(file)
            },
            {
                label: 'Delete',
                icon: Trash2,
                onClick: () => onFileDelete(file._id),
                destructive: true
            }
        ];

        return (
            <DraggableRow id={node.id}>
                {(isDragging) => (
                    <ContextMenuPopover
                        id={`file-ctx-${file._id}`}
                        trigger={isRenaming ? (
                            <WorkspaceEntryInput
                                icon={<FileCode size={13} />}
                                placeholder='File name'
                                defaultValue={renamingTarget?.initialName}
                                onConfirm={onConfirmRename}
                                onCancel={onCancelRename}
                            />
                        ) : (
                            <WorkspaceTreeRow
                                depth={depth}
                                icon={<FileCode size={13} />}
                                label={file.name}
                                selected={file.isSelected}
                                dragging={isDragging}
                                onClick={() => onFileSelect(file._id)}
                                title={file.path}
                            />
                        )}
                        options={menuOptions}
                        size='sm'
                    />
                )}
            </DraggableRow>
        );
    }

    const asset = node.data as LatexAsset;
    const isRenaming = renamingTarget?.id === `asset:${asset._id}`;
    const assetPath = asset.path ?? asset.originalName;
    const assetMenuOptions: MenuOption[] = [
        {
            label: 'Insert reference',
            icon: Link,
            onClick: () => onAssetInsertRef(asset)
        },
        {
            label: 'Rename',
            icon: Pencil,
            onClick: () => onRenameAsset(asset)
        },
        {
            label: 'Delete',
            icon: Trash2,
            onClick: () => onAssetDelete(asset),
            destructive: true
        }
    ];

    return (
        <DraggableRow id={node.id}>
            {(isDragging) => (
                <ContextMenuPopover
                    id={`asset-ctx-${asset._id}`}
                    trigger={isRenaming ? (
                        <WorkspaceEntryInput
                            icon={getAssetIcon(asset)}
                            placeholder='File name'
                            defaultValue={renamingTarget?.initialName}
                            onConfirm={onConfirmRename}
                            onCancel={onCancelRename}
                        />
                    ) : (
                        <WorkspaceTreeRow
                            depth={depth}
                            icon={getAssetIcon(asset)}
                            label={node.name}
                            dragging={isDragging}
                            onClick={() => onAssetSelect(asset._id)}
                            title={assetPath}
                        />
                    )}
                    options={assetMenuOptions}
                    size='sm'
                />
            )}
        </DraggableRow>
    );
};

export default FileTreeNode;
