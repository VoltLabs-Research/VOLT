import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';
import { getAssetDisplayName, isFolderPlaceholderAsset } from '@/modules/latex/utilities/workspace';

/** A node in the virtual file tree derived from path prefixes. */
export interface FileTreeNode {
    /** Unique identifier for DnD and React keys. */
    id: string;
    /** Display name (folder name or filename). */
    name: string;
    type: 'folder' | 'file' | 'asset';
    /**
     * For folders: the full directory path prefix, e.g. `"chapters/"`.
     * For files: the directory prefix (file.path), e.g. `""` or `"chapters/"`.
     * For assets: the directory prefix derived from asset.path.
     */
    folderPath: string;
    data?: LatexFileEntry | LatexAsset;
    children: FileTreeNode[];
};

/**
 * Resolves the directory prefix for an asset.
 * Assets store their full relative path (e.g. `"images/fig.png"`), so
 * the folder prefix is everything before the last slash.
 */
const assetFolderPath = (asset: LatexAsset): string => {
    const p = asset.path ?? asset.originalName;
    const lastSlash = p.lastIndexOf('/');
    return lastSlash >= 0 ? p.substring(0, lastSlash + 1) : '';
};

/** Returns all unique ancestor folder paths for a given path, ordered root-first. */
const ancestorFolders = (folderPath: string): string[] => {
    const segments = folderPath.replace(/\/$/, '').split('/').filter(Boolean);
    const result: string[] = [];
    let accumulated = '';
    for (const seg of segments) {
        accumulated = `${accumulated}${seg}/`;
        result.push(accumulated);
    }
    return result;
};

/** Inserts a folder path into the map if absent, creating ancestor folders as needed. */
const ensureFolder = (
    folderMap: Map<string, FileTreeNode>,
    folderPath: string
): void => {
    for (const ancestor of ancestorFolders(folderPath)) {
        if (!folderMap.has(ancestor)) {
            const segments = ancestor.replace(/\/$/, '').split('/');
            folderMap.set(ancestor, {
                id: `folder:${ancestor}`,
                name: segments[segments.length - 1],
                type: 'folder',
                folderPath: ancestor,
                children: []
            });
        }
    }
};

/**
 * Builds a nested file tree from a flat list of files and assets.
 *
 * The tree is derived purely from `path` prefixes — no backend entity
 * represents a folder. Folders are inferred from the directory components
 * of each file or asset path.
 *
 * @param files  - Flat list of LatexFileEntry records.
 * @param assets - Flat list of LatexAsset records.
 * @returns The root children of the virtual tree (not wrapped in a root node).
 */
export const buildFileTree = (
    files: LatexFileEntry[],
    assets: LatexAsset[]
): FileTreeNode[] => {
    const visibleAssets = assets.filter((asset) => !isFolderPlaceholderAsset(asset));
    const folderMap = new Map<string, FileTreeNode>();

    // Ensure all required ancestor folders exist.
    for (const file of files) {
        if (file.path) {
            ensureFolder(folderMap, file.path);
        }
    }

    for (const asset of assets) {
        const fp = assetFolderPath(asset);
        if (fp) {
            ensureFolder(folderMap, fp);
        }
    }

    // Wire up parent → child relationships between folders.
    for (const [path, node] of folderMap) {
        const parentPath = ancestorFolders(path).slice(0, -1).pop();
        if (parentPath) {
            folderMap.get(parentPath)?.children.push(node);
        }
    }

    const rootChildren: FileTreeNode[] = [];

    // Add top-level folders (no parent folder) to root.
    for (const [path, node] of folderMap) {
        const isTopLevel = ancestorFolders(path).length === 1;
        if (isTopLevel) {
            rootChildren.push(node);
        }
    }

    // Add file nodes under their respective folder or root.
    for (const file of files) {
        const fileNode: FileTreeNode = {
            id: `file:${file._id}`,
            name: file.name,
            type: 'file',
            folderPath: file.path,
            data: file,
            children: []
        };

        if (file.path) {
            folderMap.get(file.path)?.children.push(fileNode);
        } else {
            rootChildren.push(fileNode);
        }
    }

    // Add asset nodes under their respective folder or root.
    for (const asset of visibleAssets) {
        const fp = assetFolderPath(asset);
        const assetNode: FileTreeNode = {
            id: `asset:${asset._id}`,
            name: getAssetDisplayName(asset),
            type: 'asset',
            folderPath: fp,
            data: asset,
            children: []
        };

        if (fp) {
            folderMap.get(fp)?.children.push(assetNode);
        } else {
            rootChildren.push(assetNode);
        }
    }

    return rootChildren;
};
