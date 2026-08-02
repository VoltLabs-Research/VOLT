import type { LatexFile } from '@volt/contracts/modules/latex/domain';
import type { FileWithPath } from '@/shared/utils/file';

export interface LatexFileEntry extends Pick<LatexFile, '_id' | 'name' | 'path' | 'content' | 'isEntrypoint'> {
    isSelected: boolean;
}

export interface LatexWorkspaceFileSelection {
    type: 'file';
    id: string;
}

export interface LatexWorkspaceAssetSelection {
    type: 'asset';
    id: string;
}

export type WorkspaceUploadEntry = FileWithPath;

export type LatexWorkspaceSelection =
    | LatexWorkspaceFileSelection
    | LatexWorkspaceAssetSelection
    | null;

export type LatexWorkspaceTab = LatexWorkspaceFileSelection | LatexWorkspaceAssetSelection;

export type LatexEditorGroupId = 'primary' | 'secondary';

export interface LatexEditorGroup {
    id: LatexEditorGroupId;
    selection: LatexWorkspaceSelection;
    openTabs: LatexWorkspaceTab[];
}

export interface FileEditorState {
    content: string;
    lastSavedContent: string;
    remoteContent: string;
    isDirty: boolean;
}

export interface PendingRemoteFileUpdate {
    content: string;
    timestamp: number;
}

export interface RenameTarget {
    id: string;
    type: 'folder' | 'file' | 'asset';
    initialName: string;
}
