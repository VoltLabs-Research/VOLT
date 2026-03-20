import { buildFileTree } from '@/modules/latex/utilities/file-tree';
import { getAssetDisplayName } from '@/modules/latex/utilities/workspace';
import { confirm, ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';
import type { FileTreeNode } from '@/modules/latex/utilities/file-tree';

interface RenameTarget {
    id: string;
    type: 'folder' | 'file' | 'asset';
    initialName: string;
}

interface UseFileTreeInput {
    files: LatexFileEntry[];
    assets: LatexAsset[];
    onCreateFile: (name: string, path?: string, content?: string) => Promise<unknown>;
    onCreateFolder: (folderPath: string) => Promise<void>;
    onRenameFile: (fileId: string, name: string) => Promise<void>;
    onRenameAsset: (asset: LatexAsset, name: string) => Promise<void>;
    onDeleteFileDirect: (input: { documentId: string; fileId: string }) => Promise<unknown>;
    onDeleteAssetDirect: (input: { documentId: string; assetId: string }) => Promise<unknown>;
    onUpdateFileDirect: (input: { documentId: string; fileId: string; path?: string; name?: string; content?: string }) => Promise<unknown>;
    onUpdateAssetDirect: (input: { documentId: string; assetId: string; path: string }) => Promise<unknown>;
    documentId: string;
}

interface UseFileTreeOutput {
    treeNodes: FileTreeNode[];
    expandedFolders: Set<string>;
    newFileTargetFolder: string | null;
    newFolderTargetFolder: string | null;
    renamingTarget: RenameTarget | null;
    toggleFolder: (folderPath: string) => void;
    openNewFileIn: (folderPath: string) => void;
    closeNewFile: () => void;
    handleConfirmNewFile: (name: string) => Promise<void>;
    openNewFolderIn: (folderPath: string) => void;
    closeNewFolder: () => void;
    handleConfirmNewFolder: (name: string) => Promise<void>;
    startRenameFolder: (folderPath: string) => void;
    startRenameFile: (file: LatexFileEntry) => void;
    startRenameAsset: (asset: LatexAsset) => void;
    cancelRename: () => void;
    handleConfirmRename: (name: string) => Promise<void>;
    handleDeleteFolder: (folderPath: string) => Promise<void>;
}

const normalizeFolderPath = (value: string): string => {
    if (!value) {
        return '';
    }

    return value.endsWith('/') ? value : `${value}/`;
};

const getFolderDisplayName = (folderPath: string): string => {
    const normalized = folderPath.replace(/\/$/, '');
    const parts = normalized.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? '';
};

const getFolderParentPath = (folderPath: string): string => {
    const normalized = folderPath.replace(/\/$/, '');
    const parts = normalized.split('/').filter(Boolean);
    parts.pop();
    return parts.length > 0 ? `${parts.join('/')}/` : '';
};

const useFileTree = ({
    files,
    assets,
    onCreateFile,
    onCreateFolder,
    onRenameFile,
    onRenameAsset,
    onDeleteFileDirect,
    onDeleteAssetDirect,
    onUpdateFileDirect,
    onUpdateAssetDirect,
    documentId
}: UseFileTreeInput): UseFileTreeOutput => {
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [newFileTargetFolder, setNewFileTargetFolder] = useState<string | null>(null);
    const [newFolderTargetFolder, setNewFolderTargetFolder] = useState<string | null>(null);
    const [renamingTarget, setRenamingTarget] = useState<RenameTarget | null>(null);
    const hasAutoExpandedRef = useRef(false);

    const treeNodes = useMemo(() => buildFileTree(files, assets), [files, assets]);

    useEffect(() => {
        if (hasAutoExpandedRef.current) return;
        const rootFolders = treeNodes.filter((node) => node.type === 'folder');
        if (rootFolders.length === 0) return;

        hasAutoExpandedRef.current = true;
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            for (const folder of rootFolders) {
                next.add(folder.folderPath);
            }
            return next;
        });
    }, [treeNodes]);

    const toggleFolder = useCallback((folderPath: string): void => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folderPath)) {
                next.delete(folderPath);
            } else {
                next.add(folderPath);
            }
            return next;
        });
    }, []);

    const openNewFileIn = useCallback((folderPath: string): void => {
        setExpandedFolders((prev) => new Set([...prev, folderPath]));
        setNewFolderTargetFolder(null);
        setRenamingTarget(null);
        setNewFileTargetFolder(folderPath);
    }, []);

    const closeNewFile = useCallback((): void => {
        setNewFileTargetFolder(null);
    }, []);

    const handleConfirmNewFile = useCallback(async (name: string): Promise<void> => {
        const finalName = name.trim();
        if (!finalName) return;

        const path = newFileTargetFolder ?? '';
        setNewFileTargetFolder(null);
        await onCreateFile(finalName, path || undefined);
    }, [newFileTargetFolder, onCreateFile]);

    const openNewFolderIn = useCallback((folderPath: string): void => {
        setExpandedFolders((prev) => new Set([...prev, folderPath]));
        setNewFileTargetFolder(null);
        setRenamingTarget(null);
        setNewFolderTargetFolder(folderPath);
    }, []);

    const closeNewFolder = useCallback((): void => {
        setNewFolderTargetFolder(null);
    }, []);

    const handleConfirmNewFolder = useCallback(async (name: string): Promise<void> => {
        const folderName = name.trim().replace(/[/\\:*?"<>|]/g, '');
        if (!folderName) return;

        const parentPath = newFolderTargetFolder ?? '';
        setNewFolderTargetFolder(null);
        await onCreateFolder(`${parentPath}${folderName}`);
        setExpandedFolders((prev) => new Set([...prev, normalizeFolderPath(parentPath), `${parentPath}${folderName}/`]));
    }, [newFolderTargetFolder, onCreateFolder]);

    const startRenameFolder = useCallback((folderPath: string): void => {
        setNewFileTargetFolder(null);
        setNewFolderTargetFolder(null);
        setRenamingTarget({
            id: `folder:${folderPath}`,
            type: 'folder',
            initialName: getFolderDisplayName(folderPath)
        });
    }, []);

    const startRenameFile = useCallback((file: LatexFileEntry): void => {
        setNewFileTargetFolder(null);
        setNewFolderTargetFolder(null);
        setRenamingTarget({
            id: `file:${file._id}`,
            type: 'file',
            initialName: file.name
        });
    }, []);

    const startRenameAsset = useCallback((asset: LatexAsset): void => {
        setNewFileTargetFolder(null);
        setNewFolderTargetFolder(null);
        setRenamingTarget({
            id: `asset:${asset._id}`,
            type: 'asset',
            initialName: getAssetDisplayName(asset)
        });
    }, []);

    const cancelRename = useCallback(() => {
        setRenamingTarget(null);
    }, []);

    const renameFolder = useCallback(async (folderPath: string, nextName: string) => {
        const parentPath = getFolderParentPath(folderPath);
        const nextPrefix = `${parentPath}${nextName.trim()}/`;
        const operations: Promise<unknown>[] = [];

        for (const file of files) {
            if (file.path.startsWith(folderPath)) {
                operations.push(onUpdateFileDirect({
                    documentId,
                    fileId: file._id,
                    path: `${nextPrefix}${file.path.slice(folderPath.length)}`
                }));
            }
        }

        for (const asset of assets) {
            const currentPath = asset.path ?? asset.originalName;
            if (currentPath.startsWith(folderPath)) {
                operations.push(onUpdateAssetDirect({
                    documentId,
                    assetId: asset._id,
                    path: `${nextPrefix}${currentPath.slice(folderPath.length)}`
                }));
            }
        }

        await Promise.all(operations);
    }, [assets, documentId, files, onUpdateAssetDirect, onUpdateFileDirect]);

    const handleConfirmRename = useCallback(async (name: string): Promise<void> => {
        const nextName = name.trim();
        if (!renamingTarget || !nextName) return;

        if (renamingTarget.type === 'folder') {
            const folderPath = renamingTarget.id.replace(/^folder:/, '');
            await renameFolder(folderPath, nextName);
        } else if (renamingTarget.type === 'file') {
            const fileId = renamingTarget.id.replace(/^file:/, '');
            await onRenameFile(fileId, nextName);
        } else {
            const assetId = renamingTarget.id.replace(/^asset:/, '');
            const asset = assets.find((currentAsset) => currentAsset._id === assetId);
            if (asset) {
                await onRenameAsset(asset, nextName);
            }
        }

        setRenamingTarget(null);
    }, [assets, onRenameAsset, onRenameFile, renameFolder, renamingTarget]);

    const handleDeleteFolder = useCallback(async (folderPath: string): Promise<void> => {
        const folderName = getFolderDisplayName(folderPath);
        const accepted = await confirm({
            title: 'Delete folder',
            description: `Delete "${folderName}" and everything inside it? This cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            tone: ConfirmActionTone.Danger
        });

        if (!accepted) {
            return;
        }

        const fileOperations = files
            .filter((file) => file.path.startsWith(folderPath))
            .map((file) => onDeleteFileDirect({ documentId, fileId: file._id }));
        const assetOperations = assets
            .filter((asset) => (asset.path ?? asset.originalName).startsWith(folderPath))
            .map((asset) => onDeleteAssetDirect({ documentId, assetId: asset._id }));

        await Promise.all([...fileOperations, ...assetOperations]);
    }, [assets, confirm, documentId, files, onDeleteAssetDirect, onDeleteFileDirect]);

    return {
        treeNodes,
        expandedFolders,
        newFileTargetFolder,
        newFolderTargetFolder,
        renamingTarget,
        toggleFolder,
        openNewFileIn,
        closeNewFile,
        handleConfirmNewFile,
        openNewFolderIn,
        closeNewFolder,
        handleConfirmNewFolder,
        startRenameFolder,
        startRenameFile,
        startRenameAsset,
        cancelRename,
        handleConfirmRename,
        handleDeleteFolder
    };
};

export default useFileTree;
