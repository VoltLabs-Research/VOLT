import type { PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';

export interface CatalogFolderDTO {
    _id: string;
    title: string;
    parent: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export interface CreateCatalogFolderInputDTO {
    teamId: string;
    userId: string;
    title: string;
    parentId?: string | null;
};

export interface GetCatalogFolderInputDTO {
    teamId: string;
    folderId: string;
};

export interface UpdateCatalogFolderInputDTO {
    teamId: string;
    folderId: string;
    title: string;
};

export interface DeleteCatalogFolderInputDTO {
    teamId: string;
    folderId: string;
};

export interface ListCatalogFoldersInputDTO extends Partial<PaginationOptions> {
    teamId: string;
    parentId?: string | null;
};

export interface ListCatalogFoldersOutputDTO extends PaginatedResult<CatalogFolderDTO> {};
