export interface LatexAsset {
    _id: string;
    documentId: string;
    originalName: string;
    /** Relative path within the document's virtual file tree (e.g. `images/fig1.png`). */
    path?: string;
    url: string;
    mimetype: string;
    size: number;
    createdAt: Date;
};
