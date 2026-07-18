import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';
import type { LatexAsset } from '@/modules/latex/api/types/latex-asset';
import { getAssetDisplayName, isFolderPlaceholderAsset } from '@/modules/latex/utilities/workspace';

const FILE_TREE_NODE_ORDER: Record<FileTreeNode['type'], number> = {
    folder: 0,
    file: 1,
    asset: 1
};

const fileTreeNameCollator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base'
});

export interface FileTreeNode {
    
    id: string;
    
    name: string;
    type: 'folder' | 'file' | 'asset';
    
    folderPath: string;
    data?: LatexFileEntry | LatexAsset;
    children: FileTreeNode[];
}

const sortTreeNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
    nodes.sort((left, right) => {
        const typeOrder = FILE_TREE_NODE_ORDER[left.type] - FILE_TREE_NODE_ORDER[right.type];

        if (typeOrder !== 0) {
            return typeOrder;
        }

        return fileTreeNameCollator.compare(left.name, right.name);
    });

    for (const node of nodes) {
        if (node.children.length > 0) {
            sortTreeNodes(node.children);
        }
    }

    return nodes;
};

const assetFolderPath = (asset: LatexAsset): string => {
    const p = asset.path;
    const lastSlash = p.lastIndexOf('/');
    return lastSlash >= 0 ? p.substring(0, lastSlash + 1) : '';
};

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

export const buildFileTree = (
    files: LatexFileEntry[],
    assets: LatexAsset[],
    folderPaths: string[] = []
): FileTreeNode[] => {
    const visibleAssets = assets.filter((asset) => !isFolderPlaceholderAsset(asset));
    const folderMap = new Map<string, FileTreeNode>();

    for (const folderPath of folderPaths) {
        if (folderPath) {
            ensureFolder(folderMap, folderPath);
        }
    }

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

    for (const [path, node] of folderMap) {
        const parentPath = ancestorFolders(path).slice(0, -1).pop();
        if (parentPath) {
            folderMap.get(parentPath)?.children.push(node);
        }
    }

    const rootChildren: FileTreeNode[] = [];

    for (const [path, node] of folderMap) {
        const isTopLevel = ancestorFolders(path).length === 1;
        if (isTopLevel) {
            rootChildren.push(node);
        }
    }

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

    return sortTreeNodes(rootChildren);
};
