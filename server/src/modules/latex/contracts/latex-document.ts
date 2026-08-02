export interface LatexDocumentStorageScope{
    storageClusterId?: string | null;
}

export interface LatexDocumentImportRequest{
    teamId: string;
    userId: string;
    file: Express.Multer.File;
    folderId?: string | null;
}
