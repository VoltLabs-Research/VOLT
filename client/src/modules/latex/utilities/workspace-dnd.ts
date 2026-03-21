import { joinWorkspacePath, normalizeWorkspaceFolderPath } from '@/modules/latex/utilities/workspace';

export type LatexWorkspaceDragKind = 'file' | 'asset' | 'folder';

export interface LatexWorkspaceDragData {
    kind: LatexWorkspaceDragKind;
    id: string;
    label: string;
    folderPath: string;
};

export interface LatexWorkspaceDropData {
    folderPath: string;
    label: string;
};

export const LATEX_WORKSPACE_ROOT_DROP_ID = 'latex-workspace-drop:__root__';

export const buildLatexWorkspaceDropId = (folderPath: string): string => {
    return folderPath
        ? `latex-workspace-drop:${folderPath}`
        : LATEX_WORKSPACE_ROOT_DROP_ID;
};

export const canDropLatexWorkspaceItemInFolder = (
    dragData: LatexWorkspaceDragData | null,
    targetFolderPath: string
): boolean => {
    if (!dragData) {
        return false;
    }

    const normalizedTargetFolderPath = normalizeWorkspaceFolderPath(targetFolderPath);

    if (dragData.kind === 'folder') {
        const sourceFolderPath = normalizeWorkspaceFolderPath(dragData.id);
        const nextFolderPath = normalizeWorkspaceFolderPath(joinWorkspacePath(targetFolderPath, dragData.label));

        return Boolean(sourceFolderPath)
            && Boolean(nextFolderPath)
            && nextFolderPath !== sourceFolderPath
            && !nextFolderPath.startsWith(sourceFolderPath);
    }

    return normalizeWorkspaceFolderPath(dragData.folderPath) !== normalizedTargetFolderPath;
};
