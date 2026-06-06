export interface LatexFileEntry {
    _id: string;
    name: string;
    path: string;
    content: string;
    isEntrypoint: boolean;
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

export interface WorkspaceUploadEntry {
    file: File;
    path: string;
}

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
