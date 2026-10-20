

export interface CreateWhiteboardInput{
    title: string;
    folderId?: string | null;
}

export interface UpdateWhiteboardInput{
    title?: string;
}

export interface MoveWhiteboardInput{
    folderId: string | null;
}

export interface CreateWhiteboardFolderInput{
    title: string;
    parentId?: string | null;
}

export interface UpdateWhiteboardFolderInput{
    title: string;
}

export interface UploadWhiteboardAssetInput{
    fileName: string;
    size: number;
    type?: string;
}

export type SaveWhiteboardStateInput = Record<string, unknown>;
