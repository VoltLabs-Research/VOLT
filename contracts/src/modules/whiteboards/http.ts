// Wire request bodies the CLIENT sends. Server-derived context (the
// authenticated userId, the `:teamId`/`:whiteboardId`/`:folderId` path params)
// is NOT here — the service augments those on its own input.

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

/**
 * The saved Excalidraw scene payload (`{ revision, elements, appState, ... }`).
 * Opaque on the wire — persisted verbatim to object storage — so it is typed as
 * a free-form record.
 */
export type SaveWhiteboardStateInput = Record<string, unknown>;
