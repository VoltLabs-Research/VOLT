export interface LatexDocumentQuery{
    page?: number;
    limit?: number;
    search?: string;
    folderId?: string;
}

export interface LatexFolderQuery{
    parentId?: string;
    page?: number;
    limit?: number;
}
