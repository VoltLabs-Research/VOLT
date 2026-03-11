import { buildFileTree } from '@/modules/latex/utilities/file-tree';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';
import type { FileTreeNode } from '@/modules/latex/utilities/file-tree';

interface UseFileTreeInput {
    files: LatexFileEntry[];
    assets: LatexAsset[];
    onMoveFile: (fileId: string, newPath: string) => Promise<void>;
    onMoveAsset: (assetId: string, newPath: string) => Promise<void>;
    onCreateFile: (name: string, path?: string) => Promise<unknown>;
};

interface UseFileTreeOutput {
    treeNodes: FileTreeNode[];
    expandedFolders: Set<string>;
    /** Folder path where a new-file input should appear, or null if hidden. */
    newFileTargetFolder: string | null;
    /** Folder path where a new-folder input should appear, or null if hidden. */
    newFolderTargetFolder: string | null;
    toggleFolder: (folderPath: string) => void;
    openNewFileIn: (folderPath: string) => void;
    closeNewFile: () => void;
    handleConfirmNewFile: (name: string) => Promise<void>;
    openNewFolderIn: (folderPath: string) => void;
    closeNewFolder: () => void;
    handleConfirmNewFolder: (name: string) => Promise<void>;
    handleDragEnd: (event: DragEndEvent) => void;
};

/**
 * Manages virtual file tree state including folder expansion, new-file
 * creation target, and drag-and-drop move operations.
 */
const useFileTree = ({
    files,
    assets,
    onMoveFile,
    onMoveAsset,
    onCreateFile
}: UseFileTreeInput): UseFileTreeOutput => {
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [newFileTargetFolder, setNewFileTargetFolder] = useState<string | null>(null);
    const [newFolderTargetFolder, setNewFolderTargetFolder] = useState<string | null>(null);

    /** Tracks whether the initial auto-expand of root folders has already run. */
    const hasAutoExpandedRef = useRef(false);

    const treeNodes = useMemo(
        () => buildFileTree(files, assets),
        [files, assets]
    );

    // Auto-expand root-level folders on the first load so imported files inside
    // them are immediately visible and their FileNodes are mounted in the DOM.
    useEffect(() => {
        if (hasAutoExpandedRef.current) return;
        const rootFolders = treeNodes.filter((n) => n.type === 'folder');
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
        // Expand the folder so the user sees the new file input inside it.
        setExpandedFolders((prev) => new Set([...prev, folderPath]));
        setNewFileTargetFolder(folderPath);
    }, []);

    const closeNewFile = useCallback((): void => {
        setNewFileTargetFolder(null);
    }, []);

    const handleConfirmNewFile = useCallback(async (name: string): Promise<void> => {
        const rawName = name.trim();
        const finalName = rawName.endsWith('.tex') ? rawName : `${rawName}.tex`;
        const path = newFileTargetFolder ?? '';
        setNewFileTargetFolder(null);
        await onCreateFile(finalName, path || undefined);
    }, [newFileTargetFolder, onCreateFile]);

    const openNewFolderIn = useCallback((folderPath: string): void => {
        setExpandedFolders((prev) => new Set([...prev, folderPath]));
        setNewFolderTargetFolder(folderPath);
    }, []);

    const closeNewFolder = useCallback((): void => {
        setNewFolderTargetFolder(null);
    }, []);

    /**
     * Creates a virtual folder by placing an empty `main.tex` seed file
     * inside the new folder's path.
     *
     * @param name - The desired folder name. Slashes and invalid characters are stripped.
     */
    const handleConfirmNewFolder = useCallback(async (name: string): Promise<void> => {
        const folderName = name.trim().replace(/[/\\:*?"<>|]/g, '');
        if (!folderName) return;
        const parentPath = newFolderTargetFolder ?? '';
        setNewFolderTargetFolder(null);
        await onCreateFile('main.tex', `${parentPath}${folderName}/`);
    }, [newFolderTargetFolder, onCreateFile]);

    /**
     * Handles a drag-end event from @dnd-kit.
     *
     * Draggable IDs follow the pattern `file:<id>` or `asset:<id>`.
     * Droppable IDs follow the pattern `folder:<path>` where `<path>`
     * is the directory prefix (e.g. `"chapters/"` or `""` for root).
     */
    const handleDragEnd = useCallback((event: DragEndEvent): void => {
        const { active, over } = event;
        if (!over) return;

        const activeId = String(active.id);
        const overId = String(over.id);

        const activeType = activeId.startsWith('file:')
            ? 'file'
            : activeId.startsWith('asset:')
                ? 'asset'
                : null;

        if (!activeType) return;
        if (!overId.startsWith('folder:')) return;

        const itemId = activeId.substring(activeId.indexOf(':') + 1);
        const targetFolder = overId.substring('folder:'.length);

        if (activeType === 'file') {
            // newPath is the directory prefix, e.g. "" or "chapters/"
            const newPath = targetFolder;
            const file = files.find((f) => f._id === itemId);
            if (file && file.path !== newPath) {
                onMoveFile(itemId, newPath);
            }
        } else {
            // For assets, newPath is <folder><originalName>
            const asset = assets.find((a) => a._id === itemId);
            if (!asset) return;

            const existingFolder = asset.path
                ? (asset.path.includes('/') ? asset.path.substring(0, asset.path.lastIndexOf('/') + 1) : '')
                : '';

            if (existingFolder !== targetFolder) {
                const newPath = targetFolder
                    ? `${targetFolder}${asset.originalName}`
                    : asset.originalName;
                onMoveAsset(itemId, newPath);
            }
        }
    }, [files, assets, onMoveFile, onMoveAsset]);

    return {
        treeNodes,
        expandedFolders,
        newFileTargetFolder,
        newFolderTargetFolder,
        toggleFolder,
        openNewFileIn,
        closeNewFile,
        handleConfirmNewFile,
        openNewFolderIn,
        closeNewFolder,
        handleConfirmNewFolder,
        handleDragEnd
    };
};

export default useFileTree;
