export interface LatexAssetDTO {
    _id: string;
    documentId: string;
    originalName: string;
    /** Relative path within the document's virtual file tree. */
    path: string;
    url: string;
    mimetype: string;
    size: number;
    createdAt: Date;
};
