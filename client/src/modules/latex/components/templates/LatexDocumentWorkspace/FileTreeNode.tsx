import FolderNode from './FolderNode';
import FileNode from './FileNode';
import AssetNode from './AssetNode';
import type { FileTreeNode as FileTreeNodeType } from '@/modules/latex/utilities/file-tree';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';

interface FileTreeNodeProps {
    node: FileTreeNodeType;
    depth: number;
    expandedFolders: Set<string>;
    newFileTargetFolder: string | null;
    newFolderTargetFolder: string | null;
    onToggleFolder: (folderPath: string) => void;
    onOpenNewFileIn: (folderPath: string) => void;
    onOpenNewFolderIn: (folderPath: string) => void;
    newFileInputSlot?: React.ReactNode;
    newFolderInputSlot?: React.ReactNode;
    onFileSelect: (fileId: string) => void;
    onFileDelete: (fileId: string) => void;
    onFileSetEntrypoint: (fileId: string) => void;
    onAssetDelete: (asset: LatexAsset) => void;
    onAssetInsertRef: (asset: LatexAsset) => void;
};

/**
 * Dispatches to the correct node component based on `node.type`.
 * Contains no hooks — each leaf component owns its own hook calls at top level.
 */
const FileTreeNode = ({
    node,
    depth,
    expandedFolders,
    newFileTargetFolder,
    newFolderTargetFolder,
    onToggleFolder,
    onOpenNewFileIn,
    onOpenNewFolderIn,
    newFileInputSlot,
    newFolderInputSlot,
    onFileSelect,
    onFileDelete,
    onFileSetEntrypoint,
    onAssetDelete,
    onAssetInsertRef
}: FileTreeNodeProps) => {
    const renderChild = (child: FileTreeNodeType) => (
        <FileTreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            expandedFolders={expandedFolders}
            newFileTargetFolder={newFileTargetFolder}
            newFolderTargetFolder={newFolderTargetFolder}
            onToggleFolder={onToggleFolder}
            onOpenNewFileIn={onOpenNewFileIn}
            onOpenNewFolderIn={onOpenNewFolderIn}
            newFileInputSlot={newFileInputSlot}
            newFolderInputSlot={newFolderInputSlot}
            onFileSelect={onFileSelect}
            onFileDelete={onFileDelete}
            onFileSetEntrypoint={onFileSetEntrypoint}
            onAssetDelete={onAssetDelete}
            onAssetInsertRef={onAssetInsertRef}
        />
    );

    if (node.type === 'folder') {
        return (
            <FolderNode
                node={node}
                depth={depth}
                expandedFolders={expandedFolders}
                newFileTargetFolder={newFileTargetFolder}
                newFolderTargetFolder={newFolderTargetFolder}
                onToggleFolder={onToggleFolder}
                onOpenNewFileIn={onOpenNewFileIn}
                onOpenNewFolderIn={onOpenNewFolderIn}
                newFileInputSlot={newFileInputSlot}
                newFolderInputSlot={newFolderInputSlot}
                renderChild={renderChild}
            />
        );
    }

    if (node.type === 'file') {
        return (
            <FileNode
                node={node}
                depth={depth}
                onFileSelect={onFileSelect}
                onFileDelete={onFileDelete}
                onFileSetEntrypoint={onFileSetEntrypoint}
            />
        );
    }

    return (
        <AssetNode
            node={node}
            depth={depth}
            onAssetDelete={onAssetDelete}
            onAssetInsertRef={onAssetInsertRef}
        />
    );
};

export default FileTreeNode;
