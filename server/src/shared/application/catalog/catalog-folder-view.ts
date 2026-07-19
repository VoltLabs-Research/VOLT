export interface CatalogFolderView {
    _id: string;
    title: string;
    parent: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface DeleteCatalogFolderInput {
    teamId: string;
    folderId: string;
}
