// Wire response types for the latex module — the shapes the client reads back
// from `data`. `_id`, refs and dates are strings on the wire; `createdBy`/
// `lastEditedBy` may be a populated user object, so they are typed as `unknown`.

export interface LatexDocumentView{
    _id: string;
    title: string;
    folder: string | null;
    createdBy?: unknown;
    lastEditedBy?: unknown;
    createdAt: string;
    updatedAt: string;
}

export interface LatexFileView{
    _id: string;
    documentId: string;
    name: string;
    path: string;
    content: string;
    isEntrypoint: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface LatexAssetView{
    _id: string;
    documentId: string;
    originalName: string;
    path: string;
    url: string;
    mimetype: string;
    size: number;
    createdAt: string;
}

export interface LatexAssetUploadTarget extends LatexAssetView{
    uploadIndex: number;
    uploadUrl: string;
    expiresAt: string;
}

export interface UploadLatexAssetResult{
    uploaded: LatexAssetUploadTarget[];
    failedCount: number;
    total: number;
}

export interface LatexFolderView{
    _id: string;
    title: string;
    parent: string | null;
    createdAt: string;
    updatedAt: string;
}

/**
 * Marker for the streaming/download endpoints (compile PDF, export tex/zip,
 * asset content). The controller writes a raw binary body via `@Res()`; there
 * is no JSON envelope, so the wire "response" carries no structured shape.
 */
export type LatexDownloadResponse = never;
