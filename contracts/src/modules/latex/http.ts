// Wire request bodies the CLIENT sends. Server-derived context (the
// authenticated userId, the `:teamId`/`:documentId`/`:fileId`/`:assetId` path
// params, uploaded files) is NOT here — the controller reads those from
// @Param/@CurrentUser and the multipart middleware, and the service augments its
// own input.

export interface CreateLatexDocumentInput{
    title: string;
    folderId?: string | null;
}

export interface UpdateLatexDocumentInput{
    title?: string;
}

export interface MoveLatexDocumentInput{
    folderId: string | null;
}

export interface CreateLatexFileInput{
    name: string;
    path?: string;
    content?: string;
    isEntrypoint?: boolean;
}

export interface UpdateLatexFileInput{
    name?: string;
    path?: string;
    content?: string;
}

export interface UpdateLatexAssetInput{
    /** New virtual path for the asset, e.g. `"images/fig1.png"`. */
    path: string;
}

export interface UploadLatexAssetFileInput{
    name: string;
    size: number;
    type?: string;
}

export interface UploadLatexAssetInput{
    /** Optional relative path prefix applied to all uploaded files (e.g. `images/`). */
    path?: string;
    files: UploadLatexAssetFileInput[];
}

export interface CreateLatexFolderInput{
    title: string;
    parentId?: string | null;
}

export interface UpdateLatexFolderInput{
    title: string;
}
