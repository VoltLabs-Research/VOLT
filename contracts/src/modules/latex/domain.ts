

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

export type LatexDownloadResponse = never;
