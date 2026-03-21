import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';

export const LATEX_FOLDER_PLACEHOLDER_NAME = '.volt-folder';

const TEXT_FILE_EXTENSIONS = new Set([
    'tex', 'txt', 'md', 'bib', 'cls', 'sty', 'bst', 'csv', 'tsv',
    'json', 'yml', 'yaml', 'xml', 'html', 'css', 'js', 'ts',
    'jsx', 'tsx', 'py', 'sh', 'ini', 'cfg', 'conf', 'log'
]);

const IMAGE_FILE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']);

export const normalizeWorkspaceRelativePath = (value: string): string => {
    return value
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+/g, '/');
};

export const normalizeWorkspaceFolderPath = (value: string): string => {
    const normalized = normalizeWorkspaceRelativePath(value).replace(/\/+$/, '');

    if (!normalized) {
        return '';
    }

    return `${normalized}/`;
};

export const joinWorkspacePath = (folderPath: string, relativePath: string): string => {
    const normalizedRelativePath = normalizeWorkspaceRelativePath(relativePath);
    const normalizedFolderPath = normalizeWorkspaceFolderPath(folderPath);

    if (!normalizedRelativePath) {
        return normalizedFolderPath;
    }

    return normalizedFolderPath
        ? `${normalizedFolderPath}${normalizedRelativePath}`
        : normalizedRelativePath;
};

export const splitWorkspacePath = (value: string): { path: string; name: string } => {
    const normalized = normalizeWorkspaceRelativePath(value);
    const parts = normalized.split('/').filter(Boolean);
    const name = parts.pop() ?? '';
    const path = parts.length > 0 ? `${parts.join('/')}/` : '';

    return { path, name };
};

export const getWorkspaceFileExtension = (name: string): string => {
    const parts = name.split('.');
    return parts.length > 1 ? parts[parts.length - 1]?.toLowerCase() ?? '' : '';
};

export const isWorkspaceTextLikeFile = (name: string, mimetype?: string): boolean => {
    if (mimetype?.startsWith('text/')) {
        return true;
    }

    if (mimetype === 'application/json' || mimetype === 'application/xml') {
        return true;
    }

    return TEXT_FILE_EXTENSIONS.has(getWorkspaceFileExtension(name));
};

export const isWorkspaceImageFile = (name: string, mimetype?: string): boolean => {
    if (mimetype?.startsWith('image/')) {
        return true;
    }

    return IMAGE_FILE_EXTENSIONS.has(getWorkspaceFileExtension(name));
};

export const isWorkspacePdfFile = (name: string, mimetype?: string): boolean => {
    return mimetype === 'application/pdf' || getWorkspaceFileExtension(name) === 'pdf';
};

export const getAssetDisplayName = (asset: LatexAsset): string => {
    return splitWorkspacePath(asset.path ?? asset.originalName).name || asset.originalName;
};

export const isFolderPlaceholderAsset = (asset: LatexAsset): boolean => {
    return getAssetDisplayName(asset) === LATEX_FOLDER_PLACEHOLDER_NAME;
};

export const buildFolderPlaceholderPath = (folderPath: string): string => {
    return `${normalizeWorkspaceFolderPath(folderPath)}${LATEX_FOLDER_PLACEHOLDER_NAME}`;
};
