export interface CatalogFolderDTO {
    _id: string;
    title: string;
    parent: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface DeleteCatalogFolderInputDTO {
    teamId: string;
    folderId: string;
}
