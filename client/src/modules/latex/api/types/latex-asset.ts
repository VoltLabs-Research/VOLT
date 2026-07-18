export interface LatexAsset {
    _id: string;
    documentId: string;
    originalName: string;
    
    path: string;
    url: string;
    mimetype: string;
    size: number;
    createdAt: Date;
}
